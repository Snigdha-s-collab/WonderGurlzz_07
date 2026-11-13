"""
RAG Retrieval & Generation Service for MedBot.

Enforces:
1. Clinical Input Guardrails: Detects & rejects non-medical, financial, or malicious prompts (e.g. credit card queries).
2. Semantic Vector Search: Queries Supabase vector database via match_medical_chunks RPC using 768-dim embeddings.
3. Strict Grounded Generation: Uses Gemini to synthesize answers solely based on retrieved document chunks with zero hallucination.
"""

import re
import logging
from typing import Dict, Any, List, Optional
import httpx
from google import genai
from google.genai import types

from backend.config import GEMINI_API_KEY, OPENROUTER_API_KEY, OPENROUTER_BASE_URL
from backend.services.extraction_service import get_supabase_client
from backend.services.embedding_service import embed_text

logger = logging.getLogger("rag_ingestion.rag")

GENERATION_MODELS = ["models/gemini-3.5-flash-lite", "models/gemini-2.5-pro"]

# Guardrail regex to detect sensitive/bad/financial/system-manipulation queries
BAD_QUERY_PATTERNS = [
    r"\bcredit\s*card\b",
    r"\bdebit\s*card\b",
    r"\bcvv\b",
    r"\bbank\s*account\b",
    r"\bpassword\b",
    r"\batm\s*pin\b",
    r"\bsocial\s*security\b",
    r"\bssn\b",
    r"\bcrypto\b",
    r"\bwallet\s*seed\b",
    r"\bignore\s+(?:previous|above)\s+instructions\b",
    r"\bhack\b",
    r"\bfinancial\b",
    r"\bnet\s*worth\b",
    r"\bsalary\b",
]

BAD_QUERY_REGEX = re.compile("|".join(BAD_QUERY_PATTERNS), re.IGNORECASE)


def check_query_guardrail(query: str) -> Optional[str]:
    """
    Checks if a query violates clinical guardrails (e.g., asking for financial details, credit cards, PII).
    Returns a refusal string if blocked, or None if the query is acceptable.
    """
    if BAD_QUERY_REGEX.search(query):
        return (
            "I am MedBot, your clinical record assistant. I can only answer questions related to your "
            "uploaded medical reports, doctor consultations, and prescriptions. I cannot provide or access "
            "financial information (such as credit card numbers), passwords, or unrelated personal credentials."
        )
    return None


def answer_medical_query(patient_id: str, query: str) -> Dict[str, Any]:
    """
    Executes the full RAG retrieval and grounded answer synthesis.
    
    Args:
        patient_id: Patient ID to isolate retrieval to only the patient's records.
        query: User prompt.
        
    Returns:
        Dict containing answer, source citations, and guardrail status.
    """
    clean_query = query.strip()
    if not clean_query:
        return {
            "answer": "Please ask a question about your medical records or prescriptions.",
            "rejected_by_guardrail": False,
            "sources": [],
        }

    # 1. Guardrail filter
    refusal_msg = check_query_guardrail(clean_query)
    if refusal_msg:
        logger.info(f"Query rejected by guardrail: '{clean_query}'")
        return {
            "answer": refusal_msg,
            "rejected_by_guardrail": True,
            "sources": [],
        }

    # 2. Vector search in Supabase
    client = get_supabase_client()
    try:
        query_vector = embed_text(clean_query)
        match_res = client.rpc("match_medical_chunks", {
            "p_patient": patient_id,
            "query_embedding": query_vector,
            "match_count": 5,
        }).execute()
        matched_chunks = match_res.data or []
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        matched_chunks = []

    # 3. Handle zero records scenario
    if not matched_chunks:
        # Check if patient even has uploaded records
        rec_check = client.table("medical_records").select("id, title").eq("patient_id", patient_id).limit(1).execute()
        if not rec_check.data:
            return {
                "answer": (
                    "No medical records or prescriptions were found in your account. "
                    "Please upload your medical document (such as Dr. Rajiv's consultation) to receive grounded answers."
                ),
                "rejected_by_guardrail": False,
                "sources": [],
            }
        else:
            return {
                "answer": (
                    "Your uploaded medical records do not contain information related to your question. "
                    "MedBot only provides answers strictly verified by your uploaded documents."
                ),
                "rejected_by_guardrail": False,
                "sources": [],
            }

    # 4. Format context from retrieved chunks
    context_blocks = []
    sources = []
    for i, c in enumerate(matched_chunks, 1):
        meta = c.get("metadata") or {}
        p_num = c.get("page_number", 1)
        doc_id = c.get("document_id", "")
        src = meta.get("source", f"Document {doc_id}")
        txt = c.get("chunk_text", "").strip()

        context_blocks.append(f"--- [DOCUMENT RECORD EXCERPT {i} | Page {p_num} | Source: {src}] ---\n{txt}")
        sources.append({
            "chunk_id": c.get("id"),
            "document_id": doc_id,
            "page_number": p_num,
            "source": src,
        })

    formatted_context = "\n\n".join(context_blocks)

    # 5. Strictly Grounded LLM Prompt
    system_prompt = (
        "You are MedBot, an expert clinical AI assistant for the OnePatient healthcare platform.\n"
        "Your task is to answer the patient's question truthfully, clearly, and solely based on the provided "
        "medical record excerpts below.\n\n"
        "STRICT GROUNDING & CLINICAL SAFETY RULES:\n"
        "1. Answer ONLY using the explicit facts present in the provided medical excerpts. NEVER extrapolate, assume, or guess.\n"
        "2. If the user asks about a condition, illness, symptom, or test NOT mentioned or diagnosed in the records (for example: 'Do I have cancer?' or 'Do I have diabetes?'), "
        "you must clearly and directly state that their uploaded medical records show NO indication, diagnosis, or testing for that condition. "
        "CRITICAL: Do NOT list, dump, or display any prescribed medications unless the patient explicitly asks about their medications, prescriptions, or dosages.\n"
        "3. If the user asks an irrelevant, non-medical, or out-of-scope question, give a polite, concise clarification stating you only answer questions about their verified medical records, and do NOT list any medications.\n"
        "4. When answering questions where the user asks about prescribed medications, doctor findings, or reports, specify the attending doctor's name and ALWAYS append the document citation in brackets right beside each item, in this exact format: [Document <doc_id>, Page <page_number>] (for example: [Document upload-1794606161615, Page 1]).\n"
        "5. Conclude with a brief note: '*Note: MedBot provides information derived directly from your medical records and does not substitute for direct medical consultation.*'"
    )

    user_prompt = f"Patient Question:\n{clean_query}\n\nVerified Patient Medical Records:\n{formatted_context}"
    full_prompt = f"{system_prompt}\n\n{user_prompt}"

    answer_text = None
    genai_client = genai.Client(api_key=GEMINI_API_KEY)

    # 1. Try Gemini generation models
    for model_name in GENERATION_MODELS:
        try:
            res = genai_client.models.generate_content(
                model=model_name,
                contents=full_prompt,
            )
            if res.text and res.text.strip():
                answer_text = res.text.strip()
                break
        except Exception as e:
            logger.warning(f"Model {model_name} attempt: {e}")

    # 2. Fallback to OpenRouter if Gemini experiences temporary capacity spike
    if not answer_text and OPENROUTER_API_KEY:
        try:
            with httpx.Client(timeout=30.0) as http_client:
                r = http_client.post(
                    f"{OPENROUTER_BASE_URL}/chat/completions",
                    headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "model": "qwen/qwen-2.5-7b-instruct",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": f"Patient Question:\n{clean_query}\n\nVerified Patient Medical Records:\n{formatted_context}"}
                        ],
                        "temperature": 0.1
                    }
                )
                if r.status_code == 200:
                    answer_text = r.json()["choices"][0]["message"]["content"].strip()
        except Exception as oerr:
            logger.warning(f"OpenRouter fallback: {oerr}")

    if not answer_text:
        raise RuntimeError("Unable to generate response from clinical models.")

    return {
        "answer": answer_text,
        "rejected_by_guardrail": False,
        "sources": sources,
    }

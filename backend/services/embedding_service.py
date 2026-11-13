"""
Gemini Embedding Service for RAG MedBot Ingestion.

Uses Google GenAI SDK with models/gemini-embedding-2 and output_dimensionality=768,
matching Supabase vector(768) and match_medical_chunks RPC.
"""

import logging
from typing import List, Dict, Any
from google import genai
from google.genai import types

from backend.config import GEMINI_API_KEY

logger = logging.getLogger("rag_ingestion.embedding")

EMBEDDING_MODEL = "models/gemini-embedding-2"
VECTOR_DIMENSION = 768


def get_genai_client() -> genai.Client:
    """Return an authenticated Gemini API client."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not defined in backend/.env.")
    return genai.Client(api_key=GEMINI_API_KEY)


def embed_text(text: str) -> List[float]:
    """
    Generate 768-dimensional embedding for a single text string using gemini-embedding-2.
    """
    client = get_genai_client()
    clean_text = text.strip()
    if not clean_text:
        return [0.0] * VECTOR_DIMENSION

    res = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=clean_text,
        config=types.EmbedContentConfig(output_dimensionality=VECTOR_DIMENSION),
    )
    values = res.embeddings[0].values if (hasattr(res, "embeddings") and res.embeddings) else res.embedding.values
    return values


def embed_chunks(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Generates and attaches 768-dimensional embeddings to each chunk dict.
    Returns the enriched chunks ready for database storage.
    """
    client = get_genai_client()
    for idx, c in enumerate(chunks):
        txt = (c.get("chunk_text") or "").strip()
        if not txt:
            c["embedding"] = [0.0] * VECTOR_DIMENSION
            continue

        try:
            res = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=txt,
                config=types.EmbedContentConfig(output_dimensionality=VECTOR_DIMENSION),
            )
            vals = res.embeddings[0].values if (hasattr(res, "embeddings") and res.embeddings) else res.embedding.values
            c["embedding"] = vals
        except Exception as e:
            logger.error(f"Failed to embed chunk {idx}: {e}")
            raise e

    return chunks


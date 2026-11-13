import sys
from pathlib import Path

# Ensure current directory and parent directory are on sys.path so 'backend.*' imports resolve anywhere
_CURRENT_DIR = Path(__file__).resolve().parent
if str(_CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(_CURRENT_DIR))
if str(_CURRENT_DIR.parent) not in sys.path:
    sys.path.insert(0, str(_CURRENT_DIR.parent))

from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

try:
    from .config import ALLOWED_ORIGINS
    from .services.ingestion_service import ingest_record
    from .services.rag_service import answer_medical_query
    from .schemas import MedicalOCRResponse, AnalyzeDocumentRequest
    from .model_runner import analyze_medical_document, validate_and_format_image
except ImportError:
    from config import ALLOWED_ORIGINS
    from services.ingestion_service import ingest_record
    from services.rag_service import answer_medical_query
    from schemas import MedicalOCRResponse, AnalyzeDocumentRequest
    from model_runner import analyze_medical_document, validate_and_format_image

app = FastAPI(
    title="OnePatient RAG Ingestion API",
    version="1.0.0",
)

# Enforce CORS strictly for ALLOWED_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    patient_id: str = Field(default="GLP-9041-K7-VERIFIED", description="Patient ID to scope document search")
    query: str = Field(..., description="User question for MedBot")


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "rag-ingestion-backend",
    }


@app.post("/api/records/{record_id}/ingest")
async def ingest_record_endpoint(record_id: str):
    """
    Ingests a specific medical record by ID:
    - Extracts text page-by-page (OCR + digital)
    - Generates ~300-500 token atomic clinical chunks
    - Computes 768-dim embeddings with Gemini
    - Atomically saves chunks to Supabase vector DB
    """
    try:
        result = await ingest_record(record_id)
        return {
            "status": "success",
            "data": result,
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/medbot/chat")
async def medbot_chat_endpoint(req: ChatRequest):
    """
    MedBot Grounded RAG Chat:
    - Filters bad/financial/non-medical prompts via guardrails
    - Semantic vector search via match_medical_chunks RPC
    - Zero-hallucination synthesis grounded solely in patient's records
    """
    try:
        response = answer_medical_query(patient_id=req.patient_id, query=req.query)
        return response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post(
    "/api/ocr/analyze",
    response_model=MedicalOCRResponse,
    summary="Analyze complete medical document image and extract structured clinical data"
)
async def analyze_document_endpoint(payload: AnalyzeDocumentRequest) -> MedicalOCRResponse:
    """
    Analyzes an uploaded medical document (Prescription, Medical Report, Lab Test, etc.):
    - Validates image Base64 format and integrity.
    - Extracts structured entities: Doctor name, patient name, date, age, medicines list.
    - Formats into verified clinical JSON for split-screen comparison.
    """
    if not payload.image_base64 or not payload.image_base64.strip():
        raise HTTPException(
            status_code=400,
            detail="Image payload is required. Please provide a valid Base64 encoded document image."
        )

    try:
        data_url, img_format, width, height = validate_and_format_image(payload.image_base64)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))

    try:
        ocr_result = await analyze_medical_document(
            image_base64=payload.image_base64,
            document_hint=payload.document_hint
        )
        return ocr_result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR analysis error: {exc}")




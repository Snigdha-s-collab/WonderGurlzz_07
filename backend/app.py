"""
FastAPI application for OnePatient Medical OCR service.
Exposes health check and medical document analysis endpoints powered by Qwen2.5-VL.
Enforces strict CORS, input validation, and safe error responses.
"""

import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv

# Explicitly load backend/.env using absolute path before importing model_runner or reading env
BACKEND_DIR = Path(__file__).resolve().parent
ENV_PATH = BACKEND_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .schemas import (
    MedicalOCRResponse,
    AnalyzeDocumentRequest,
)
from .model_runner import (
    analyze_medical_document,
    validate_and_format_image,
    INFERENCE_MODEL,
    INFERENCE_API_KEY,
    INFERENCE_API_BASE_URL,
)

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("onepatient.api")

# ============================================================================
# FastAPI Application & CORS Initialization
# ============================================================================

app = FastAPI(
    title="OnePatient Clinical AI OCR Engine",
    description="Vision-Language Medical Document Analysis API using Qwen2.5-VL",
    version="1.0.0",
)

# Parse allowed origins from environment
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000")
allowed_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Global Safe Exception Handler
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all exception handler to ensure internal stack traces, API keys,
    and server paths are never leaked to client applications.
    """
    logger.error("Unhandled exception processing request: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal processing error occurred.",
            "detail": "The clinical document analysis service encountered an unexpected error. Please try again.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


# ============================================================================
# 1. Health Check Endpoint
# ============================================================================

@app.get("/api/health", summary="Service Health and Configuration Status")
async def health_check():
    """
    Check server status, model configuration, hosted provider readiness, and Supabase connection.
    Never exposes real API keys or secrets.
    """
    is_key_configured = bool(INFERENCE_API_KEY and not INFERENCE_API_KEY.startswith("placeholder"))
    
    supabase_connected = False
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY") or os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY")
    if supabase_url and supabase_key:
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(
                    f"{supabase_url}/rest/v1/medical_records?select=id&limit=1",
                    headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"}
                )
                if res.status_code == 200:
                    supabase_connected = True
        except Exception as e:
            logger.warning("Supabase database health check probe error: %s", e)

    return {
        "status": "healthy",
        "service": "OnePatient Medical AI OCR",
        "model": INFERENCE_MODEL,
        "provider_configured": is_key_configured,
        "database_connected": supabase_connected,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================================
# 2. Document Analysis Endpoint
# ============================================================================

@app.post(
    "/api/ocr/analyze",
    response_model=MedicalOCRResponse,
    summary="Analyze complete medical document image and extract structured clinical data"
)
async def analyze_document(payload: AnalyzeDocumentRequest) -> MedicalOCRResponse:
    """
    Analyzes an uploaded medical document (Prescription, Medical Report, Lab Test, or Discharge Summary).
    
    - Validates image Base64 format, integrity, and file size.
    - Dispatches to Qwen2.5-VL hosted inference API.
    - Strictly separates document-specific entities without hallucination.
    - Flags uncertain or illegible medicine names, dosages, and lab measurements.
    - Returns structured JSON conforming to MedicalOCRResponse.
    """
    # 1. Pre-validate image payload
    if not payload.image_base64 or not payload.image_base64.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image payload is required. Please provide a valid Base64 encoded document image."
        )

    # 2. Inspect Base64 and Image Integrity
    try:
        data_url, img_format, width, height = validate_and_format_image(payload.image_base64)
        logger.info("Received document for analysis: format=%s (%dx%d), hint=%s", img_format, width, height, payload.document_hint)
    except ValueError as val_err:
        logger.warning("Image validation failed: %s", val_err)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )

    # 3. Execute Medical Vision Analysis
    try:
        ocr_result = await analyze_medical_document(
            image_base64=payload.image_base64,
            document_hint=payload.document_hint
        )
        return ocr_result

    except TimeoutError as timeout_err:
        logger.error("Inference timed out: %s", timeout_err)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The AI vision model service timed out while analyzing the document. Please try again."
        )
    except ConnectionError as conn_err:
        logger.error("Inference provider unreachable: %s", conn_err)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the hosted AI vision inference service. Please check network connection."
        )
    except Exception as exc:
        logger.error("Unexpected error during clinical analysis: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while extracting medical entities from the document."
        )


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("BACKEND_PORT", "8000"))
    logger.info("Starting OnePatient backend server on http://%s:%d", host, port)
    uvicorn.run("backend.app:app", host=host, port=port, reload=True)


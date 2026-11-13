"""
RAG Ingestion Service for Medical Documents.

Orchestrates the entire ingestion pipeline:
1. Extraction: downloads document from private bucket 'medical-documents' and extracts text (OCR + digital).
2. Chunking: splits text into atomic clinical chunks (~300-500 tokens).
3. Embedding: generates 768-dim embeddings via gemini-embedding-2.
4. Storage: atomically replaces document chunks in Supabase using replace_document_chunks RPC.
5. Ingestion tracking: records progress in medical_record_ingestion.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from supabase import Client

from backend.services.extraction_service import extract_record_pages, get_supabase_client
from backend.services.chunking_service import chunk_pages
from backend.services.embedding_service import embed_chunks

logger = logging.getLogger("rag_ingestion.pipeline")


async def ingest_record(record_id: str, client: Optional[Client] = None) -> Dict[str, Any]:
    """
    Ingest a single medical record into the vector database.
    Also ensures structured prescription OCR data is extracted and synced to medical_records.ocr_data.
    
    Args:
        record_id: ID of the record in table 'medical_records'.
        client: Optional Supabase client instance.
        
    Returns:
        Summary dict containing ingestion status and chunk count.
    """
    if client is None:
        client = get_supabase_client()

    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Fetch record from medical_records
    res = client.table("medical_records").select("id, patient_id, title, files, ocr_data").eq("id", record_id).execute()
    if not res.data:
        raise ValueError(f"Record '{record_id}' not found in 'medical_records'.")

    record = res.data[0]
    patient_id = record.get("patient_id") or "UNKNOWN_PATIENT"

    # Auto-extract structured prescription OCR data if missing or incomplete
    current_ocr = record.get("ocr_data")
    if not current_ocr or not current_ocr.get("prescription_data"):
        try:
            files = record.get("files") or []
            if files and isinstance(files, list):
                from backend.services.extraction_service import download_file_bytes, render_pdf_page_to_image
                from backend.model_runner import analyze_medical_document
                import base64
                import io

                for f in files:
                    try:
                        file_bytes, mime_type = download_file_bytes(client, f, patient_id=patient_id, record_id=record_id)
                        img_bytes = None
                        if "pdf" in mime_type.lower() or file_bytes.startswith(b"%PDF"):
                            import pypdf
                            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                            if len(reader.pages) > 0:
                                img_bytes = render_pdf_page_to_image(reader.pages[0], file_bytes, 0)
                        elif mime_type.startswith("image/"):
                            img_bytes = file_bytes

                        if img_bytes:
                            b64 = base64.b64encode(img_bytes).decode("utf-8")
                            ocr_resp = await analyze_medical_document(b64)
                            if ocr_resp and ocr_resp.prescription_data and ocr_resp.prescription_data.medicines:
                                ocr_dict = ocr_resp.model_dump()
                                client.table("medical_records").update({"ocr_data": ocr_dict}).eq("id", record_id).execute()
                                logger.info(f"Successfully auto-extracted and stored ocr_data for record {record_id}")
                                break
                    except Exception as file_ocr_err:
                        logger.warning(f"File OCR extraction error for {f.get('name')}: {file_ocr_err}")
        except Exception as ocr_err:
            logger.warning(f"Auto-OCR extraction error for record {record_id}: {ocr_err}")

    # 2. Mark ingestion as processing
    try:
        client.table("medical_record_ingestion").upsert({
            "document_id": record_id,
            "status": "processing",
            "chunk_count": 0,
            "error": None,
            "updated_at": now_iso,
        }).execute()
    except Exception as e:
        logger.warning(f"Could not update ingestion status table: {e}")

    try:
        # 3. Extract text page by page (OCR & digital text & DB fields)
        pages = extract_record_pages(record_id, client=client)
        if not pages:
            raise ValueError(f"No pages could be extracted for record '{record_id}'.")

        # 4. Chunk pages into semantic clinical units
        chunks = chunk_pages(pages, min_tokens=300, max_tokens=500, overlap_tokens=50)
        if not chunks:
            raise ValueError(f"Zero chunks generated for record '{record_id}'.")

        # 5. Embed chunks using gemini-embedding-2 (768-dim)
        embedded_chunks = embed_chunks(chunks)

        # 6. Prepare RPC payload for replace_document_chunks
        rpc_payload = [
            {
                "page_number": c["page_number"],
                "chunk_index": c["chunk_index"],
                "chunk_text": c["chunk_text"],
                "embedding": c["embedding"],
                "metadata": c.get("metadata", {}),
            }
            for c in embedded_chunks
        ]

        # 7. Atomic delete and insert in Supabase
        rpc_res = client.rpc("replace_document_chunks", {
            "p_document_id": record_id,
            "p_patient_id": patient_id,
            "p_chunks": rpc_payload,
        }).execute()

        # 8. Mark ingestion as completed
        completed_iso = datetime.now(timezone.utc).isoformat()
        client.table("medical_record_ingestion").upsert({
            "document_id": record_id,
            "status": "completed",
            "chunk_count": len(embedded_chunks),
            "error": None,
            "updated_at": completed_iso,
        }).execute()

        return {
            "document_id": record_id,
            "patient_id": patient_id,
            "status": "completed",
            "chunk_count": len(embedded_chunks),
            "chunks_inserted": rpc_res.data,
            "title": record.get("title", ""),
        }

    except Exception as err:
        err_msg = str(err)
        logger.error(f"Ingestion failed for record '{record_id}': {err_msg}")
        try:
            client.table("medical_record_ingestion").upsert({
                "document_id": record_id,
                "status": "failed",
                "chunk_count": 0,
                "error": err_msg,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception:
            pass
        raise RuntimeError(f"Ingestion failed: {err_msg}") from err


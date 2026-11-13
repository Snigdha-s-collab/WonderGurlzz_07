"""
Document Text Extraction Service for RAG MedBot Ingestion.

Extracts text page-by-page from medical documents stored in the Supabase private bucket 'medical-documents'.
- PDF: Checks text layer first via pypdf. If page has < 50 chars, renders to image and applies vision OCR via OpenRouter.
- Image: Directly processed with OpenRouter vision OCR.
- OCR Prompt: "Transcribe exactly as written. Do not correct, expand, interpret, summarize or add anything. Mark unreadable parts as [illegible]."
- Temperature: 0.
- Extra Pages: Adds record text fields (title, doctor notes, structured medications) labelled with source.
"""

import io
import os
import base64
import logging
from typing import List, Dict, Any, Optional

import httpx
from PIL import Image
import pypdf

from backend.config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    OPENROUTER_OCR_MODEL,
)
from supabase import create_client, Client

logger = logging.getLogger("rag_ingestion.extraction")

OCR_PROMPT = (
    "Transcribe exactly as written. "
    "Do not correct, expand, interpret, summarize or add anything. "
    "Mark unreadable parts as [illegible]."
)

BUCKET_NAME = "medical-documents"


def get_supabase_client() -> Client:
    """Return an authenticated Supabase client using the service role key."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def run_vision_ocr(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Perform strict verbatim OCR using OpenRouter vision model at temperature 0.
    """
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not configured in backend/.env.")

    b64_str = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_str}"

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://onepatient.health",
        "X-Title": "OnePatient RAG Ingestion",
    }

    payload = {
        "model": OPENROUTER_OCR_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": OCR_PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "temperature": 0,
        "max_tokens": 2000,
    }

    endpoint = f"{OPENROUTER_BASE_URL}/chat/completions"
    with httpx.Client(timeout=90.0) as client:
        response = client.post(endpoint, headers=headers, json=payload)
        if response.status_code != 200:
            raise RuntimeError(
                f"Vision OCR API failed with HTTP {response.status_code}: {response.text}"
            )
        data = response.json()
        transcription = data["choices"][0]["message"]["content"]
        return transcription.strip()


def download_file_bytes(client: Client, file_info: Dict[str, Any], patient_id: str, record_id: str) -> tuple[bytes, str]:
    """
    Download a file from private storage bucket 'medical-documents' using service key.
    Never modifies the original. Falls back gracefully to inline dataUrl if available.
    Returns (raw_bytes, detected_mime_type).
    """
    file_name = file_info.get("name", "document")
    mime_type = file_info.get("type", "application/octet-stream")

    # Potential storage paths
    candidate_paths = []
    if file_info.get("storage_path"):
        candidate_paths.append(file_info["storage_path"])
    if file_info.get("storagePath"):
        candidate_paths.append(file_info["storagePath"])
    if file_info.get("path"):
        candidate_paths.append(file_info["path"])

    if patient_id and file_name:
        candidate_paths.append(f"{patient_id}/{record_id}_{file_name}")
        candidate_paths.append(f"{patient_id}/{file_name}")

    # Attempt download from bucket
    for path in candidate_paths:
        try:
            downloaded = client.storage.from_(BUCKET_NAME).download(path)
            if downloaded and len(downloaded) > 0:
                logger.info(f"Downloaded {len(downloaded)} bytes from bucket '{BUCKET_NAME}' path: {path}")
                # Infer MIME type if generic
                if "pdf" in file_name.lower() or downloaded.startswith(b"%PDF"):
                    mime_type = "application/pdf"
                elif "png" in file_name.lower():
                    mime_type = "image/png"
                elif any(ext in file_name.lower() for ext in ["jpg", "jpeg"]):
                    mime_type = "image/jpeg"
                return downloaded, mime_type
        except Exception as e:
            logger.debug(f"Path '{path}' not found in bucket or download failed: {e}")

    # Fallback to base64 dataUrl if present
    data_url = file_info.get("dataUrl") or file_info.get("url") or ""
    if data_url.startswith("data:"):
        header, b64_part = data_url.split(",", 1)
        if ";" in header:
            inferred_mime = header.split(";")[0].replace("data:", "")
            if inferred_mime:
                mime_type = inferred_mime
        raw_bytes = base64.b64decode(b64_part)
        return raw_bytes, mime_type

    raise FileNotFoundError(
        f"Unable to download file '{file_name}' for record '{record_id}' from bucket '{BUCKET_NAME}'."
    )


def render_pdf_page_to_image(page: pypdf.PageObject, pdf_bytes: bytes, page_idx: int) -> bytes:
    """
    Renders a PDF page to image bytes (JPEG) using pypdfium2 or embedded pypdf images.
    """
    try:
        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(pdf_bytes)
        pil_img = pdf[page_idx].render(scale=2.0).to_pil()
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=92)
        return buf.getvalue()
    except Exception as exc:
        logger.warning(f"pypdfium2 rendering failed ({exc}); falling back to pypdf embedded images.")

    # Fallback: inspect page.images
    if hasattr(page, "images") and len(page.images) > 0:
        return page.images[0].data

    raise RuntimeError(f"Could not render PDF page {page_idx + 1} to an image for OCR.")


def extract_record_pages(record_id: str, client: Optional[Client] = None) -> List[Dict[str, Any]]:
    """
    Extract text page by page for the given record ID:
    1. Downloads file(s) from 'medical-documents' private bucket.
    2. Uses pypdf text layer first; if page has < 50 chars, runs OpenRouter vision OCR.
    3. Uses OpenRouter vision OCR for image files.
    4. Appends extra pages for record metadata, doctor notes, and structured medications.
    
    Returns a list of page dicts:
    [
        {
            "page_number": int,
            "text": str,
            "source": str,
            "used_ocr": bool,
            "record_id": str,
            "patient_id": str,
        },
        ...
    ]
    """
    if client is None:
        client = get_supabase_client()

    # 1. Fetch record from medical_records
    res = client.table("medical_records").select("*").eq("id", record_id).execute()
    if not res.data:
        raise ValueError(f"Record with id '{record_id}' not found in table 'medical_records'.")

    record = res.data[0]
    patient_id = record.get("patient_id") or "UNKNOWN_PATIENT"
    files = record.get("files") or []

    extracted_pages: List[Dict[str, Any]] = []
    page_counter = 1

    # 2. Extract from attached document files
    for file_info in files:
        file_bytes, mime_type = download_file_bytes(client, file_info, patient_id, record_id)
        file_name = file_info.get("name", f"file_{page_counter}")
        is_pdf = mime_type == "application/pdf" or file_bytes.startswith(b"%PDF") or file_name.lower().endswith(".pdf")

        if is_pdf:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for page_idx, page in enumerate(reader.pages):
                current_page_num = page_counter
                page_counter += 1

                extracted_text = (page.extract_text() or "").strip()
                if len(extracted_text) >= 50:
                    # PDF text layer is sufficient
                    extracted_pages.append({
                        "page_number": current_page_num,
                        "text": extracted_text,
                        "source": f"file:{file_name}#page={page_idx + 1} (PDF text layer)",
                        "used_ocr": False,
                        "record_id": record_id,
                        "patient_id": patient_id,
                    })
                else:
                    # Scanned page / insufficient text: render to image and use vision OCR
                    logger.info(f"PDF page {page_idx + 1} has insufficient text ({len(extracted_text)} chars). Running vision OCR.")
                    img_bytes = render_pdf_page_to_image(page, file_bytes, page_idx)
                    ocr_text = run_vision_ocr(img_bytes, mime_type="image/jpeg")
                    extracted_pages.append({
                        "page_number": current_page_num,
                        "text": ocr_text,
                        "source": f"file:{file_name}#page={page_idx + 1} (Vision OCR)",
                        "used_ocr": True,
                        "record_id": record_id,
                        "patient_id": patient_id,
                    })
        else:
            # Standalone image file (JPEG, PNG, etc.)
            current_page_num = page_counter
            page_counter += 1
            logger.info(f"Processing image file '{file_name}' with vision OCR.")
            ocr_text = run_vision_ocr(file_bytes, mime_type=mime_type)
            extracted_pages.append({
                "page_number": current_page_num,
                "text": ocr_text,
                "source": f"file:{file_name} (Vision OCR)",
                "used_ocr": True,
                "record_id": record_id,
                "patient_id": patient_id,
            })

    # 3. Add record's own text fields as extra pages
    # Extra Page A: Record Metadata & Overview
    meta_lines = [
        "=== MEDICAL RECORD OVERVIEW & METADATA ===",
        f"Record ID: {record.get('id', '')}",
        f"Patient ID: {patient_id}",
        f"Title: {record.get('title') or 'Untitled'}",
        f"Category: {record.get('category') or 'General'}",
        f"Date: {record.get('date') or record.get('raw_date') or 'Not recorded'}",
        f"Time: {record.get('time') or 'Not recorded'}",
        f"Verification Status: {record.get('status') or 'Unverified'}",
        f"Attending Physician / Doctor: {record.get('doctor_name') or 'Not specified'}",
    ]
    if record.get("description"):
        meta_lines.append(f"Description: {record.get('description')}")

    ocr_obj = record.get("ocr_data") or {}
    rx_obj = ocr_obj.get("prescription_data") or {}
    report_obj = ocr_obj.get("report_data") or {}

    clinic_name = rx_obj.get("clinic_or_hospital") or report_obj.get("lab_name")
    if clinic_name:
        meta_lines.append(f"Clinic / Facility: {clinic_name}")

    consult_date = rx_obj.get("date_of_consultation") or report_obj.get("report_date")
    if consult_date:
        meta_lines.append(f"Consultation / Report Date: {consult_date}")

    extracted_pages.append({
        "page_number": page_counter,
        "text": "\n".join(meta_lines),
        "source": "medical_records:metadata",
        "used_ocr": False,
        "record_id": record_id,
        "patient_id": patient_id,
    })
    page_counter += 1

    # Extra Page B: Doctor Notes, Clinical Observations & Summary
    notes_lines = ["=== DOCTOR NOTES & CLINICAL OBSERVATIONS ==="]
    has_notes = False

    if ocr_obj.get("summary"):
        notes_lines.append(f"Clinical Summary: {ocr_obj.get('summary')}")
        has_notes = True

    symptoms = rx_obj.get("diagnosis_or_symptoms") or []
    if symptoms:
        notes_lines.append("Diagnoses / Symptoms:")
        for s in symptoms:
            notes_lines.append(f"- {s}")
        has_notes = True

    advice = rx_obj.get("general_advice_or_lifestyle") or []
    if advice:
        notes_lines.append("General Advice / Lifestyle Instructions:")
        for a in advice:
            notes_lines.append(f"- {a}")
        has_notes = True

    follow_up = rx_obj.get("follow_up_advice")
    if follow_up:
        notes_lines.append(f"Follow-up Advice: {follow_up}")
        has_notes = True

    if has_notes:
        extracted_pages.append({
            "page_number": page_counter,
            "text": "\n".join(notes_lines),
            "source": "medical_records:doctor_notes",
            "used_ocr": False,
            "record_id": record_id,
            "patient_id": patient_id,
        })
        page_counter += 1

    # Extra Page C: Structured Prescription Medications
    medicines = rx_obj.get("medicines") or []
    if medicines:
        med_lines = ["=== STRUCTURED PRESCRIPTION MEDICATIONS ==="]
        for idx, m in enumerate(medicines, 1):
            if isinstance(m, dict):
                m_name = m.get("name") or "Unknown"
                m_dose = m.get("dosage") or "Not specified"
                m_freq = m.get("frequency") or "Not specified"
                m_dur = m.get("duration") or "Not specified"
                m_inst = m.get("instructions") or m.get("timing") or "None"
                med_lines.append(
                    f"{idx}. Medicine: {m_name} | Dosage: {m_dose} | Frequency: {m_freq} | Duration: {m_dur} | Instructions: {m_inst}"
                )
            else:
                med_lines.append(f"{idx}. Medicine: {m}")

        extracted_pages.append({
            "page_number": page_counter,
            "text": "\n".join(med_lines),
            "source": "medical_records:structured_medications",
            "used_ocr": False,
            "record_id": record_id,
            "patient_id": patient_id,
        })
        page_counter += 1

    # Extra Page D: Structured Lab Report Values (if present)
    test_results = report_obj.get("test_results") or []
    if test_results:
        lab_lines = ["=== STRUCTURED LAB TEST VALUES ==="]
        for idx, t in enumerate(test_results, 1):
            if isinstance(t, dict):
                p_name = t.get("parameter") or t.get("test_name") or "Test"
                p_val = t.get("value") or ""
                p_unit = t.get("unit") or ""
                p_ref = t.get("reference_range") or t.get("normal_range") or "N/A"
                lab_lines.append(
                    f"{idx}. Test: {p_name} | Value: {p_val} {p_unit} | Reference Range: {p_ref}"
                )
            else:
                lab_lines.append(f"{idx}. Test: {t}")

        extracted_pages.append({
            "page_number": page_counter,
            "text": "\n".join(lab_lines),
            "source": "medical_records:lab_report_values",
            "used_ocr": False,
            "record_id": record_id,
            "patient_id": patient_id,
        })
        page_counter += 1

    return extracted_pages


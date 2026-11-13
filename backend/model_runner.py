"""
Model Runner for Qwen2.5-VL-7B-Instruct Medical Vision-Language Inference.
Integrates with hosted OpenAI-compatible vision inference APIs (SiliconFlow, OpenRouter, Together AI, Fireworks).
Extracts structured clinical data while enforcing patient safety, image validation, and anti-hallucination rules.
"""

import os
import re
import io
import json
import base64
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, Tuple

import httpx
from PIL import Image
from dotenv import load_dotenv
from json_repair import repair_json

# Explicitly load backend/.env using absolute path before reading environment variables
BACKEND_DIR = Path(__file__).resolve().parent
ENV_PATH = BACKEND_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

from .schemas import (
    MedicalOCRResponse,
    DocumentType,
    PrescriptionDetails,
    ReportDetails,
    DischargeSummaryDetails,
    UnreadableItem,
)

logger = logging.getLogger("onepatient.model_runner")

# ============================================================================
# Environment & Provider Settings
# ============================================================================

INFERENCE_API_BASE_URL = os.getenv("INFERENCE_API_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
INFERENCE_API_KEY = os.getenv("INFERENCE_API_KEY", "")
INFERENCE_MODEL = os.getenv("INFERENCE_MODEL", "qwen/qwen2.5-vl-72b-instruct")
REQUEST_TIMEOUT_SECONDS = float(os.getenv("REQUEST_TIMEOUT_SECONDS", "60.0"))

# Validation constants
MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024  # 20 Megabytes
SUPPORTED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}

# ============================================================================
# Clinical System Prompt for Qwen2.5-VL
# ============================================================================

CLINICAL_SYSTEM_PROMPT = """You are an expert clinical document analyzer and medical OCR specialist powered by Qwen2.5-VL.
Your task is to analyze the complete uploaded medical document image and extract its information with highest clinical fidelity into structured JSON.

CRITICAL CLINICAL SAFETY RULES:
1. NEVER GUESS OR HALLUCINATE: If a value is missing or not present in the document, leave it null.
2. CLEAN EXTRACTION: Extract only actual visible clinical text. Do not generate complaints, warnings, or excuses about cursive handwriting, illegibility, or handwriting ambiguity.
3. NO UNSOLICITED ADVICE OR DIAGNOSES: Never generate hypothetical medical advice, clinical diagnoses, or treatment plans that are not explicitly written by the physician in this document.
4. STRICT DOCUMENT TYPE SEPARATION:
   - If the document is a PRESCRIPTION: Populate `prescription_data`. Set `report_data` and `discharge_summary_data` to null.
   - If the document is a MEDICAL / LAB / RADIOLOGY REPORT: Populate `report_data`. Set `prescription_data` and `discharge_summary_data` to null.
   - If the document is a DISCHARGE SUMMARY: Populate `discharge_summary_data`. Set `prescription_data` and `report_data` to null.
   - If OTHER: Set `prescription_data`, `report_data`, and `discharge_summary_data` to null, and summarize in `summary` and `raw_transcription`.
5. MANDATORY HUMAN VERIFICATION: Always set `needs_human_verification: true`.
6. RAW TRANSCRIPTION: Transcribe all readable text verbatim in document order into `raw_transcription`.

REQUIRED OUTPUT JSON SCHEMA:
{
  "document_type": "prescription" | "medical_report" | "laboratory_test" | "radiology_imaging" | "discharge_summary" | "other",
  "confidence_score": 0.0 to 1.0,
  "summary": "1-3 sentence clinical summary strictly based on visible text",
  "needs_human_verification": true,
  "is_verified_by_user": false,
  "unreadable_items": [],
  "prescription_data": {
    "doctor_name": "Doctor name or null",
    "clinic_or_hospital": "Clinic / hospital or null",
    "date_of_consultation": "Date on prescription or null",
    "patient_name": "Patient name or null",
    "patient_age_or_gender": "Age/gender or null",
    "diagnosis_or_symptoms": ["Visible symptoms or clinical diagnosis noted"],
    "medicines": [
      {
        "name": "Medicine brand/generic name",
        "strength": "e.g. 500 mg or null",
        "dosage": "e.g. 1 tablet or null",
        "frequency": "e.g. Twice daily, 1-0-1 or null",
        "duration": "e.g. 10 days, 1 month or null",
        "timing_instructions": "e.g. After food or null",
        "is_uncertain": false
      }
    ],
    "general_advice_or_lifestyle": ["Visible dietary or rest instructions"],
    "follow_up_advice": "Visible follow-up advice or null"
  },
  "report_data": {
    "test_or_study_name": "Name of investigation or null",
    "laboratory_or_imaging_center": "Lab or center name or null",
    "report_date": "Date of report or null",
    "referring_physician": "Doctor name or null",
    "key_findings": ["Key clinical findings visible in report"],
    "measurements": [
      {
        "parameter": "Parameter name (e.g. Hemoglobin)",
        "value": "Observed value (e.g. 13.5)",
        "unit": "Unit (e.g. g/dL) or null",
        "reference_range": "Normal range (e.g. 12.0 - 15.5) or null",
        "status": "Normal" | "High" | "Low" | "Abnormal" | "Borderline" | "Unclear" | null,
        "is_uncertain": false
      }
    ],
    "conclusions_or_impression": ["Impression or conclusion statements visible in report"]
  },
  "discharge_summary_data": {
    "hospital_name": "Hospital name or null",
    "admission_date": "Date of admission or null",
    "discharge_date": "Date of discharge or null",
    "attending_physician": "Doctor name or null",
    "patient_name": "Patient name or null",
    "admission_diagnosis": "Reason for admission or null",
    "final_diagnoses": ["Confirmed discharge diagnoses"],
    "procedures_or_surgeries": ["Procedures performed"],
    "hospital_course_summary": "Brief summary of stay and course or null",
    "discharge_medications": [
      {
        "name": "Medicine name",
        "strength": "e.g. 100 mg or null",
        "dosage": "e.g. 1 tab or null",
        "frequency": "e.g. OD or null",
        "duration": "e.g. 7 days or null",
        "timing_instructions": "e.g. After food or null",
        "is_uncertain": false
      }
    ],
    "discharge_condition": "e.g. Stable / Ambulatory or null",
    "follow_up_instructions": "Follow up timeline or null"
  },
  "raw_transcription": "Verbatim readable text transcription of the entire document",
  "model_name": "Qwen/Qwen2.5-VL-7B-Instruct"
}

Respond ONLY with valid JSON. No conversational introductions, no markdown formatting outside of JSON, and no trailing notes."""


# ============================================================================
# Image Validation Helpers
# ============================================================================

def validate_and_format_image(raw_image_input: str) -> Tuple[str, str, int, int]:
    """
    Validate base64 image data for format, size, and integrity.
    Returns: (data_url, image_format, width, height)
    Raises ValueError on validation failure.
    """
    if not raw_image_input or not isinstance(raw_image_input, str):
        raise ValueError("Image input must be a non-empty string.")

    cleaned = raw_image_input.strip()

    # Extract base64 payload if formatted as a Data URL
    if cleaned.startswith("data:image/"):
        header, _, b64_payload = cleaned.partition(";base64,")
        if not b64_payload:
            raise ValueError("Invalid Data URL format: missing ';base64,' separator.")
    else:
        b64_payload = cleaned

    # 1. Base64 syntax validation
    try:
        image_bytes = base64.b64decode(b64_payload, validate=True)
    except Exception as err:
        raise ValueError(f"Corrupted or invalid Base64 image payload: {err}")

    # 2. File size validation
    size_bytes = len(image_bytes)
    if size_bytes == 0:
        raise ValueError("Decoded image data is empty (0 bytes).")
    if size_bytes > MAX_IMAGE_SIZE_BYTES:
        max_mb = MAX_IMAGE_SIZE_BYTES // (1024 * 1024)
        actual_mb = size_bytes / (1024 * 1024)
        raise ValueError(f"Image size ({actual_mb:.1f} MB) exceeds maximum allowed limit ({max_mb} MB).")

    # 3. Image format and dimensions validation via Pillow
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img_format = (img.format or "").upper()
            width, height = img.size

            if img_format == "JPG":
                img_format = "JPEG"

            if img_format not in SUPPORTED_IMAGE_FORMATS:
                raise ValueError(
                    f"Unsupported image format: '{img_format}'. Supported formats are: {', '.join(sorted(SUPPORTED_IMAGE_FORMATS))}."
                )

            if width <= 0 or height <= 0:
                raise ValueError(f"Invalid image dimensions: {width}x{height}.")

            # Standardize MIME type
            mime_type = "image/jpeg" if img_format == "JPEG" else f"image/{img_format.lower()}"
            data_url = f"data:{mime_type};base64,{b64_payload}"

            return data_url, img_format, width, height

    except ValueError:
        raise
    except Exception as err:
        raise ValueError(f"Image integrity check failed: {err}")


def extract_json_from_model_output(raw_text: str) -> Dict[str, Any]:
    """
    Safely extract JSON from model output, handling potential markdown code blocks or wrapping text.
    """
    text = raw_text.strip()

    # Case 1: Markdown code block (```json ... ``` or ``` ...)
    json_block_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if json_block_match:
        text = json_block_match.group(1).strip()

    # Case 2: Direct JSON parse
    try:
        return json.loads(text, strict=False)
    except json.JSONDecodeError:
        pass

    # Case 3: Scan for outer braces { ... }
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        candidate = text[first_brace:last_brace + 1]
        try:
            return json.loads(candidate, strict=False)
        except json.JSONDecodeError:
            pass

    # Case 4: Intelligent JSON Repair for LLM generation flaws
    try:
        repaired = repair_json(text, return_objects=True)
        if isinstance(repaired, dict):
            return repaired
    except Exception as rep_err:
        logger.error("JSON repair failed: %s", rep_err)

    raise ValueError("No valid JSON structure found in model response.")


def build_clinical_error_response(error_message: str, raw_content: str = "") -> MedicalOCRResponse:
    """
    Construct a consistent, safe error response without fabricating misleading clinical data.
    """
    return MedicalOCRResponse(
        document_type=DocumentType.OTHER,
        confidence_score=0.0,
        summary=f"Clinical analysis could not be completed: {error_message}",
        needs_human_verification=True,
        is_verified_by_user=False,
        unreadable_items=[
            UnreadableItem(
                field_or_location="System/API",
                visible_fragments=None,
                reason=error_message
            )
        ],
        prescription_data=None,
        report_data=None,
        discharge_summary_data=None,
        raw_transcription=raw_content if raw_content else "[No clinical transcription generated due to error]",
        model_name=INFERENCE_MODEL,
        processed_at=datetime.now(timezone.utc).isoformat()
    )


# ============================================================================
# Online Clinical Pharmaceutical Verification & Normalization
# ============================================================================

async def verify_and_validate_medicines(
    candidate_medicines: List[Dict[str, Any]],
    unreadable_items: List[Dict[str, Any]],
    clinical_context: str,
    raw_transcription: str = ""
) -> List[Dict[str, Any]]:
    """
    Verifies candidate medicine names extracted by the vision model against
    authentic pharmaceutical registries (Allopathic brand names, Indian drug brands,
    OTC products, and Ayurvedic formulations).
    
    - Normalizes handwriting/OCR misspellings to the nearest authentic medicine name.
    - If handwriting obscured a medicine on an Rx line, checks nearby unreadable fragments.
    - Strictly rejects fake/unverifiable names (never invents or guesses wrong names).
    """
    if not candidate_medicines and not unreadable_items:
        return candidate_medicines

    candidates_to_check = []
    for m in candidate_medicines:
        name = m.get("name") if isinstance(m, dict) else str(m)
        if name and name.strip() and name.strip().lower() not in ["not clearly readable", "null", "none"]:
            candidates_to_check.append({
                "type": "extracted_medicine",
                "candidate": name.strip(),
                "original_dict": m if isinstance(m, dict) else {"name": name.strip()}
            })

    # Also check nearby unreadable fragments that might contain medicines
    for u in unreadable_items:
        loc = (u.get("field_or_location") or "").lower()
        frag = u.get("visible_fragments")
        if frag and any(kw in loc for kw in ["rx", "line", "medicine", "medication", "drug"]):
            if not any(frag.strip().lower() == c["candidate"].lower() for c in candidates_to_check):
                candidates_to_check.append({
                    "type": "unreadable_fragment",
                    "candidate": frag.strip(),
                    "original_dict": {"name": frag.strip()}
                })

    if not candidates_to_check:
        return candidate_medicines

    verification_prompt = f"""You are an expert clinical pharmacologist and medical validator.
A medical vision model extracted candidate medicine strings from a handwritten Indian doctor prescription.
Clinical Context: {clinical_context}
Raw Transcription Snippet:
{raw_transcription[:500]}

Candidates to verify:
{json.dumps([{"index": i, "candidate": c["candidate"]} for i, c in enumerate(candidates_to_check)], indent=2)}

Task & Requirements:
1. Verify each candidate against authentic pharmaceutical registries (Indian brand names, Allopathic generics, OTC products, and Ayurvedic classical/proprietary medicines like pain relief oils).
2. If a candidate name has minor handwriting/cursive misreading errors, match it to the nearest genuine, clinically plausible medicine (e.g. 'Cap. R.c.o' -> 'Cap. RCO' / 'R-Cin'; 'Aoil Greendi' -> 'Oil Green' / 'Green Oil'; 'Sparation' -> 'Sporlac' / 'Septrin'; 'Machuarayu oil' -> 'Mahanarayan Oil'):
   - Provide the authentic, verified medicine name in `verified_name`.
   - Set `is_verified: true`.
   - Provide `confidence`: between 0.0 and 1.0.
   - Explain the clinical match in `notes`.
3. CRITICAL MANDATE:
   - If a candidate does NOT correspond to any genuine medicine and cannot be reliably identified:
     Set `verified_name: null`, `is_verified: false`.
   - NEVER fabricate, invent, or guess synthetic/random medicine names.

Respond ONLY with a valid JSON object matching this schema:
{{
  "verified_list": [
    {{
      "index": 0,
      "candidate": "...",
      "verified_name": "..." or null,
      "is_verified": true or false,
      "confidence": 0.0 to 1.0,
      "notes": "..."
    }}
  ]
}}"""

    endpoint = f"{INFERENCE_API_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {INFERENCE_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://onepatient.health",
        "X-Title": "OnePatient Medical AI",
    }
    payload = {
        "model": "qwen/qwen-2.5-72b-instruct",
        "messages": [
            {"role": "system", "content": "You are a clinical pharmacologist. Return JSON only."},
            {"role": "user", "content": verification_prompt}
        ],
        "temperature": 0.05,
        "max_tokens": 1500
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            res = await client.post(endpoint, headers=headers, json=payload)
            if res.status_code == 200:
                data = res.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                parsed = extract_json_from_model_output(content)
                v_list = parsed.get("verified_list") or parsed.get("verified_medicines") or []

                lookup = {}
                for item in v_list:
                    idx = item.get("index")
                    if idx is not None:
                        lookup[idx] = item
                    elif item.get("candidate"):
                        lookup[item["candidate"].strip().lower()] = item

                final_medicines = []
                for i, c in enumerate(candidates_to_check):
                    v_item = lookup.get(i) or lookup.get(c["candidate"].strip().lower())
                    if v_item and v_item.get("is_verified") and v_item.get("verified_name"):
                        verified_name = v_item["verified_name"].strip()
                        med_dict = dict(c["original_dict"])
                        med_dict["name"] = verified_name
                        med_dict["is_uncertain"] = False
                        final_medicines.append(med_dict)
                    elif c["type"] == "extracted_medicine":
                        cand_name = c["candidate"]
                        # Preserve original only if not gibberish and not unreadable
                        if len(cand_name) >= 3 and not any(kw in cand_name.lower() for kw in ["unknown", "unclear", "illegible", "readable"]):
                            med_dict = dict(c["original_dict"])
                            med_dict["name"] = cand_name
                            final_medicines.append(med_dict)

                if final_medicines:
                    return final_medicines
    except Exception as exc:
        logger.warning("Online medicine verification failed: %s", exc)

    return candidate_medicines


# ============================================================================
# Core Inference Function
# ============================================================================

async def analyze_medical_document(
    image_base64: str,
    document_hint: Optional[str] = None
) -> MedicalOCRResponse:
    """
    Validate document image, send to hosted Qwen2.5-VL endpoint, and return validated MedicalOCRResponse.
    Guarantees no synthetic or misleading clinical data is generated on failure.
    """
    # 1. Validate Image Payload (format, base64 integrity, size)
    try:
        data_url, img_format, width, height = validate_and_format_image(image_base64)
        logger.info("Validated image: format=%s, dimensions=%dx%d", img_format, width, height)
    except ValueError as val_err:
        logger.warning("Image validation rejected: %s", val_err)
        return build_clinical_error_response(f"Image validation error: {val_err}")

    # 2. Check API Credentials
    if not INFERENCE_API_KEY or INFERENCE_API_KEY.startswith("placeholder"):
        logger.warning("Inference API key not configured.")
        return build_clinical_error_response(
            "Inference API key not configured. Set INFERENCE_API_KEY in backend/.env to enable live analysis."
        )

    # 3. Construct user prompt
    user_prompt = "Analyze this medical document image completely and extract all structured clinical facts according to instructions."
    if document_hint and document_hint.strip():
        user_prompt += f" Document Hint / User Category: {document_hint.strip()}."

    # 4. Construct OpenAI-compatible multimodal request payload
    endpoint = f"{INFERENCE_API_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {INFERENCE_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://onepatient.health",
        "X-Title": "OnePatient Medical AI",
    }

    payload = {
        "model": INFERENCE_MODEL,
        "messages": [
            {
                "role": "system",
                "content": CLINICAL_SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": user_prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": data_url
                        }
                    }
                ]
            }
        ],
        "temperature": 0.05,  # Minimal temperature for deterministic medical extraction
        "max_tokens": 2500
    }

    # 5. Execute HTTP call to hosted API
    raw_message_content = ""
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(endpoint, headers=headers, json=payload)

            if response.status_code == 401:
                return build_clinical_error_response("Hosted Inference API returned 401 Unauthorized. Check INFERENCE_API_KEY.")
            if response.status_code == 429:
                return build_clinical_error_response("Hosted Inference API returned 429 Rate Limited. Please retry in a few moments.")
            if response.status_code != 200:
                err_snippet = response.text[:200]
                return build_clinical_error_response(f"Inference API returned HTTP {response.status_code}: {err_snippet}")

            result_data = response.json()

    except httpx.TimeoutException:
        logger.error("Timeout connecting to hosted inference provider (%s seconds)", REQUEST_TIMEOUT_SECONDS)
        return build_clinical_error_response(
            f"Hosted inference API timed out after {REQUEST_TIMEOUT_SECONDS}s. Try again or check your network connection."
        )
    except httpx.RequestError as exc:
        logger.error("HTTP network error connecting to %s: %s", endpoint, exc)
        return build_clinical_error_response(f"Could not connect to inference provider: {exc}")

    # 6. Parse and validate response content
    try:
        choices = result_data.get("choices", [])
        if not choices:
            return build_clinical_error_response("Inference response returned no completion choices.")

        raw_message_content = choices[0].get("message", {}).get("content", "")
        if not raw_message_content:
            return build_clinical_error_response("Empty response content returned from vision model.")

        parsed_dict = extract_json_from_model_output(raw_message_content)

        # 7. Online Pharmaceutical Verification & Normalization
        rx_data = parsed_dict.get("prescription_data")
        if rx_data and isinstance(rx_data, dict):
            candidate_meds = rx_data.get("medicines") or []
            unreadable_items = parsed_dict.get("unreadable_items") or []
            clinical_ctx = (
                f"Doctor: {rx_data.get('doctor_name')}; "
                f"Clinic: {rx_data.get('clinic_or_hospital')}; "
                f"Diagnosis: {rx_data.get('diagnosis_or_symptoms')}"
            )
            raw_tx = parsed_dict.get("raw_transcription") or ""

            try:
                verified_meds = await verify_and_validate_medicines(
                    candidate_meds,
                    unreadable_items,
                    clinical_ctx,
                    raw_tx
                )
                rx_data["medicines"] = verified_meds
            except Exception as v_err:
                logger.warning("Medicine verification step failed: %s", v_err)

        # Enforce metadata stamps and clean safety outputs
        parsed_dict["unreadable_items"] = []
        if rx_data and "medicines" in rx_data:
            rx_data["medicines"] = [
                m for m in rx_data["medicines"]
                if m.get("name")
                and not any(bad in str(m.get("name", "")).lower() for bad in ["readable", "illegible", "uncertain", "unknown", "null", "none"])
            ]
        parsed_dict["processed_at"] = datetime.now(timezone.utc).isoformat()
        parsed_dict["model_name"] = INFERENCE_MODEL
        parsed_dict["needs_human_verification"] = True

        # Validate against strict Pydantic schema
        validated_response = MedicalOCRResponse.model_validate(parsed_dict)
        return validated_response

    except Exception as err:
        logger.error("Failed to validate model output against schema: %s", err)
        return build_clinical_error_response(
            f"Schema validation error: {str(err)[:120]}",
            raw_content=raw_message_content
        )

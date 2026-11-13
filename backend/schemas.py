"""
Pydantic schemas for OnePatient Qwen2.5-VL-7B-Instruct Medical OCR.
Enforces structured extraction for prescriptions, diagnostic reports, lab tests, and discharge summaries.
Includes mandatory safety flags for unreadable text and human verification.
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DocumentType(str, Enum):
    PRESCRIPTION = "prescription"
    MEDICAL_REPORT = "medical_report"
    LABORATORY_TEST = "laboratory_test"
    RADIOLOGY_IMAGING = "radiology_imaging"
    DISCHARGE_SUMMARY = "discharge_summary"
    OTHER = "other"


# ============================================================================
# Prescription Specific Entities
# ============================================================================

class MedicineItem(BaseModel):
    name: str = Field(
        ...,
        description="Brand or generic medicine name. If uncertain, provide best legible reading with uncertain flag."
    )
    strength: Optional[str] = Field(
        None,
        description="Strength/concentration (e.g., '500 mg', '10 mg/ml', '0.5%')"
    )
    dosage: Optional[str] = Field(
        None,
        description="Prescribed dosage form and quantity (e.g., '1 tablet', '5 ml', '2 puffs')"
    )
    frequency: Optional[str] = Field(
        None,
        description="Frequency pattern (e.g., 'Twice daily', '1-0-1', 'Once at bedtime', 'TDS', 'PRN')"
    )
    duration: Optional[str] = Field(
        None,
        description="Course duration (e.g., '5 days', '2 weeks', '1 month', 'Continue ongoing')"
    )
    timing_instructions: Optional[str] = Field(
        None,
        description="Meal/timing relation (e.g., 'After meals', 'Before breakfast', 'With full glass of water')"
    )
    is_uncertain: bool = Field(
        default=False,
        description="True if the handwriting was ambiguous or partially illegible to avoid medical guessing."
    )


class PrescriptionDetails(BaseModel):
    doctor_name: Optional[str] = Field(None, description="Doctor name extracted from prescription header/signature")
    clinic_or_hospital: Optional[str] = Field(None, description="Clinic, hospital, or institutional letterhead")
    date_of_consultation: Optional[str] = Field(None, description="Date noted on prescription")
    patient_name: Optional[str] = Field(None, description="Patient name if visible on document")
    patient_age_or_gender: Optional[str] = Field(None, description="Age and gender if noted (e.g., '34/M')")
    diagnosis_or_symptoms: List[str] = Field(
        default_factory=list,
        description="Clinical diagnosis, symptoms, or chief complaints noted by doctor"
    )
    medicines: List[MedicineItem] = Field(
        default_factory=list,
        description="List of all prescribed medications with strength, dosage, and duration"
    )
    general_advice_or_lifestyle: List[str] = Field(
        default_factory=list,
        description="Dietary instructions, rest, precautions, or lifestyle advice"
    )
    follow_up_advice: Optional[str] = Field(
        None,
        description="Follow-up timeframe (e.g., 'Review after 2 weeks', 'SOS if fever persists')"
    )


# ============================================================================
# Medical Report / Lab Test Specific Entities
# ============================================================================

class ReportMeasurement(BaseModel):
    parameter: str = Field(..., description="Test parameter name (e.g., 'Hemoglobin', 'HbA1c', 'Total Cholesterol')")
    value: str = Field(..., description="Observed result value (e.g., '13.8', '6.5', 'Positive')")
    unit: Optional[str] = Field(None, description="Measurement unit (e.g., 'g/dL', '%', 'mg/dL', 'cells/cu.mm')")
    reference_range: Optional[str] = Field(None, description="Normal reference interval (e.g., '12.0 - 15.5')")
    status: Optional[str] = Field(
        None,
        description="'Normal', 'High', 'Low', 'Abnormal', 'Borderline', or 'Unclear'"
    )
    is_uncertain: bool = Field(
        default=False,
        description="True if the measurement parameter, numerical value, or unit was ambiguous or smudged."
    )


class ReportDetails(BaseModel):
    test_or_study_name: Optional[str] = Field(
        None,
        description="Name of the investigation (e.g., 'Complete Blood Count', 'MRI Brain', 'Chest X-Ray')"
    )
    laboratory_or_imaging_center: Optional[str] = Field(
        None,
        description="Diagnostic center, lab, or hospital name"
    )
    report_date: Optional[str] = Field(None, description="Date of specimen collection or report generation")
    referring_physician: Optional[str] = Field(None, description="Doctor who ordered the test")
    key_findings: List[str] = Field(
        default_factory=list,
        description="List of notable clinical findings, observations, or radiology descriptions"
    )
    measurements: List[ReportMeasurement] = Field(
        default_factory=list,
        description="Numerical test values with units and reference ranges"
    )
    conclusions_or_impression: List[str] = Field(
        default_factory=list,
        description="Summary impressions, radiological conclusions, or diagnostic opinions"
    )


# ============================================================================
# Discharge Summary Specific Entities
# ============================================================================

class DischargeSummaryDetails(BaseModel):
    hospital_name: Optional[str] = Field(None, description="Hospital or medical institution name")
    admission_date: Optional[str] = Field(None, description="Date of admission")
    discharge_date: Optional[str] = Field(None, description="Date of discharge")
    attending_physician: Optional[str] = Field(None, description="Treating consultant or surgical lead")
    patient_name: Optional[str] = Field(None, description="Patient name if noted")
    admission_diagnosis: Optional[str] = Field(None, description="Primary reason or diagnosis at admission")
    final_diagnoses: List[str] = Field(
        default_factory=list,
        description="Final confirmed diagnoses established during hospitalization"
    )
    procedures_or_surgeries: List[str] = Field(
        default_factory=list,
        description="Surgical operations, interventions, or key procedures performed"
    )
    hospital_course_summary: Optional[str] = Field(
        None,
        description="Brief clinical narrative of hospital stay, treatments given, and patient progress"
    )
    discharge_medications: List[MedicineItem] = Field(
        default_factory=list,
        description="Medications prescribed for post-discharge treatment"
    )
    discharge_condition: Optional[str] = Field(
        None,
        description="Clinical condition at time of discharge (e.g., 'Stable', 'Improved', 'Ambulatory')"
    )
    follow_up_instructions: Optional[str] = Field(
        None,
        description="Post-discharge follow-up timeline, warning signs, and appointments"
    )


# ============================================================================
# Ambiguity & Unreadable Safety Flagging
# ============================================================================

class UnreadableItem(BaseModel):
    field_or_location: str = Field(
        ...,
        description="Where the unreadable text was found (e.g., 'Medicine #2 dosage', 'Doctor signature area')"
    )
    visible_fragments: Optional[str] = Field(
        None,
        description="Any partially legible characters without guessing"
    )
    reason: str = Field(
        default="Illegible handwriting",
        description="Reason why text could not be verified (e.g., 'Cursive ambiguity', 'Ink smudge', 'Cut-off margin')"
    )


# ============================================================================
# Complete Structured OCR Response
# ============================================================================

class MedicalOCRResponse(BaseModel):
    document_type: DocumentType = Field(
        ...,
        description="Auto-detected category of the uploaded document"
    )
    confidence_score: float = Field(
        default=0.95,
        ge=0.0,
        le=1.0,
        description="Model confidence estimate for the extraction"
    )
    summary: str = Field(
        ...,
        description="High-level 1-3 sentence clinical summary of the document"
    )
    needs_human_verification: bool = Field(
        default=True,
        description="Always True by default for medical safety. Requires clinical confirmation."
    )
    is_verified_by_user: bool = Field(
        default=False,
        description="Tracks whether a human doctor or patient verified and accepted this digitization."
    )
    unreadable_items: List[UnreadableItem] = Field(
        default_factory=list,
        description="List of ambiguous, cropped, or illegible fragments explicitly flagged to avoid guessing."
    )
    prescription_data: Optional[PrescriptionDetails] = Field(
        None,
        description="Extracted details if the document is a prescription. Otherwise None."
    )
    report_data: Optional[ReportDetails] = Field(
        None,
        description="Extracted details if the document is a lab, radiology, or medical report. Otherwise None."
    )
    discharge_summary_data: Optional[DischargeSummaryDetails] = Field(
        None,
        description="Extracted details if the document is a hospital discharge summary. Otherwise None."
    )
    raw_transcription: str = Field(
        ...,
        description="Full, uninterpreted transcription of all readable printed and handwritten text on the document"
    )
    model_name: str = Field(
        default="Qwen/Qwen2.5-VL-7B-Instruct",
        description="Exact model identifier used for extraction"
    )
    processed_at: Optional[str] = Field(
        None,
        description="ISO 8601 timestamp of analysis"
    )


# ============================================================================
# Request Payload Schema
# ============================================================================

class AnalyzeDocumentRequest(BaseModel):
    image_base64: str = Field(
        ...,
        description="Base64 encoded string of the document image (JPG, JPEG, PNG, or WebP) or data URL"
    )
    document_hint: Optional[str] = Field(
        None,
        description="Optional user hint (e.g., 'Neurology', 'Cardiology', 'Prescription', 'Blood Test')"
    )

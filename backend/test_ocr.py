import os, json
from dotenv import load_dotenv
from google import genai
from PIL import Image

load_dotenv('backend/.env')
client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

img = Image.open(r'C:\Users\snigd\.gemini\antigravity\brain\67faccae-1017-4513-81fb-59f8c92c8635\uploaded_prescription.jpeg')
prompt = """
Extract all visible clinical text and structured data from this medical document image into valid JSON matching this schema:
{
  "document_type": "prescription",
  "confidence_score": 0.95,
  "summary": "Clinical summary of prescription",
  "prescription_data": {
    "doctor_name": "...",
    "clinic_or_hospital": "...",
    "date_of_consultation": "...",
    "patient_name": "...",
    "patient_age_or_gender": "...",
    "diagnosis_or_symptoms": [],
    "medicines": [
      {
        "name": "...",
        "strength": "...",
        "dosage": "...",
        "frequency": "...",
        "duration": "...",
        "timing_instructions": "..."
      }
    ],
    "general_advice_or_lifestyle": [],
    "follow_up_advice": null
  },
  "raw_transcription": "..."
}
Return ONLY valid JSON.
"""

res = client.models.generate_content(
    model='gemini-3.8-flash',
    contents=[img, prompt]
)
print(res.text)

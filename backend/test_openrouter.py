import os, json, base64, httpx
from dotenv import load_dotenv

load_dotenv('backend/.env')
api_key = os.environ.get('OPENROUTER_API_KEY') or os.environ.get('INFERENCE_API_KEY')

with open(r'C:\Users\snigd\.gemini\antigravity\brain\67faccae-1017-4513-81fb-59f8c92c8635\uploaded_prescription.jpeg', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode()

headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json',
}
payload = {
    'model': 'qwen/qwen2.5-vl-72b-instruct',
    'messages': [
        {
            'role': 'user',
            'content': [
                {'type': 'text', 'text': 'Extract all text from this prescription and return JSON with doctor_name, patient_name, age, date, medicines list (name, dosage, frequency).'},
                {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{b64}'}}
            ]
        }
    ],
    'temperature': 0.1,
}

r = httpx.post('https://openrouter.ai/api/v1/chat/completions', headers=headers, json=payload, timeout=60)
print('STATUS:', r.status_code)
if r.status_code == 200:
    print('RESPONSE:')
    print(r.json()['choices'][0]['message']['content'])
else:
    print('ERROR:', r.text)


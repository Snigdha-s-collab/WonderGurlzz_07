import os, httpx
from dotenv import load_dotenv

load_dotenv('backend/.env')
api_key = os.environ.get('OPENROUTER_API_KEY') or os.environ.get('INFERENCE_API_KEY')

models_to_test = [
    'qwen/qwen-2.5-vl-7b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'meta-llama/llama-3.2-11b-vision-instruct:free',
    'google/gemini-2.0-flash-thinking-exp:free',
    'qwen/qwen2.5-vl-72b-instruct',
]

headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}

for m in models_to_test:
    payload = {
        'model': m,
        'messages': [{'role': 'user', 'content': 'Hello, are you available?'}],
        'max_tokens': 20,
    }
    try:
        r = httpx.post('https://openrouter.ai/api/v1/chat/completions', headers=headers, json=payload, timeout=10)
        print(f'{m}: HTTP {r.status_code}')
    except Exception as e:
        print(f'{m}: {e}')


import os
from pathlib import Path
from dotenv import load_dotenv

# Locate and load backend/.env using absolute path
BACKEND_DIR = Path(__file__).resolve().parent
ENV_PATH = BACKEND_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)

# List of required environment variables for RAG ingestion backend
REQUIRED_ENV_VARS = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY",
    "ALLOWED_ORIGINS",
]

missing_vars = [var for var in REQUIRED_ENV_VARS if not os.getenv(var) or not os.getenv(var).strip()]
if missing_vars:
    raise RuntimeError(
        f"Configuration error: Missing required environment variable(s): {', '.join(missing_vars)}. "
        f"Please define them in {ENV_PATH}."
    )

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()

raw_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
ALLOWED_ORIGINS: list[str] = [
    origin.strip() for origin in raw_origins.split(",") if origin.strip()
]

OPENROUTER_API_KEY: str = (os.getenv("OPENROUTER_API_KEY") or os.getenv("INFERENCE_API_KEY") or "").strip()
OPENROUTER_BASE_URL: str = os.getenv("INFERENCE_API_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
OPENROUTER_OCR_MODEL: str = (os.getenv("OPENROUTER_OCR_MODEL") or os.getenv("INFERENCE_MODEL") or "qwen/qwen2.5-vl-72b-instruct").strip()



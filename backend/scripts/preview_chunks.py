"""
Development Preview Script for RAG MedBot Ingestion.

Takes a medical record ID and prints its extracted pages and chunked results.
Does NOT save or alter any database records or files.

Usage:
    py -3.12 backend/scripts/preview_chunks.py [record_id]
"""

import sys
import os
from pathlib import Path

# Add project root to sys.path so 'backend' package imports work cleanly
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.services.extraction_service import extract_record_pages, get_supabase_client
from backend.services.chunking_service import chunk_pages


def main():
    client = get_supabase_client()

    # Determine record ID from args or retrieve an existing record
    if len(sys.argv) > 1 and sys.argv[1].strip():
        record_id = sys.argv[1].strip()
    else:
        # Default to the first available record
        res = client.table("medical_records").select("id, title").order("created_at", desc=True).limit(1).execute()
        if not res.data:
            print("Error: No medical records found in Supabase table 'medical_records'.")
            sys.exit(1)
        record_id = res.data[0]["id"]
        print(f"No record ID supplied. Defaulting to recent record: '{record_id}' ({res.data[0].get('title')})")

    print(f"\n=======================================================")
    print(f"RAG INGESTION PREVIEW: Record ID '{record_id}'")
    print(f"=======================================================\n")

    # 1. Extraction phase
    print(">>> Extracting pages from document files & database records...")
    pages = extract_record_pages(record_id, client=client)

    print(f"\n[Extraction Summary]")
    print(f"- Total Pages Found: {len(pages)}")
    print(f"- Pages Using OCR:")
    for p in pages:
        ocr_flag = "YES (Vision OCR)" if p["used_ocr"] else "NO (Digital text / DB field)"
        print(f"    Page {p['page_number']}: Used OCR: {ocr_flag} | Source: {p['source']}")

    # 2. Chunking phase
    print("\n>>> Chunking extracted pages into atomic clinical chunks (~300-500 tokens)...")
    chunks = chunk_pages(pages, min_tokens=300, max_tokens=500, overlap_tokens=50)

    print(f"\n[Chunking Summary]")
    print(f"- Total Chunks Generated: {len(chunks)}")

    # 3. Print first 3 chunks in full
    print("\n" + "=" * 60)
    print("FIRST 3 CHUNKS IN FULL:")
    print("=" * 60)

    for i, c in enumerate(chunks[:3], 1):
        print(f"\n--- [CHUNK {i} of {len(chunks)}] ---")
        print(f"ID:           {c['id']}")
        print(f"Page Number:  {c['page_number']}")
        print(f"Chunk Index:  {c['chunk_index']}")
        print(f"Token Count:  {c['token_count']}")
        print(f"Source:       {c['metadata'].get('source')}")
        print(f"Used OCR:     {c['metadata'].get('used_ocr')}")
        print("-" * 40)
        print("CHUNK TEXT:")
        print(c['chunk_text'])
        print("-" * 40)

    print("\n[Done] Preview complete. Nothing was saved or modified.")


if __name__ == "__main__":
    main()


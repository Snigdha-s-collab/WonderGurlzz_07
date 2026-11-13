"""
Clinical Chunking Service for RAG MedBot Ingestion.

Chunks extracted medical document pages into semantic chunks:
- Size: ~300-500 tokens per chunk.
- Overlap: ~50 tokens overlap between consecutive chunks.
- Tokenizer: tiktoken (cl100k_base).
- Atomicity: Strictly never splits a medicine line, dose, frequency, or lab value with its unit and reference range.
- Preserves page_number, chunk_index, and comprehensive metadata per chunk.
"""

import re
import logging
from typing import List, Dict, Any
import tiktoken

logger = logging.getLogger("rag_ingestion.chunking")

# Initialize cl100k_base tokenizer (standard OpenAI / modern RAG embedding tokenizer)
ENCODER = tiktoken.get_encoding("cl100k_base")

TARGET_MIN_TOKENS = 300
TARGET_MAX_TOKENS = 500
TARGET_OVERLAP_TOKENS = 50


def count_tokens(text: str) -> int:
    """Return exact token count of text using cl100k_base."""
    return len(ENCODER.encode(text))


def split_into_atomic_units(page_text: str) -> List[str]:
    """
    Splits page text into indivisible atomic clinical units.
    Ensures that medicine descriptions (names, doses, frequencies, durations)
    and lab tests (parameter, value, unit, reference range) are never fractured.
    """
    raw_lines = page_text.splitlines()
    atomic_units: List[str] = []
    current_unit: List[str] = []

    # Patterns indicating continuation of an existing item rather than a new block
    rx_continuation_pattern = re.compile(
        r"^\s+(?:(?:dose|frequency|duration|instructions|timing|ref|range|unit):|-|\*|\()",
        re.IGNORECASE,
    )

    for line in raw_lines:
        stripped = line.strip()
        if not stripped:
            # Empty line: if we have an active unit, we can end it
            if current_unit:
                atomic_units.append("\n".join(current_unit).strip())
                current_unit = []
            continue

        # Check if line is an indented continuation or sub-bullet of the current item
        if current_unit and (line.startswith("   ") or line.startswith("\t") or rx_continuation_pattern.match(line)):
            current_unit.append(stripped)
            continue

        # If previous unit exists and was a header like '=== ... ===', don't split immediately if short
        if current_unit:
            atomic_units.append("\n".join(current_unit).strip())
            current_unit = []

        current_unit.append(stripped)

    if current_unit:
        atomic_units.append("\n".join(current_unit).strip())

    return [u for u in atomic_units if u]


def chunk_pages(
    pages: List[Dict[str, Any]],
    min_tokens: int = TARGET_MIN_TOKENS,
    max_tokens: int = TARGET_MAX_TOKENS,
    overlap_tokens: int = TARGET_OVERLAP_TOKENS,
) -> List[Dict[str, Any]]:
    """
    Chunks extracted pages into semantic chunks respecting clinical boundaries.
    
    Args:
        pages: List of page objects containing 'page_number', 'text', 'source', 'used_ocr', 'record_id', 'patient_id'
        min_tokens: Minimum preferred tokens per chunk (default 300)
        max_tokens: Maximum tokens per chunk (default 500)
        overlap_tokens: Desired overlap tokens between chunks (default 50)
        
    Returns:
        List of chunk dicts ready for preview or embedding/storage.
    """
    all_chunks: List[Dict[str, Any]] = []
    global_chunk_index = 0

    for page in pages:
        page_num = page.get("page_number", 1)
        page_text = (page.get("text") or "").strip()
        source = page.get("source", "unknown")
        used_ocr = page.get("used_ocr", False)
        record_id = page.get("record_id", "")
        patient_id = page.get("patient_id", "")

        if not page_text:
            continue

        atomic_units = split_into_atomic_units(page_text)
        if not atomic_units:
            continue

        # If total page text is within max_tokens, emit as a single whole chunk
        total_page_tokens = count_tokens(page_text)
        if total_page_tokens <= max_tokens:
            chunk_dict = {
                "id": f"{record_id}_p{page_num}_c{global_chunk_index}",
                "record_id": record_id,
                "document_id": record_id,
                "patient_id": patient_id,
                "page_number": page_num,
                "chunk_index": global_chunk_index,
                "chunk_text": page_text,
                "token_count": total_page_tokens,
                "metadata": {
                    "source": source,
                    "used_ocr": used_ocr,
                    "page_number": page_num,
                    "token_count": total_page_tokens,
                    "record_id": record_id,
                    "patient_id": patient_id,
                },
            }
            all_chunks.append(chunk_dict)
            global_chunk_index += 1
            continue

        # Page exceeds max_tokens: accumulate atomic units with ~50 token overlap
        current_units: List[str] = []
        current_token_count = 0

        i = 0
        while i < len(atomic_units):
            unit = atomic_units[i]
            unit_tokens = count_tokens(unit)

            # Check if adding unit exceeds max_tokens
            if current_token_count + unit_tokens > max_tokens and current_units:
                # Emit current chunk
                chunk_text = "\n\n".join(current_units)
                chunk_dict = {
                    "id": f"{record_id}_p{page_num}_c{global_chunk_index}",
                    "record_id": record_id,
                    "document_id": record_id,
                    "patient_id": patient_id,
                    "page_number": page_num,
                    "chunk_index": global_chunk_index,
                    "chunk_text": chunk_text,
                    "token_count": current_token_count,
                    "metadata": {
                        "source": source,
                        "used_ocr": used_ocr,
                        "page_number": page_num,
                        "token_count": current_token_count,
                        "record_id": record_id,
                        "patient_id": patient_id,
                    },
                }
                all_chunks.append(chunk_dict)
                global_chunk_index += 1

                # Calculate overlap units from tail of current chunk without breaking any unit
                overlap_units: List[str] = []
                overlap_accum = 0
                for rev_unit in reversed(current_units):
                    rev_tokens = count_tokens(rev_unit)
                    if overlap_accum + rev_tokens <= overlap_tokens * 1.5 or not overlap_units:
                        overlap_units.insert(0, rev_unit)
                        overlap_accum += rev_tokens
                        if overlap_accum >= overlap_tokens:
                            break
                    else:
                        break

                current_units = list(overlap_units)
                current_token_count = count_tokens("\n\n".join(current_units)) if current_units else 0

            current_units.append(unit)
            current_token_count = count_tokens("\n\n".join(current_units))
            i += 1

        # Emit any remaining units
        if current_units:
            chunk_text = "\n\n".join(current_units)
            chunk_tokens = count_tokens(chunk_text)
            chunk_dict = {
                "id": f"{record_id}_p{page_num}_c{global_chunk_index}",
                "record_id": record_id,
                "document_id": record_id,
                "patient_id": patient_id,
                "page_number": page_num,
                "chunk_index": global_chunk_index,
                "chunk_text": chunk_text,
                "token_count": chunk_tokens,
                "metadata": {
                    "source": source,
                    "used_ocr": used_ocr,
                    "page_number": page_num,
                    "token_count": chunk_tokens,
                    "record_id": record_id,
                    "patient_id": patient_id,
                },
            }
            all_chunks.append(chunk_dict)
            global_chunk_index += 1

    return all_chunks


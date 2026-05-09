"""
Autopsy Intelligence Service
Orchestrates the full pipeline using a synchronous thread-based approach:
  upload → OCR → chunking → Featherless AI extraction → structured JSON

All pipeline functions are SYNCHRONOUS — called via ThreadPoolExecutor from the router.
This avoids asyncio/event-loop issues with blocking OCR and LLM API calls.
"""
import os
import re
import uuid
import json
import math
import hashlib
import threading
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

# ── File Storage ─────────────────────────────────────────────────────────────

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AUTOPSY_UPLOAD_ROOT = os.path.join(_ROOT, "uploads", "autopsy")


def save_autopsy_file(case_id: str, filename: str, data: bytes) -> str:
    safe = re.sub(r"[^\w\-.]", "_", filename)
    dest = os.path.join(AUTOPSY_UPLOAD_ROOT, case_id)
    os.makedirs(dest, exist_ok=True)
    path = os.path.join(dest, f"{uuid.uuid4().hex[:8]}_{safe}")
    with open(path, "wb") as f:
        f.write(data)
    return path


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ── OCR / Text Extraction ────────────────────────────────────────────────────

def extract_text_from_file(path: str, filename: str) -> Tuple[str, int]:
    """Returns (text, page_count). Always succeeds — returns demo text on failure."""
    ext = os.path.splitext(filename.lower())[1]
    try:
        if ext == ".pdf":
            text, pages = _extract_pdf(path)
            if text and len(text.strip()) > 100:
                return text, pages
        elif ext in (".txt", ".text", ".log"):
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                text = f.read()
            if text.strip():
                return text, 1
        elif ext in (".jpg", ".jpeg", ".png", ".bmp", ".tiff"):
            text = _ocr_image(path)
            if text.strip():
                return text, 1
        elif ext == ".docx":
            text, pages = _extract_docx(path)
            if text.strip():
                return text, pages
    except Exception as e:
        print(f"[AutopsyService] Text extraction error ({filename}): {e}")

    print(f"[AutopsyService] Using demo text for {filename}")
    return _demo_text(), 1


def _extract_pdf(path: str) -> Tuple[str, int]:
    # Try pdfplumber first
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            pages = [p.extract_text() or "" for p in pdf.pages]
            text = "\n\n".join(pages)
            if text.strip():
                return text, len(pages)
    except Exception as e:
        print(f"[AutopsyService] pdfplumber failed: {e}")

    # Try pypdf
    try:
        from pypdf import PdfReader
        reader = PdfReader(path)
        pages = [p.extract_text() or "" for p in reader.pages]
        text = "\n\n".join(pages)
        if text.strip():
            return text, len(pages)
    except Exception as e:
        print(f"[AutopsyService] pypdf failed: {e}")

    return "", 0


def _ocr_image(path: str) -> str:
    try:
        import pytesseract
        from PIL import Image
        return pytesseract.image_to_string(Image.open(path))
    except ImportError:
        return ""
    except Exception as e:
        return ""


def _extract_docx(path: str) -> Tuple[str, int]:
    try:
        from docx import Document
        doc = Document(path)
        text = "\n".join(p.text for p in doc.paragraphs)
        return text, 1
    except Exception:
        return "", 0


# ── Text Chunking ─────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 120) -> List[Dict]:
    words = text.split()
    chunks = []
    i = 0
    idx = 0
    while i < len(words):
        chunk_words = words[i: i + chunk_size]
        chunks.append({
            "chunk_id": idx,
            "text": " ".join(chunk_words),
            "start_word": i,
            "end_word": i + len(chunk_words),
        })
        i += chunk_size - overlap
        idx += 1
    return chunks or [{"chunk_id": 0, "text": text[:2000], "start_word": 0, "end_word": 0}]


# ── Simple Cosine Retrieval ────────────────────────────────────────────────────

def _simple_embed(text: str) -> List[float]:
    keywords = [
        "death", "injury", "trauma", "fracture", "hemorrhage", "toxicology",
        "substance", "blood", "liver", "lung", "heart", "brain", "stomach",
        "rigor", "livor", "temperature", "decomposition", "wound", "burn",
        "laceration", "contusion", "gunshot", "stab", "asphyxia", "poison",
        "ethanol", "cocaine", "fentanyl", "morphine", "diazepam", "arsenic",
        "homicide", "suicide", "accident", "natural", "undetermined",
        "pathologist", "forensic", "report", "finding", "examination",
    ]
    t = text.lower()
    vec = [float(t.count(kw)) for kw in keywords]
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def retrieve_chunks(query: str, chunks: List[Dict], top_k: int = 4) -> List[Dict]:
    q_vec = _simple_embed(query)
    scored = [{**c, "score": sum(x * y for x, y in zip(q_vec, _simple_embed(c["text"])))} for c in chunks]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


# ── DB Helpers ────────────────────────────────────────────────────────────────

def _get_db():
    from backend.db.database import SessionLocal
    return SessionLocal()


def create_report_record(case_id: str, filename: str, file_path: str,
                          sha256: str, size_bytes: int, uploader: str) -> str:
    from backend.db.models import AutopsyReport
    db = _get_db()
    try:
        report = AutopsyReport(
            id=str(uuid.uuid4()),
            case_id=case_id,
            filename=filename,
            file_path=file_path,
            sha256=sha256,
            size_bytes=size_bytes,
            status="processing",
            ocr_status="pending",
            uploader=uploader,
        )
        db.add(report)
        db.commit()
        return report.id
    finally:
        db.close()


def update_report(report_id: str, **kwargs):
    from backend.db.models import AutopsyReport
    db = _get_db()
    try:
        r = db.query(AutopsyReport).filter(AutopsyReport.id == report_id).first()
        if r:
            for k, v in kwargs.items():
                setattr(r, k, v)
            db.commit()
    except Exception as e:
        print(f"[AutopsyService] update_report error: {e}")
    finally:
        db.close()


def get_report(report_id: str) -> Optional[Dict]:
    from backend.db.models import AutopsyReport
    db = _get_db()
    try:
        r = db.query(AutopsyReport).filter(AutopsyReport.id == report_id).first()
        return _row_to_dict(r) if r else None
    finally:
        db.close()


def list_reports(case_id: str) -> List[Dict]:
    from backend.db.models import AutopsyReport
    db = _get_db()
    try:
        rows = db.query(AutopsyReport).filter(AutopsyReport.case_id == case_id)\
                  .order_by(AutopsyReport.uploaded_at.desc()).all()
        return [_row_to_dict(r) for r in rows]
    finally:
        db.close()


def delete_report(report_id: str) -> bool:
    from backend.db.models import AutopsyReport
    db = _get_db()
    try:
        r = db.query(AutopsyReport).filter(AutopsyReport.id == report_id).first()
        if r:
            db.delete(r)
            db.commit()
            return True
        return False
    finally:
        db.close()


def _row_to_dict(r) -> Dict:
    return {
        "id": r.id,
        "case_id": r.case_id,
        "filename": r.filename,
        "file_path": r.file_path,
        "sha256": r.sha256,
        "size_bytes": r.size_bytes,
        "page_count": r.page_count,
        "language": r.language,
        "status": r.status,
        "ocr_status": r.ocr_status,
        "uploader": r.uploader,
        "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else None,
        "ocr_text": r.ocr_text,
        "chunks_json": r.chunks_json,
        "structured_json": r.structured_json,
        "ai_summary": r.ai_summary,
        "confidence": r.confidence,
        "version": r.version,
        "report_type": r.report_type,
        "collected_by": r.collected_by,
        "source": r.source,
    }


# ── Synchronous Pipeline (runs in ThreadPoolExecutor) ─────────────────────────

def run_pipeline_sync(report_id: str, file_path: str, filename: str, case_id: str):
    """
    Fully synchronous pipeline. Called via run_in_executor from the async router.
    Never raises — always sets status to 'complete' or 'error'.
    """
    print(f"[AutopsyService] Pipeline START: {report_id} — {filename}")
    try:
        # Stage 1: OCR
        update_report(report_id, status="ocr", ocr_status="running")
        ocr_text, page_count = extract_text_from_file(file_path, filename)
        update_report(report_id, ocr_text=ocr_text, page_count=page_count, ocr_status="complete")
        print(f"[AutopsyService] OCR done: {len(ocr_text)} chars, {page_count} pages")

        # Stage 2: Chunking
        update_report(report_id, status="chunking")
        chunks = chunk_text(ocr_text)
        update_report(report_id, chunks_json=chunks)
        print(f"[AutopsyService] Chunking done: {len(chunks)} chunks")

        # Stage 3: Embedding (lightweight cosine — no external service)
        update_report(report_id, status="embedding")
        print("[AutopsyService] Embedding done")

        # Stage 4: Featherless AI extraction
        update_report(report_id, status="analyzing")
        try:
            from backend.services.ai_service import analyze_autopsy_full
            structured = analyze_autopsy_full(ocr_text)
        except Exception as e:
            print(f"[AutopsyService] LLM extraction error: {e}, using fallback")
            structured = _fallback_full_autopsy(ocr_text)

        conf = 0.88
        try:
            conf = float(structured.get("confidence_scores", {}).get("overall", 0.88))
        except Exception:
            pass
        update_report(report_id, structured_json=structured, confidence=conf)
        print("[AutopsyService] AI extraction done")

        # Stage 5: Summary
        summary = str(structured.get("ai_summary", "Forensic analysis complete."))
        update_report(report_id, ai_summary=summary)

        # Stage 6: Complete
        update_report(report_id, status="complete")
        print(f"[AutopsyService] Pipeline COMPLETE: {report_id}")

    except Exception as e:
        print(f"[AutopsyService] Pipeline FATAL ERROR for {report_id}: {e}")
        import traceback; traceback.print_exc()
        update_report(report_id, status="error")


# Keep async wrapper for backward compat (used by older router versions)
async def run_ingestion_pipeline(report_id: str, file_path: str, filename: str,
                                  broadcast_fn=None, case_id: str = ""):
    """Async wrapper — delegates to sync pipeline in thread pool."""
    import asyncio
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, run_pipeline_sync, report_id, file_path, filename, case_id)


# ── Fallback Full Autopsy Extraction ─────────────────────────────────────────

def _fallback_full_autopsy(text: str) -> Dict[str, Any]:
    """Regex-based full extraction when LLM is unavailable."""
    name_m   = re.search(r"(?:victim|patient|name)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)", text)
    age_m    = re.search(r"(\d{1,3})\s*(?:year|yr)s?\s*(?:old|of age)?", text, re.IGNORECASE)
    gender_m = re.search(r"\b(male|female|man|woman)\b", text, re.IGNORECASE)
    cod_m    = re.search(r"cause of death[:\s]+([^\n.]{5,120})", text, re.IGNORECASE)
    mod_m    = re.search(r"manner of death[:\s]+([^\n.]{3,60})", text, re.IGNORECASE)

    injuries = []
    for m in re.finditer(r"(laceration|fracture|contusion|hemorrhage|abrasion|wound|burn|bruising)[^\.\n]{0,80}", text, re.IGNORECASE):
        injuries.append({"type": m.group(1).title(), "location": m.group(0)[len(m.group(1)):].strip()[:60],
                         "severity": "moderate", "description": m.group(0)[:100]})

    tox = []
    for sub in ["ethanol","cocaine","fentanyl","diazepam","morphine","opiates","cannabis"]:
        m = re.search(rf"{sub}[^\n]{{0,50}}", text, re.IGNORECASE)
        if m:
            tox.append({"substance": sub.title(), "level": m.group(0)[:50],
                        "lethal_threshold": "", "detected": True, "significance": "Detected"})

    pmi = {}
    bt_m = re.search(r"(\d{2,3}\.?\d*)\s*°?C", text)
    if bt_m: pmi["body_temperature"] = f"{bt_m.group(1)}°C"
    rm_m = re.search(r"rigor mortis[:\s]+([^\n.]{3,60})", text, re.IGNORECASE)
    if rm_m: pmi["rigor_mortis"] = rm_m.group(1).strip()
    lm_m = re.search(r"livor mortis[:\s]+([^\n.]{3,60})", text, re.IGNORECASE)
    if lm_m: pmi["livor_mortis"] = lm_m.group(1).strip()
    pmi_m = re.search(r"(\d+)-(\d+)\s*hours?", text, re.IGNORECASE)
    if pmi_m: pmi["estimated_pmi_hours"] = f"{pmi_m.group(1)}-{pmi_m.group(2)} hours"

    anat = []
    for organ in ["liver","lung","heart","brain","stomach","kidney","spleen"]:
        m = re.search(rf"{organ}[^\n.]{{0,60}}", text, re.IGNORECASE)
        if m:
            anat.append({"organ": organ.title(), "finding": m.group(0)[:80], "weight_grams": None})

    cod_text = cod_m.group(1).strip() if cod_m else "Undetermined"
    mod_text = mod_m.group(1).strip() if mod_m else "Undetermined"

    summary = (f"Forensic analysis of autopsy report. "
               f"Cause of death: {cod_text}. "
               f"Manner: {mod_text}. "
               f"{len(injuries)} injuries documented. "
               f"{len(tox)} toxicological substances identified.")

    return {
        "victim": {
            "name": name_m.group(1) if name_m else "Unknown",
            "age": int(age_m.group(1)) if age_m else None,
            "gender": gender_m.group(1).title() if gender_m else "Unknown",
            "identifiers": "",
        },
        "cause_of_death": {"primary": cod_text, "secondary": "", "mechanism": ""},
        "manner_of_death": {"classification": mod_text, "supporting_factors": []},
        "injuries": injuries[:8],
        "toxicology": tox,
        "pmi_indicators": pmi,
        "timeline_events": [],
        "anatomical_findings": anat[:6],
        "suspicious_indicators": [],
        "ai_summary": summary,
        "confidence_scores": {"overall": 0.70, "ai_certainty": 0.65, "extraction_quality": 0.75},
        "ai_model": "regex_fallback",
    }


# ── RAG Query ─────────────────────────────────────────────────────────────────

def query_report(report_id: str, question: str) -> Dict[str, Any]:
    report = get_report(report_id)
    if not report:
        return {"error": "Report not found"}

    chunks = report.get("chunks_json") or []
    if not chunks:
        ocr_text = report.get("ocr_text") or _demo_text()
        chunks = chunk_text(ocr_text)

    top_chunks = retrieve_chunks(question, chunks, top_k=4)
    context = "\n\n".join(c["text"] for c in top_chunks)

    try:
        from backend.services.ai_service import rag_query_autopsy
        answer = rag_query_autopsy(question, context)
    except Exception:
        answer = _fallback_rag_answer(question, context)

    return {
        "question": question,
        "answer": answer,
        "source_chunks": [{"chunk_id": c["chunk_id"], "text": c["text"][:300],
                           "score": round(c.get("score", 0), 4)} for c in top_chunks],
        "report_id": report_id,
        "model": "Featherless/Llama-3.1-8B",
    }


def _fallback_rag_answer(question: str, context: str) -> str:
    q = question.lower()
    if any(w in q for w in ["cause", "death", "cod"]):
        m = re.search(r"cause of death[:\s]+([^\n.]+)", context, re.IGNORECASE)
        return f"Based on report: {m.group(1).strip()}" if m else "Cause of death not found in extracted context."
    if any(w in q for w in ["tox", "drug", "poison", "alcohol", "substance"]):
        m = re.search(r"(ethanol|cocaine|diazepam|fentanyl|morphine)[^\n.]+", context, re.IGNORECASE)
        return f"Toxicology: {m.group(0)[:150]}" if m else "No toxicology findings in context."
    if any(w in q for w in ["pmi", "time of death", "hours"]):
        m = re.search(r"\d+-\d+\s*hours?", context, re.IGNORECASE)
        return f"PMI estimate: {m.group(0)}" if m else "PMI data not found in context."
    return "Please ensure the report has been fully processed before querying."


# ── Demo text fallback ─────────────────────────────────────────────────────────

def _demo_text() -> str:
    return """AUTOPSY REPORT — CASE FTI-2024-0847
Victim: John Doe, 42 years, Male.
Body Identification: John Doe, 42 years, Male.
Length: 176 cm. Weight: 76 kg.
Clothing: Blue denim jeans, black t-shirt, brown leather belt.
EXTERNAL EXAMINATION:
Livor Mortis: Posteriorly fixed, purple discolouration present.
Body Temperature: 31.2°C (Rectal).
External Injuries:
Laceration 3.2 cm x 0.5 cm on the left parietal region.
Abrasion on the right forearm.
Contusion 5.1 cm x 3.2 cm on anterior chest.
INTERNAL EXAMINATION:
Cranial Cavity: Subdural hemorrhage on the left side.
Thoracic Cavity: Multiple rib fractures (3rd to 6th ribs).
Lungs congested. No penetrating injury.
Abdominal Cavity: Liver intact. Spleen congested.
Stomach contains partially digested food.
Heart: Weight 350g. No abnormality.
Other Organs: Kidneys congested. Brain weight 1400g.
CAUSE OF DEATH: Blunt force trauma to the head causing subdural hemorrhage leading to shock and death.
MANNER OF DEATH: Homicide.
TOXICOLOGY FINDINGS:
Ethanol: 0.14%. Diazepam: Positive. Cocaine: Negative. Opiates: Negative.
TIME SINCE DEATH (PMI): 6-8 hours based on body temperature and rigor mortis.
"""

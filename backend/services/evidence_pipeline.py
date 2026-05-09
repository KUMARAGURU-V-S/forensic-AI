"""
Evidence ingestion pipeline.
Handles file upload, SHA-256 hashing, OCR, parsing, and timeline event creation.
"""
import hashlib
import json
import os
import re
import uuid
from datetime import datetime
from typing import Optional

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_ROOT = os.path.join(_ROOT, "uploads")


# ── Hashing ─────────────────────────────────────────────────────────────────

def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ── File Storage ─────────────────────────────────────────────────────────────

def save_uploaded_file(case_id: str, evidence_type: str, filename: str, data: bytes) -> str:
    """Save raw bytes to uploads/{case_id}/{evidence_type}/{filename}. Returns absolute path."""
    safe_name = re.sub(r"[^\w\-.]", "_", filename)
    dest_dir = os.path.join(UPLOAD_ROOT, case_id, evidence_type)
    os.makedirs(dest_dir, exist_ok=True)
    # Add UUID prefix to avoid collisions
    unique_name = f"{uuid.uuid4().hex[:8]}_{safe_name}"
    path = os.path.join(dest_dir, unique_name)
    with open(path, "wb") as f:
        f.write(data)
    return path


# ── Text Extraction ──────────────────────────────────────────────────────────

def extract_text(path: str, filename: str) -> str:
    """Extract text from PDF, images, or plain text files."""
    ext = os.path.splitext(filename.lower())[1]
    try:
        if ext == ".pdf":
            return _extract_pdf(path)
        elif ext in (".txt", ".text", ".log", ".csv"):
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        elif ext in (".jpg", ".jpeg", ".png", ".bmp", ".tiff"):
            return _ocr_image(path)
        elif ext == ".json":
            with open(path, "r", encoding="utf-8") as f:
                return json.dumps(json.load(f), indent=2)
    except Exception as e:
        print(f"[Pipeline] Text extraction failed for {filename}: {e}")
    return ""


def _extract_pdf(path: str) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            return "\n\n".join(page.extract_text() or "" for page in pdf.pages)
    except ImportError:
        return ""
    except Exception as e:
        print(f"[Pipeline] PDF extraction error: {e}")
        return ""


def _ocr_image(path: str) -> str:
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(path)
        return pytesseract.image_to_string(img)
    except ImportError:
        # No OCR available — return placeholder
        return f"[Image file — OCR not available. Install pytesseract for text extraction.]"
    except Exception as e:
        return f"[OCR error: {e}]"


# ── Data Parsers ─────────────────────────────────────────────────────────────

def parse_evidence_data(evidence_type: str, text: str, raw_data: Optional[dict] = None) -> dict:
    """Parse extracted text or raw JSON into structured data."""
    if raw_data:
        return raw_data

    if evidence_type == "autopsy":
        return _parse_autopsy(text)
    elif evidence_type in ("cctv",):
        return _parse_cctv_text(text)
    elif evidence_type in ("calls", "mobile"):
        return _parse_calls_text(text)
    elif evidence_type == "location":
        return _parse_location_text(text)
    elif evidence_type == "iot":
        return _parse_iot_text(text)
    elif evidence_type == "toxicology":
        return _parse_toxicology_text(text)
    return {"raw": text[:2000]}


def _parse_autopsy(text: str) -> dict:
    result = {}
    cod = re.search(r"(?:cause of death|cod)[:\s]+([^\n]+)", text, re.IGNORECASE)
    if cod: result["cause_of_death"] = cod.group(1).strip()
    manner = re.search(r"manner of death[:\s]+([^\n]+)", text, re.IGNORECASE)
    if manner: result["manner_of_death"] = manner.group(1).strip()
    pathologist = re.search(r"(?:pathologist|examining physician)[:\s]+([^\n]+)", text, re.IGNORECASE)
    if pathologist: result["pathologist"] = pathologist.group(1).strip()
    substances = re.findall(r"([\w\s]+):\s+([\d.]+\s*\w+/?\w*)\s*(?:\(lethal[^\)]*\))?", text)
    result["toxicology"] = [{"substance": s.strip(), "level": l.strip()} for s, l in substances if 2 < len(s.strip()) < 30][:10]
    return result


def _parse_cctv_text(text: str) -> dict:
    events = []
    for line in text.splitlines():
        ts = re.search(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}", line)
        if ts:
            events.append({"timestamp": ts.group(), "description": line.strip()})
    return {"cctv_events": events}


def _parse_calls_text(text: str) -> dict:
    records = []
    for line in text.splitlines():
        if not line.strip(): continue
        ts = re.search(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}", line)
        records.append({"timestamp": ts.group() if ts else None, "raw": line.strip()})
    return {"call_records": records}


def _parse_location_text(text: str) -> dict:
    coords = re.findall(r"(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)", text)
    points = [{"lat": float(a), "lng": float(b)} for a, b in coords]
    return {"gps_points": points}


def _parse_iot_text(text: str) -> dict:
    readings = []
    for line in text.splitlines():
        ts = re.search(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}", line)
        val = re.search(r"([\d.]+)\s*(°?[CF]|bpm|lux|ppm|%|Pa)", line)
        if ts or val:
            readings.append({"timestamp": ts.group() if ts else None,
                             "value": val.group(1) if val else None,
                             "unit": val.group(2) if val else None,
                             "raw": line.strip()})
    return {"sensor_readings": readings}


def _parse_toxicology_text(text: str) -> dict:
    return _parse_autopsy(text)  # same pattern


# ── Timeline Event Creation ──────────────────────────────────────────────────

def build_timeline_events_from_parsed(evidence_id: str, case_id: str, evidence_type: str,
                                       parsed_data: dict, filename: str) -> list:
    """Return list of dicts ready to insert as TimelineEvent rows."""
    events = []

    def _ev(ts_str, title, desc="", severity="medium", confidence=0.9, meta=None):
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00").replace(" ", "T"))
        except Exception:
            ts = datetime.utcnow()
        return {
            "case_id": case_id,
            "evidence_id": evidence_id,
            "event_type": evidence_type,
            "category": evidence_type,
            "title": title[:200],
            "description": desc[:500],
            "event_ts": ts,
            "source": filename,
            "confidence": confidence,
            "severity": severity,
            "meta": meta or {},
        }

    if evidence_type == "autopsy":
        cod = parsed_data.get("cause_of_death", "Autopsy finding")
        events.append(_ev(datetime.utcnow().isoformat(), f"Autopsy: {cod[:80]}", "", "critical", 0.95))

    elif evidence_type == "cctv":
        for item in parsed_data.get("cctv_events", []):
            ts = item.get("timestamp") or datetime.utcnow().isoformat()
            events.append(_ev(ts, f"CCTV: {item.get('description','Recording')[:80]}", "", "high", 0.92))

    elif evidence_type in ("calls", "mobile"):
        for rec in parsed_data.get("call_records", []):
            ts = rec.get("timestamp") or datetime.utcnow().isoformat()
            events.append(_ev(ts, f"Call: {rec.get('raw','Record')[:80]}", "", "medium", 0.95))

    elif evidence_type == "location":
        for pt in parsed_data.get("gps_points", []):
            events.append(_ev(datetime.utcnow().isoformat(),
                              f"Location: {pt['lat']:.4f},{pt['lng']:.4f}", "", "medium", 0.96))

    elif evidence_type == "iot":
        for r in parsed_data.get("sensor_readings", []):
            ts = r.get("timestamp") or datetime.utcnow().isoformat()
            events.append(_ev(ts, f"IoT: {r.get('value','?')} {r.get('unit','')}", r.get("raw",""), "low", 0.88))

    return events


def process_json_evidence(case_id: str, evidence_type: str, json_data: dict) -> dict:
    """
    Process JSON evidence submitted directly (no file upload).
    Returns parsed_data dict ready for DB storage + list of timeline events.
    """
    ev_id = str(uuid.uuid4())
    events = build_timeline_events_from_parsed(ev_id, case_id, evidence_type, json_data,
                                               f"{evidence_type}_json_import")
    return {"evidence_id": ev_id, "parsed_data": json_data, "events": events}

"""
File Upload Router — evidence ingestion with SHA-256, OCR, and timeline creation.
POST /upload/{case_id}   — multipart file upload
GET  /upload/{case_id}   — list uploaded evidence for case
"""
import os
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from backend.services.case_store import case_store
from backend.services.evidence_pipeline import (
    save_uploaded_file, sha256_bytes, extract_text,
    parse_evidence_data, build_timeline_events_from_parsed,
)
from backend.services.auth_service import get_current_user

router = APIRouter()

EVIDENCE_TYPES = {"autopsy","cctv","mobile","calls","location","toxicology","iot","document"}


@router.post("/{case_id}")
async def upload_evidence(
    case_id: str,
    evidence_type: str = Form(...),
    file: UploadFile = File(...),
    uploader: str = Form(default="investigator"),
    user: dict = Depends(get_current_user),
):
    """Upload a file as evidence for a case. Runs extraction pipeline automatically."""
    if case_store.get_case(case_id) is None:
        raise HTTPException(status_code=404, detail="Case not found")
    if evidence_type not in EVIDENCE_TYPES:
        raise HTTPException(status_code=400, detail=f"evidence_type must be one of {EVIDENCE_TYPES}")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    file_hash = sha256_bytes(data)
    file_path = save_uploaded_file(case_id, evidence_type, file.filename or "upload.bin", data)
    file_size = len(data)

    # Extract and parse
    extracted_text = extract_text(file_path, file.filename or "")
    parsed_data = parse_evidence_data(evidence_type, extracted_text)

    # Store in DB
    ev_id = _store_evidence_db(
        case_id=case_id,
        evidence_type=evidence_type,
        filename=file.filename or "upload.bin",
        file_path=file_path,
        sha256=file_hash,
        size_bytes=file_size,
        uploader=uploader,
        extracted_text=extracted_text,
        parsed_data=parsed_data,
    )

    # Create timeline events
    events = build_timeline_events_from_parsed(ev_id, case_id, evidence_type, parsed_data, file.filename or "")
    _store_timeline_events_db(events)

    # Update in-memory case store (evidence counts)
    _update_case_store_from_upload(case_id, evidence_type, parsed_data)

    # Audit log
    _write_audit(case_id, user.get("username","investigator"), "upload",
                 "evidence", ev_id, {"evidence_type": evidence_type, "filename": file.filename})

    return {
        "evidence_id": ev_id,
        "case_id": case_id,
        "evidence_type": evidence_type,
        "filename": file.filename,
        "sha256": file_hash,
        "size_bytes": file_size,
        "status": "ready",
        "extracted_text_length": len(extracted_text),
        "timeline_events_created": len(events),
        "parsed_fields": list(parsed_data.keys()),
    }


@router.get("/{case_id}")
def list_evidence(case_id: str, user: dict = Depends(get_current_user)):
    """Return all uploaded evidence records for a case."""
    if case_store.get_case(case_id) is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"case_id": case_id, "evidence": case_store.get_db_evidence(case_id)}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _store_evidence_db(case_id, evidence_type, filename, file_path, sha256, size_bytes,
                        uploader, extracted_text, parsed_data) -> str:
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import Evidence
        db = SessionLocal()
        ev = Evidence(
            case_id=case_id, evidence_type=evidence_type,
            filename=filename, file_path=file_path,
            sha256=sha256, size_bytes=size_bytes,
            status="ready", uploader=uploader,
            extracted_text=extracted_text, parsed_data=parsed_data,
        )
        db.add(ev); db.commit(); ev_id = ev.id; db.close()
        return ev_id
    except Exception as e:
        print(f"[Upload] DB store failed: {e}")
        import uuid; return str(uuid.uuid4())


def _store_timeline_events_db(events: list):
    if not events: return
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import TimelineEvent
        db = SessionLocal()
        for ev in events:
            db.add(TimelineEvent(**ev))
        db.commit(); db.close()
    except Exception as e:
        print(f"[Upload] Timeline DB insert failed: {e}")


def _update_case_store_from_upload(case_id: str, evidence_type: str, parsed_data: dict):
    """Mirror parsed data into in-memory case store for backward compat."""
    type_map = {
        "cctv": ("cctv", parsed_data.get("cctv_events", [])),
        "calls": ("phone_metadata", parsed_data.get("call_records", [])),
        "mobile": ("phone_metadata", parsed_data.get("call_records", [])),
        "location": ("gps_data", parsed_data.get("gps_points", [])),
        "iot": ("iot_sensors", parsed_data.get("sensor_readings", [])),
    }
    if evidence_type in type_map:
        key, items = type_map[evidence_type]
        if items:
            case_store.add_evidence(case_id, key, items)


def _write_audit(case_id, user, action, entity_type, entity_id, after_state):
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import AuditLog
        db = SessionLocal()
        db.add(AuditLog(case_id=case_id, user_id=user, action=action,
                        entity_type=entity_type, entity_id=entity_id, after_state=after_state))
        db.commit(); db.close()
    except Exception as e:
        print(f"[Audit] Write failed: {e}")

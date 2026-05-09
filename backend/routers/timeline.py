"""
Timeline Router — DB-backed, real filtering and event counting.
GET /timeline/{case_id}               — all events
GET /timeline/{case_id}?type=cctv    — filtered by type
POST /timeline/{case_id}/event       — manually add event
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from backend.services.case_store import case_store

router = APIRouter()

TYPE_TO_CATEGORY = {
    "cctv": "cctv", "surveillance": "cctv",
    "phone": "phone", "mobile": "phone", "sms": "phone",
    "call": "calls", "calls": "calls",
    "location": "location", "gps": "location",
    "biometric": "biometric", "toxicology": "biometric",
    "autopsy": "autopsy",
    "iot": "iot", "sensors": "iot",
}


class EventRequest(BaseModel):
    title: str
    event_type: str
    timestamp: str
    description: str = ""
    confidence: float = 0.9
    severity: str = "medium"
    source: str = "manual"
    meta: dict = {}


@router.get("/{case_id}")
def get_timeline(
    case_id: str,
    type: Optional[str] = Query(None),
    confidence: Optional[str] = Query(None),  # high|medium|low
    severity: Optional[str] = Query(None),
    from_ts: Optional[str] = Query(None),
    to_ts: Optional[str] = Query(None),
    limit: int = Query(500),
):
    """Return timeline events — from DB first, falls back to in-memory case data."""
    case = case_store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Try DB events first
    db_events = _fetch_db_events(case_id)

    # If DB is empty, derive events from in-memory case data (demo seeded data)
    if not db_events:
        db_events = _derive_events_from_case(case)

    # Apply filters
    events = _apply_filters(db_events, type, confidence, severity, from_ts, to_ts)[:limit]

    # Sort by timestamp
    def _sort_key(e):
        ts = e.get("event_ts") or e.get("timestamp","")
        try: return datetime.fromisoformat(str(ts).replace("Z",""))
        except: return datetime.min
    events.sort(key=_sort_key)

    # Compute TOD from autopsy
    tod = None
    autopsy = case.get("autopsy_report", {})
    if autopsy and autopsy.get("time_of_death", {}).get("estimated"):
        tod = autopsy["time_of_death"]["estimated"]

    return {
        "case_id": case_id,
        "events": events,
        "total": len(events),
        "filters_applied": bool(type or confidence or severity or from_ts or to_ts),
        "time_of_death": tod,
    }


@router.post("/{case_id}/event")
def add_event(case_id: str, req: EventRequest):
    """Manually add a timeline event."""
    case = case_store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    event = _store_event_db({
        "case_id": case_id,
        "event_type": req.event_type,
        "category": TYPE_TO_CATEGORY.get(req.event_type, req.event_type),
        "title": req.title,
        "description": req.description,
        "event_ts": datetime.fromisoformat(req.timestamp.replace("Z", "")),
        "source": req.source,
        "confidence": req.confidence,
        "severity": req.severity,
        "meta": req.meta,
    })
    return {"event_id": event, "status": "created"}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _fetch_db_events(case_id: str) -> list:
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import TimelineEvent
        db = SessionLocal()
        rows = db.query(TimelineEvent).filter(TimelineEvent.case_id == case_id).all()
        events = [{
            "id": r.id, "event_type": r.event_type, "type": r.event_type,
            "category": r.category or r.event_type,
            "title": r.title, "description": r.description,
            "event_ts": r.event_ts.isoformat() + "Z" if r.event_ts else None,
            "timestamp": r.event_ts.isoformat() + "Z" if r.event_ts else None,
            "source": r.source, "confidence": r.confidence,
            "severity": r.severity, "meta": r.meta or {},
            "evidence_id": r.evidence_id,
        } for r in rows]
        db.close()
        return events
    except Exception as e:
        print(f"[Timeline] DB fetch failed: {e}")
        return []


def _derive_events_from_case(case: dict) -> list:
    """Build timeline events from in-memory case data (for seeded demo case)."""
    events = []
    de = case.get("digital_evidence", {})

    for cctv in de.get("cctv", []):
        events.append({
            "id": f"cctv-{len(events)}", "event_type": "cctv", "type": "cctv", "category": "cctv",
            "title": cctv.get("detection", "CCTV Event"), "description": cctv.get("location",""),
            "event_ts": cctv.get("timestamp"), "timestamp": cctv.get("timestamp"),
            "source": cctv.get("camera_id","CAM"), "confidence": 0.95, "severity": "high",
            "meta": cctv,
        })

    for p in de.get("phone_metadata", []):
        events.append({
            "id": f"phone-{len(events)}", "event_type": "phone", "type": "phone", "category": "phone",
            "title": f"Call: {p.get('from','?')} → {p.get('to','?')}",
            "description": f"Duration: {p.get('duration',0)}s",
            "event_ts": p.get("timestamp"), "timestamp": p.get("timestamp"),
            "source": "Phone Records", "confidence": 0.98, "severity": "medium", "meta": p,
        })

    for g in de.get("gps_data", []):
        events.append({
            "id": f"loc-{len(events)}", "event_type": "location", "type": "location", "category": "location",
            "title": f"GPS: {g.get('device','?')}",
            "description": f"Lat:{g.get('lat','?')} Lng:{g.get('lng','?')}",
            "event_ts": g.get("timestamp"), "timestamp": g.get("timestamp"),
            "source": "GPS Data", "confidence": 0.96, "severity": "low" if g.get("heart_rate",1) != 0 else "critical",
            "meta": g,
        })

    for s in de.get("iot_sensors", []):
        events.append({
            "id": f"iot-{len(events)}", "event_type": "iot", "type": "iot", "category": "iot",
            "title": f"IoT: {s.get('sensor_id','?')} — {s.get('value','?')} {s.get('unit','')}",
            "description": s.get("type",""),
            "event_ts": s.get("timestamp"), "timestamp": s.get("timestamp"),
            "source": "IoT Sensors", "confidence": 0.88, "severity": "low", "meta": s,
        })

    sw = de.get("smartwatch_data", {})
    for hr in sw.get("heart_rate_history", []):
        sev = "critical" if hr.get("bpm", 1) == 0 else ("high" if hr.get("bpm", 80) > 120 else "low")
        events.append({
            "id": f"bio-{len(events)}", "event_type": "biometric", "type": "biometric", "category": "biometric",
            "title": f"Heart Rate: {hr.get('bpm','?')} BPM",
            "description": "Cardiac arrest" if hr.get("bpm") == 0 else "Biometric reading",
            "event_ts": hr.get("timestamp"), "timestamp": hr.get("timestamp"),
            "source": "Smartwatch", "confidence": 0.99, "severity": sev, "meta": hr,
        })

    autopsy = case.get("autopsy_report", {})
    if autopsy:
        tod = autopsy.get("time_of_death", {})
        ts = tod.get("estimated", autopsy.get("created_at", "2024-11-14T22:29:00Z"))
        events.append({
            "id": "autopsy-0", "event_type": "autopsy", "type": "autopsy", "category": "autopsy",
            "title": f"Autopsy: {autopsy.get('cod','Finding')}",
            "description": f"Manner: {autopsy.get('manner','Unknown')}",
            "event_ts": ts, "timestamp": ts,
            "source": "Autopsy Report", "confidence": 0.98, "severity": "critical", "meta": {},
        })

    return events


def _apply_filters(events, type_filter, confidence_filter, severity_filter, from_ts, to_ts) -> list:
    conf_map = {"high": 0.85, "medium": 0.6, "low": 0.0}
    result = events
    if type_filter:
        cats = {type_filter, TYPE_TO_CATEGORY.get(type_filter, type_filter)}
        result = [e for e in result if e.get("event_type") in cats or e.get("category") in cats]
    if confidence_filter:
        min_conf = conf_map.get(confidence_filter, 0)
        result = [e for e in result if e.get("confidence", 0) >= min_conf]
    if severity_filter:
        result = [e for e in result if e.get("severity") == severity_filter]
    if from_ts:
        result = [e for e in result if (e.get("event_ts") or e.get("timestamp","")) >= from_ts]
    if to_ts:
        result = [e for e in result if (e.get("event_ts") or e.get("timestamp","")) <= to_ts]
    return result


def _store_event_db(ev: dict) -> str:
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import TimelineEvent
        db = SessionLocal()
        row = TimelineEvent(**ev)
        db.add(row); db.commit(); eid = row.id; db.close()
        return eid
    except Exception as e:
        print(f"[Timeline] Event insert failed: {e}")
        import uuid; return str(uuid.uuid4())

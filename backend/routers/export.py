"""
Export Router — report generation and file downloads.
GET /export/{case_id}/report   — HTML forensic report
GET /export/{case_id}/manifest — evidence manifest CSV
GET /export/{case_id}/custody  — chain-of-custody JSON certificate
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import HTMLResponse, PlainTextResponse, JSONResponse, Response
from backend.services.case_store import case_store
from backend.services.report_service import generate_html_report, export_manifest_csv
from backend.services.auth_service import get_current_user
from backend.services.ai_service import calculate_risk_score, generate_key_findings, generate_ai_summary

router = APIRouter()


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


@router.get("/{case_id}/report", response_class=HTMLResponse)
def export_report(case_id: str, user: dict = Depends(get_current_user)):
    """Generate and return a full HTML forensic investigation report."""
    case = case_store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Build risk data
    risk = case.get("risk_assessment") or calculate_risk_score(case)
    ai_summary = generate_ai_summary(case, risk.get("overall_score", 0), risk.get("components", []))
    key_findings = generate_key_findings(case, risk)

    # Fetch DB timeline events
    timeline_events = _fetch_timeline(case_id)

    # Fetch DB evidence list
    evidence_list = case_store.get_db_evidence(case_id)

    # Fetch audit log
    audit_log = _fetch_audit(case_id, 50)

    # Enrich risk with AI data
    risk_enriched = dict(risk)
    risk_enriched["ai_summary"] = ai_summary
    risk_enriched["key_findings"] = key_findings

    html = generate_html_report(
        case_data=case,
        risk_data=risk_enriched,
        timeline_events=timeline_events,
        evidence_list=evidence_list,
        audit_log=audit_log,
    )

    # Write audit log for export
    _write_audit(case_id, user.get("username","investigator"), "export", "report", case_id,
                 {"format": "html", "events": len(timeline_events), "evidence": len(evidence_list)})

    return HTMLResponse(
        content=html,
        headers={"Content-Disposition": f'attachment; filename="report_{case_id}.html"'}
    )


@router.get("/{case_id}/manifest")
def export_manifest(case_id: str, user: dict = Depends(get_current_user)):
    """Download evidence manifest as CSV."""
    case = case_store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence_list = case_store.get_db_evidence(case_id)

    # Also include legacy evidence from case_data
    de = case.get("digital_evidence", {})
    for etype, items in de.items():
        if isinstance(items, list):
            for item in items:
                evidence_list.append({"evidence_type": etype, "filename": etype,
                                      "sha256": "in-memory", "size_bytes": 0,
                                      "status": "legacy", "uploaded_at": "", "uploader": "system"})

    csv = export_manifest_csv(evidence_list)
    _write_audit(case_id, user.get("username","investigator"), "export", "manifest", case_id, {})
    return Response(
        content=csv,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="manifest_{case_id}.csv"'}
    )


@router.get("/{case_id}/custody")
def export_custody(case_id: str, user: dict = Depends(get_current_user)):
    """Download chain-of-custody certificate as JSON."""
    case = case_store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    verification = case_store.verify_chain(case_id)
    chain = case.get("evidence_chain", [])

    _write_audit(case_id, user.get("username","investigator"), "export", "custody", case_id, {})

    import json
    from datetime import datetime
    certificate = {
        "case_id": case_id,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "generated_by": user.get("username","investigator"),
        "chain_status": "INTACT" if verification.get("valid") else "BROKEN",
        "total_blocks": len(chain),
        "verification": verification,
        "ledger_type": "SHA-256 Hash Chain",
        "blocks": chain,
        "legal_notice": "This certificate represents the cryptographic integrity of all evidence in this case.",
    }
    return Response(
        content=json.dumps(certificate, indent=2, default=str),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="custody_{case_id}.json"'}
    )


# ── DB Helpers ────────────────────────────────────────────────────────────────

def _fetch_timeline(case_id: str) -> list:
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import TimelineEvent
        db = SessionLocal()
        rows = db.query(TimelineEvent).filter(TimelineEvent.case_id == case_id).order_by(TimelineEvent.event_ts).all()
        result = [{"title": r.title, "event_ts": str(r.event_ts), "timestamp": str(r.event_ts),
                   "event_type": r.event_type, "type": r.event_type, "confidence": r.confidence,
                   "severity": r.severity, "description": r.description} for r in rows]
        db.close()
        return result
    except Exception:
        return []


def _fetch_audit(case_id: str, limit: int) -> list:
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import AuditLog
        db = SessionLocal()
        rows = db.query(AuditLog).filter(AuditLog.case_id == case_id).order_by(AuditLog.timestamp.desc()).limit(limit).all()
        result = [{"action": r.action, "user_id": r.user_id, "timestamp": str(r.timestamp),
                   "entity_type": r.entity_type, "entity_id": r.entity_id} for r in rows]
        db.close()
        return result
    except Exception:
        return []

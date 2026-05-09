"""
Risk Router — real risk scoring with persistence to RiskAssessment table.
GET  /risk/{case_id}          — get current risk assessment
POST /risk/{case_id}/recompute — force full recomputation
"""
from fastapi import APIRouter, HTTPException, Depends
from backend.services.case_store import case_store
from backend.services.ai_service import (
    calculate_risk_score, calculate_shap_values,
    generate_ai_summary, generate_key_findings,
)
from backend.services.auth_service import get_current_user

router = APIRouter()


@router.get("/{case_id}")
def get_risk(case_id: str):
    """Return current risk assessment. Computes if not cached."""
    case = case_store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Try DB cache first
    stored = _fetch_risk_db(case_id)
    if stored:
        return stored

    # Compute and cache
    return _compute_and_store(case_id, case)


@router.post("/{case_id}/recompute")
def recompute_risk(case_id: str, user: dict = Depends(get_current_user)):
    """Force full risk recomputation with fresh Featherless AI summary."""
    case = case_store.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    result = _compute_and_store(case_id, case, force=True)
    _write_audit(case_id, user.get("username","investigator"), "recompute_risk", "risk", case_id, {})
    return result


# ── Internal ──────────────────────────────────────────────────────────────────

def _compute_and_store(case_id: str, case: dict, force: bool = False) -> dict:
    risk = calculate_risk_score(case)
    shap = calculate_shap_values(case, risk)
    ai_summary = generate_ai_summary(case, risk["overall_score"], risk["components"])
    key_findings = generate_key_findings(case, risk)

    result = {
        "case_id": case_id,
        "overall_score": risk["overall_score"],
        "severity": risk["severity"],
        "components": risk["components"],
        "recommendation": risk.get("recommendation",""),
        "shap": shap,
        "ai_summary": ai_summary,
        "key_findings": key_findings,
        # Legacy field names for backward compat
        "case_risk": {
            "overall_score": risk["overall_score"],
            "severity": risk["severity"],
        },
        "risk_factors": [c["factor"] for c in risk["components"]],
    }

    # Persist to DB
    _store_risk_db(case_id, risk, shap, ai_summary, key_findings)

    # Update in-memory case
    case_store.update_case(case_id, {"risk_assessment": risk})

    return result


def _fetch_risk_db(case_id: str):
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import RiskAssessment
        db = SessionLocal()
        r = db.query(RiskAssessment).filter(RiskAssessment.case_id == case_id).first()
        if not r:
            db.close()
            return None
        result = {
            "case_id": case_id,
            "overall_score": r.overall_score,
            "severity": r.severity,
            "components": r.components or [],
            "recommendation": r.recommendation or "",
            "shap": {"attributions": r.shap_values or []},
            "ai_summary": r.ai_summary or "",
            "key_findings": r.key_findings or [],
            "case_risk": {"overall_score": r.overall_score, "severity": r.severity},
            "risk_factors": [c["factor"] for c in (r.components or [])],
            "computed_at": str(r.computed_at),
        }
        db.close()
        return result
    except Exception:
        return None


def _store_risk_db(case_id, risk, shap, ai_summary, key_findings):
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import RiskAssessment
        from datetime import datetime
        db = SessionLocal()
        existing = db.query(RiskAssessment).filter(RiskAssessment.case_id == case_id).first()
        if existing:
            existing.overall_score = risk["overall_score"]
            existing.severity      = risk["severity"]
            existing.components    = risk["components"]
            existing.shap_values   = shap.get("attributions", [])
            existing.ai_summary    = ai_summary
            existing.key_findings  = key_findings
            existing.recommendation= risk.get("recommendation","")
            existing.computed_at   = datetime.utcnow()
        else:
            db.add(RiskAssessment(
                case_id=case_id,
                overall_score=risk["overall_score"],
                severity=risk["severity"],
                components=risk["components"],
                shap_values=shap.get("attributions",[]),
                ai_summary=ai_summary,
                key_findings=key_findings,
                recommendation=risk.get("recommendation",""),
            ))
        db.commit(); db.close()
    except Exception as e:
        print(f"[Risk] DB store failed: {e}")


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

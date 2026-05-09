"""
Human Review Router — investigators approve, reject, tag, or annotate AI findings.
POST /review/{case_id}/action  — submit a review action (persisted to DB)
GET  /review/{case_id}         — get all review actions for case
GET  /review/{case_id}/audit   — full audit trail for case
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from backend.services.case_store import case_store
from backend.services.auth_service import get_current_user

router = APIRouter()


class ReviewRequest(BaseModel):
    action: str                    # approve | reject | tag | annotate
    target_type: str = "finding"   # finding | suspect | evidence
    target_id: Optional[str] = None
    evidence_id: Optional[str] = None
    note: Optional[str] = None
    tags: List[str] = []


@router.post("/{case_id}/action")
def submit_review(case_id: str, req: ReviewRequest, user: dict = Depends(get_current_user)):
    """Persist a human review action. Updates UI immediately via DB record."""
    if case_store.get_case(case_id) is None:
        raise HTTPException(status_code=404, detail="Case not found")

    valid_actions = {"approve", "reject", "tag", "annotate", "flag"}
    if req.action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"action must be one of {valid_actions}")

    review_id = _store_review(
        case_id=case_id,
        reviewer=user.get("username", "investigator"),
        action=req.action,
        target_type=req.target_type,
        target_id=req.target_id,
        evidence_id=req.evidence_id,
        note=req.note,
        tags=req.tags,
    )

    # Also write to audit log
    _write_audit(case_id, user.get("username","investigator"), f"review:{req.action}",
                 req.target_type, req.target_id or review_id,
                 {"action": req.action, "note": req.note, "tags": req.tags})

    return {
        "review_id": review_id,
        "case_id": case_id,
        "action": req.action,
        "target_type": req.target_type,
        "target_id": req.target_id,
        "reviewer": user.get("username"),
        "note": req.note,
        "tags": req.tags,
        "status": "persisted",
    }


@router.get("/{case_id}")
def get_reviews(case_id: str, user: dict = Depends(get_current_user)):
    """Return all review actions for a case."""
    if case_store.get_case(case_id) is None:
        raise HTTPException(status_code=404, detail="Case not found")
    reviews = _fetch_reviews(case_id)
    return {"case_id": case_id, "total": len(reviews), "reviews": reviews}


@router.get("/{case_id}/audit")
def get_audit_trail(case_id: str, limit: int = 100, user: dict = Depends(get_current_user)):
    """Full immutable audit trail for a case."""
    if case_store.get_case(case_id) is None:
        raise HTTPException(status_code=404, detail="Case not found")
    logs = _fetch_audit(case_id, limit)
    return {"case_id": case_id, "total_entries": len(logs), "audit_trail": logs}


# ── DB Helpers ────────────────────────────────────────────────────────────────

def _store_review(case_id, reviewer, action, target_type, target_id, evidence_id, note, tags) -> str:
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import ReviewAction
        db = SessionLocal()
        r = ReviewAction(case_id=case_id, reviewer=reviewer, action=action,
                         target_type=target_type, target_id=target_id,
                         evidence_id=evidence_id, note=note, tags=tags)
        db.add(r); db.commit(); rid = r.id; db.close()
        return rid
    except Exception as e:
        print(f"[Review] DB store failed: {e}")
        import uuid; return str(uuid.uuid4())


def _fetch_reviews(case_id: str) -> list:
    try:
        from backend.db.database import SessionLocal
        from backend.db.models import ReviewAction
        db = SessionLocal()
        rows = db.query(ReviewAction).filter(ReviewAction.case_id == case_id).order_by(ReviewAction.timestamp.desc()).all()
        result = [{"id": r.id, "reviewer": r.reviewer, "action": r.action,
                   "target_type": r.target_type, "target_id": r.target_id,
                   "note": r.note, "tags": r.tags, "timestamp": str(r.timestamp)} for r in rows]
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
        result = [{"id": r.id, "user_id": r.user_id, "action": r.action,
                   "entity_type": r.entity_type, "entity_id": r.entity_id,
                   "after_state": r.after_state, "timestamp": str(r.timestamp)} for r in rows]
        db.close()
        return result
    except Exception:
        return []


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

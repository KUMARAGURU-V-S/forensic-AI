"""Cases Router"""
from fastapi import APIRouter, HTTPException
from backend.services.demo_data import DEMO_CASES, get_case_by_id

router = APIRouter()

@router.get("/")
def list_cases():
    return [{"id": c["id"], "title": c["title"], "status": c["status"], "priority": c["priority"],
             "classification": c["classification"], "created_at": c["created_at"], "updated_at": c["updated_at"],
             "lead_investigator": c["lead_investigator"], "victim_name": c["victim"]["name"],
             "suspect_count": len(c["suspects"]), "risk_score": c["ai_findings"]["correlation_score"]} for c in DEMO_CASES]

@router.get("/{case_id}")
def get_case(case_id: str):
    case = get_case_by_id(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    return case

@router.get("/{case_id}/suspects")
def get_suspects(case_id: str):
    case = get_case_by_id(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    return case["suspects"]

@router.get("/{case_id}/autopsy")
def get_autopsy(case_id: str):
    case = get_case_by_id(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    return case["autopsy_report"]

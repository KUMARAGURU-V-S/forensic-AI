"""Cases Router - Now with real case creation"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from backend.services.case_store import case_store

router = APIRouter()

class CreateCaseRequest(BaseModel):
    title: str
    victim_name: str
    victim_age: Optional[int] = None
    victim_gender: Optional[str] = None
    victim_occupation: Optional[str] = None
    victim_location: Optional[str] = None
    classification: str = "Under Investigation"
    lead_investigator: str = ""
    priority: str = "medium"

class AddSuspectRequest(BaseModel):
    name: str
    relationship: str
    flags: List[str] = []

class AddEvidenceRequest(BaseModel):
    evidence_type: str  # cctv, phone_metadata, gps_data, iot_sensors
    data: dict

@router.get("/")
def list_cases():
    cases = case_store.get_all_cases()
    return [{"id": c["id"], "title": c["title"], "status": c["status"], "priority": c["priority"],
             "classification": c["classification"], "created_at": c["created_at"], "updated_at": c["updated_at"],
             "lead_investigator": c["lead_investigator"], "victim_name": c["victim"]["name"],
             "suspect_count": len(c.get("suspects", [])),
             "risk_score": c.get("risk_assessment", {}).get("overall_score", 0) if c.get("risk_assessment") else 0,
             "has_ai_analysis": c.get("ai_analysis") is not None
            } for c in cases]

@router.get("/{case_id}")
def get_case(case_id: str):
    case = case_store.get_case(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    return case

@router.post("/")
def create_case(req: CreateCaseRequest):
    victim = {"name": req.victim_name, "age": req.victim_age, "gender": req.victim_gender,
              "occupation": req.victim_occupation, "last_known_location": req.victim_location}
    case = case_store.create_case(title=req.title, victim=victim, classification=req.classification,
                                  lead_investigator=req.lead_investigator, priority=req.priority)
    return case

@router.post("/{case_id}/suspects")
def add_suspect(case_id: str, req: AddSuspectRequest):
    case = case_store.get_case(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    case_store.add_suspect(case_id, {"name": req.name, "relationship": req.relationship, "flags": req.flags})
    return {"message": "Suspect added", "suspects": case_store.get_case(case_id)["suspects"]}

@router.post("/{case_id}/evidence")
def add_evidence(case_id: str, req: AddEvidenceRequest):
    case = case_store.get_case(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    case_store.add_evidence(case_id, req.evidence_type, req.data)
    return {"message": f"Evidence added to {req.evidence_type}", "chain_length": len(case_store.get_case(case_id).get("evidence_chain", []))}

@router.post("/{case_id}/autopsy-report")
def submit_autopsy_report(case_id: str, report: dict):
    """Submit raw autopsy report text for AI analysis."""
    case = case_store.get_case(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    case_store.update_case(case_id, {"autopsy_report": report})
    return {"message": "Autopsy report submitted", "case_id": case_id}

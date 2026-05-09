"""Analysis Router - REAL AI analysis using HF Inference API"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.services.case_store import case_store
from backend.services.ai_service import (
    analyze_autopsy_llm, extract_entities_ner, estimate_tod_multimethod,
    calculate_risk_score, calculate_shap_values
)

router = APIRouter()

class TODRequest(BaseModel):
    body_temp: float
    ambient_temp: float
    body_weight_kg: float = 70.0
    corrective_factor: float = 1.0
    rigor_mortis: str = ""
    livor_mortis: str = ""
    vitreous_potassium: Optional[float] = None

class AutopsyTextRequest(BaseModel):
    text: str

@router.get("/autopsy/{case_id}")
def analyze_autopsy(case_id: str):
    """AI analysis of autopsy report using NER + LLM."""
    case = case_store.get_case(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    
    autopsy = case.get("autopsy_report")
    if not autopsy:
        raise HTTPException(status_code=400, detail="No autopsy report submitted for this case")
    
    # Get raw text
    raw_text = autopsy.get("raw_text", "")
    if not raw_text:
        # Build text from structured data
        raw_text = f"Cause of death: {autopsy.get('cod', 'Unknown')}. Manner: {autopsy.get('manner', 'Unknown')}."
        if autopsy.get("injuries"):
            raw_text += " Injuries: " + "; ".join(f"{i['type']} on {i['location']}" for i in autopsy["injuries"])
        if autopsy.get("toxicology", {}).get("findings"):
            raw_text += " Toxicology: " + "; ".join(f"{t['substance']}: {t['level']}" for t in autopsy["toxicology"]["findings"])
    
    # Step 1: NER extraction
    entities = extract_entities_ner(raw_text)
    
    # Step 2: LLM structured analysis
    llm_analysis = analyze_autopsy_llm(raw_text)
    
    # Store the AI analysis
    result = {
        "case_id": case_id,
        "ner_entities": entities,
        "structured_analysis": llm_analysis,
        "raw_text_length": len(raw_text),
        "processing": {
            "ner_model": "d4data/biomedical-ner-all",
            "llm_model": llm_analysis.get("ai_model", "unknown"),
            "confidence": llm_analysis.get("confidence", 0)
        }
    }
    
    case_store.update_case(case_id, {"ai_analysis": result})
    return result

@router.post("/autopsy-text")
def analyze_autopsy_text(req: AutopsyTextRequest):
    """Analyze raw autopsy text without associating to a case (standalone)."""
    entities = extract_entities_ner(req.text)
    llm_analysis = analyze_autopsy_llm(req.text)
    return {
        "ner_entities": entities,
        "structured_analysis": llm_analysis,
        "raw_text_length": len(req.text),
    }

@router.post("/tod")
def estimate_time_of_death(req: TODRequest):
    """Real Henssge nomogram + multi-method TOD estimation."""
    result = estimate_tod_multimethod(
        body_temp=req.body_temp,
        ambient_temp=req.ambient_temp,
        body_weight_kg=req.body_weight_kg,
        rigor_mortis=req.rigor_mortis,
        livor_mortis=req.livor_mortis,
        vitreous_potassium=req.vitreous_potassium
    )
    return result

@router.get("/tod/{case_id}")
def estimate_tod_from_case(case_id: str):
    """Estimate TOD from case autopsy data."""
    case = case_store.get_case(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    
    autopsy = case.get("autopsy_report", {})
    tod_data = autopsy.get("time_of_death", {})
    
    if not tod_data or not tod_data.get("body_temp_at_scene"):
        raise HTTPException(status_code=400, detail="No time-of-death data in autopsy report")
    
    result = estimate_tod_multimethod(
        body_temp=tod_data["body_temp_at_scene"],
        ambient_temp=tod_data.get("ambient_temp", 20.0),
        body_weight_kg=tod_data.get("body_weight_kg", 70),
        rigor_mortis=tod_data.get("rigor_mortis", ""),
        livor_mortis=tod_data.get("livor_mortis", ""),
        vitreous_potassium=tod_data.get("vitreous_potassium")
    )
    result["case_id"] = case_id
    return result

@router.get("/explainability/{case_id}")
def get_explainability(case_id: str):
    """Real SHAP + LIME explainability for the case risk score."""
    case = case_store.get_case(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    
    # Calculate or use cached risk
    risk = case.get("risk_assessment")
    if not risk:
        risk = calculate_risk_score(case)
        case_store.update_case(case_id, {"risk_assessment": risk})
    
    # Calculate SHAP values
    shap_result = calculate_shap_values(case, risk)
    shap_result["case_id"] = case_id
    return shap_result

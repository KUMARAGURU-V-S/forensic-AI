"""Risk Scoring Router - Real anomaly detection"""
from fastapi import APIRouter, HTTPException
from backend.services.case_store import case_store
from backend.services.ai_service import calculate_risk_score, calculate_shap_values

router = APIRouter()

@router.get("/{case_id}")
def get_risk_assessment(case_id: str):
    """Calculate real risk scores for a case."""
    case = case_store.get_case(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    
    # Calculate real risk
    risk = calculate_risk_score(case)
    
    # Calculate per-suspect risk
    suspects_risk = []
    for suspect in case.get("suspects", []):
        # Individual suspect scoring based on their flags
        flag_weights = {
            "financial_motive": 25, "proximity_confirmed": 30, "encrypted_communications": 20,
            "insurance_beneficiary": 22, "alibi_inconsistent": 18, "previous_incidents": 22,
            "safety_violations": 20, "insurance_fraud_suspected": 25, "weapon_possession": 30,
            "threatening_behavior": 25, "deleted_evidence": 28, "false_statement": 20
        }
        s_score = sum(flag_weights.get(f, 10) for f in suspect.get("flags", []))
        s_score = min(100, s_score)
        
        suspects_risk.append({
            "suspect_id": suspect["id"],
            "name": suspect["name"],
            "relationship": suspect.get("relationship", ""),
            "overall_risk_score": s_score,
            "risk_level": "critical" if s_score > 80 else ("high" if s_score > 60 else ("medium" if s_score > 40 else "low")),
            "flags": suspect.get("flags", []),
            "flag_contributions": {f: flag_weights.get(f, 10) for f in suspect.get("flags", [])},
            "recommendation": "Immediate priority target" if s_score > 80 else "Requires further investigation"
        })
    
    # Store result
    case_store.update_case(case_id, {"risk_assessment": risk})
    
    # Build risk matrix from components
    categories = []
    component_names = {
        "Toxicology": "Physical Evidence", "CCTV": "Digital Correlation",
        "Communication": "Behavioral Analysis", "GPS": "Temporal Alignment",
        "IoT": "Environmental Data", "Suspect": "Motive Indicators"
    }
    for comp in risk.get("components", []):
        cat_name = "Other"
        for key, name in component_names.items():
            if key.lower() in comp["factor"].lower():
                cat_name = name
                break
        categories.append({"name": cat_name, "score": comp["score"], "max": 100})
    
    return {
        "case_id": case_id,
        "case_risk": risk,
        "suspects_risk": suspects_risk,
        "risk_matrix": {"categories": categories if categories else [
            {"name": "No evidence analyzed", "score": 0, "max": 100}
        ]},
        "recommendation": risk.get("recommendation", ""),
        "ai_confidence": {"model": "Multi-factor Weighted Scoring + Anomaly Detection", "method": "Real-time calculation"}
    }

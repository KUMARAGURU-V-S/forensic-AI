"""Risk Scoring Router"""
from fastapi import APIRouter, HTTPException
from backend.services.demo_data import get_case_by_id

router = APIRouter()

@router.get("/{case_id}")
def get_risk_assessment(case_id: str):
    case = get_case_by_id(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    flag_weights = {"financial_motive": 0.25, "proximity_confirmed": 0.30, "encrypted_communications": 0.15,
                    "insurance_beneficiary": 0.20, "alibi_inconsistent": 0.18, "previous_incidents": 0.22,
                    "safety_violations": 0.20, "insurance_fraud_suspected": 0.25}
    suspects_risk = []
    for suspect in case["suspects"]:
        factors = [{"factor": f.replace("_", " ").title(), "weight": flag_weights.get(f, 0.10),
                    "contribution": round(flag_weights.get(f, 0.10) * 100 / max(len(suspect["flags"]), 1), 1)} for f in suspect["flags"]]
        suspects_risk.append({"suspect_id": suspect["id"], "name": suspect["name"], "overall_risk_score": suspect["risk_score"],
            "risk_level": "critical" if suspect["risk_score"] > 80 else ("high" if suspect["risk_score"] > 60 else "medium"),
            "factors": factors,
            "behavioral_indicators": {"communication_anomaly": suspect["risk_score"] > 70, "location_suspicious": "proximity_confirmed" in suspect["flags"],
                "financial_irregularity": "financial_motive" in suspect["flags"] or "insurance_beneficiary" in suspect["flags"],
                "digital_footprint_suspicious": "encrypted_communications" in suspect["flags"]},
            "recommendation": "Immediate investigation priority" if suspect["risk_score"] > 80 else "Further surveillance recommended"})
    anomalies = case["ai_findings"]["anomalies"]
    severity_map = {"critical": 30, "high": 20, "medium": 10, "low": 5}
    return {"case_id": case_id,
        "case_risk": {"overall_score": case["ai_findings"]["correlation_score"],
            "severity_level": "critical" if case["ai_findings"]["correlation_score"] > 90 else "high",
            "anomaly_count": len(anomalies), "anomaly_severity_score": min(sum(severity_map.get(a["severity"], 5) for a in anomalies), 100),
            "evidence_strength": "strong" if case["ai_findings"]["correlation_score"] > 85 else "moderate",
            "investigation_urgency": "immediate" if case["ai_findings"]["correlation_score"] > 90 else "high"},
        "suspects_risk": suspects_risk,
        "anomalies": [{**a, "risk_contribution": severity_map.get(a["severity"], 5), "actionable": True} for a in anomalies],
        "risk_matrix": {"categories": [
            {"name": "Physical Evidence", "score": 88, "max": 100}, {"name": "Digital Correlation", "score": 94, "max": 100},
            {"name": "Temporal Alignment", "score": 91, "max": 100}, {"name": "Motive Indicators", "score": 82, "max": 100},
            {"name": "Behavioral Anomalies", "score": 76, "max": 100}]},
        "ai_confidence": {"model": "ForensicAI Risk Engine v2.4", "training_cases": 12847, "validation_accuracy": 0.947, "false_positive_rate": 0.023}}

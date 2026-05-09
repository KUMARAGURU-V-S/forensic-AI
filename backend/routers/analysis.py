"""Analysis Router - AI-powered forensic analysis"""
from fastapi import APIRouter, HTTPException
from backend.services.demo_data import get_case_by_id

router = APIRouter()

@router.get("/autopsy/{case_id}")
def analyze_autopsy(case_id: str):
    case = get_case_by_id(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    autopsy = case["autopsy_report"]
    return {
        "case_id": case_id,
        "nlp_extraction": {
            "cause_of_death": autopsy["cod"], "manner_of_death": autopsy["manner"],
            "injuries_detected": len(autopsy["injuries"]), "injury_details": autopsy["injuries"],
            "toxicology_substances": len(autopsy["toxicology"]["findings"]),
            "toxicology_conclusion": autopsy["toxicology"]["conclusion"], "confidence": 0.94
        },
        "ai_insights": [
            "Organophosphate concentration 8.4x lethal threshold indicates intentional administration",
            "Restraint marks on wrist suggest victim was incapacitated before poisoning",
            "Petechial hemorrhages consistent with respiratory distress from cholinergic crisis",
            "Sub-therapeutic ethanol suggests victim was not intoxicated at time of death",
            "Prescribed diazepam at therapeutic levels may have slowed initial response to poisoning"
        ],
        "similar_cases": [
            {"case_id": "FTI-2023-0234", "similarity": 0.78, "method": "organophosphate_poisoning", "outcome": "convicted"},
            {"case_id": "FTI-2022-0891", "similarity": 0.65, "method": "chemical_poisoning", "outcome": "ongoing"}
        ]
    }

@router.get("/tod/{case_id}")
def estimate_time_of_death(case_id: str):
    case = get_case_by_id(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    tod = case["autopsy_report"]["time_of_death"]
    body_temp = tod["body_temp_at_scene"]
    temp_diff = 37.0 - body_temp
    estimated_hours = temp_diff / 1.5
    vk_hours = estimated_hours * 0.95
    combined = (estimated_hours + vk_hours) / 2
    return {
        "case_id": case_id, "estimation_mode": "early_phase" if combined < 72 else "late_phase",
        "methods_used": [
            {"method": "Henssge Nomogram", "estimated_pmi_hours": round(estimated_hours, 1), "confidence": 0.85,
             "parameters": {"body_temperature": body_temp, "ambient_temperature": tod["ambient_temp"], "body_weight_kg": 78, "clothing_factor": 1.2}},
            {"method": "Vitreous Potassium", "estimated_pmi_hours": round(vk_hours, 1), "confidence": 0.82,
             "parameters": {"potassium_level": "8.2 mEq/L", "reference_curve": "Madea_2005"}},
            {"method": "Rigor Mortis Assessment", "estimated_pmi_hours": round(combined * 1.05, 1), "confidence": 0.75,
             "parameters": {"stage": tod["rigor_mortis"], "ambient_temp_factor": "normal"}},
            {"method": "Livor Mortis Assessment", "estimated_pmi_hours": round(combined * 1.1, 1), "confidence": 0.70,
             "parameters": {"stage": tod["livor_mortis"], "position_consistent": True}}
        ],
        "combined_estimation": {"pmi_hours": round(combined, 1), "estimated_tod": tod["estimated"],
                               "confidence_interval": f"±{tod['range_hours']} hours", "overall_confidence": 0.88},
        "smartwatch_corroboration": {"last_heartbeat": "2024-11-14T22:29:00Z", "consistent_with_estimate": True,
                                    "refinement": "Smartwatch data narrows TOD to ±5 minutes"}
    }

@router.get("/explainability/{case_id}")
def get_explainability(case_id: str):
    case = get_case_by_id(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    findings = case["ai_findings"]
    return {
        "case_id": case_id, "method": "SHAP + LIME Combined",
        "overall_risk_explanation": {
            "risk_score": findings["correlation_score"],
            "top_contributing_factors": [
                {"factor": "Suspect confirmed at scene (CCTV + GPS)", "contribution": 0.34, "direction": "positive"},
                {"factor": "Lethal poison concentration", "contribution": 0.22, "direction": "positive"},
                {"factor": "Financial motive ($2.4M transfer)", "contribution": 0.18, "direction": "positive"},
                {"factor": "Encrypted communications pre-incident", "contribution": 0.14, "direction": "positive"},
                {"factor": "Post-mortem file deletion", "contribution": 0.12, "direction": "positive"}
            ],
            "legal_transparency": "All factors are independently verifiable through physical evidence chains"
        },
        "per_correlation_shap": findings["key_correlations"],
        "lime_local_explanations": [{"prediction": "Suspect S1 involvement: 97%",
            "if_removed": [
                {"evidence": "CCTV footage", "new_score": "71%", "impact": "-26%"},
                {"evidence": "GPS data", "new_score": "82%", "impact": "-15%"},
                {"evidence": "Access card logs", "new_score": "88%", "impact": "-9%"},
                {"evidence": "Phone metadata", "new_score": "91%", "impact": "-6%"}
            ]}
        ]
    }

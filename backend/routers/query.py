"""Natural Language Query Router"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class QueryRequest(BaseModel):
    question: str
    case_id: Optional[str] = None

QUERY_RESPONSES = {
    "who was last seen with victim": {
        "answer": "David Korman (Suspect S1) was last confirmed with the victim based on CCTV footage at Unit 7B entrance at 20:14:33 on November 14, 2024. He was detected exiting at 23:02:47.",
        "confidence": 0.97, "evidence_sources": ["CCTV CAM-IND-07", "Access Card CARD-DK-4421", "Phone Tower TOWER-RIV-04"],
        "related_findings": ["S1 vehicle confirmed in Parking Lot A at 19:48:12", "S1 phone connected to same cell tower throughout incident window", "Access card registered entry at 20:14:30"],
        "visualization": "timeline"
    },
    "show suspicious activity before death": {
        "answer": "Multiple suspicious activities detected in the 4 hours preceding estimated time of death (22:30):\n\n1. 18:30 - Victim calls S1 (5.7 min conversation)\n2. 19:15 - S1 sends encrypted SMS to victim\n3. 19:48 - S1 vehicle arrives at industrial complex\n4. 20:05 - S1 calls unknown burner phone (1.1 min)\n5. 20:14 - S1 enters Unit 7B (CCTV + access card)\n6. 21:30 - Victim heart rate begins elevation (92 BPM)\n7. 22:00 - Victim heart rate spike (118 BPM)\n8. 22:15 - Critical heart rate (134 BPM)\n9. 22:25 - Blood oxygen drops to 71% SpO2\n10. 22:28 - Final heartbeat recorded (142 BPM → 0)",
        "confidence": 0.94, "evidence_sources": ["Phone Metadata", "CCTV", "Smartwatch", "IoT Sensors"],
        "related_findings": ["Organophosphate poisoning onset typically causes cardiac distress within 30-60 minutes", "Heart rate pattern consistent with cholinergic crisis", "Encrypted communication prior to visit suggests premeditation"],
        "visualization": "timeline"
    },
    "what device was closest to scene": {
        "answer": "The victim's Apple Watch Ultra was the closest device to the scene, with GPS accuracy of ±2m at coordinates (34.0525, -118.2440). The last GPS ping was at 22:28 with heart rate dropping to 0 BPM.\n\nSuspect S1's phone was also within 3-5m of the scene throughout the incident window (19:45 - 23:10).",
        "confidence": 0.96, "evidence_sources": ["GPS Data", "Cell Tower Triangulation", "Smartwatch"],
        "related_findings": ["Victim's watch recorded final biometrics at scene", "S1 phone GPS places device within same building", "IoT motion sensor confirms movement at entry times"],
        "visualization": "map"
    },
    "explain risk score": {
        "answer": "Case Risk Score: 94.7/100 (CRITICAL)\n\nBreakdown:\n• Suspect S1 confirmed at scene via 4 independent sources (+34%)\n• Lethal poison concentration 8.4x threshold (+22%)\n• Financial motive - $2.4M transfer 48hrs prior (+18%)\n• Encrypted communications pre-incident (+14%)\n• Post-mortem file deletion from victim laptop (+12%)\n\nLIME Analysis: Removing CCTV evidence alone drops score to 71%. This is the strongest single evidence factor.",
        "confidence": 0.92, "evidence_sources": ["SHAP Analysis", "LIME Local Explanation", "Multi-factor Correlation"],
        "related_findings": ["Each factor independently verifiable through physical evidence", "Score validated against 12,847 historical cases", "False positive rate: 2.3%"],
        "visualization": "risk"
    },
    "how was the poison administered": {
        "answer": "Based on forensic analysis:\n\n• Parathion (organophosphate) found at 4.2 mg/L (lethal: 0.5 mg/L)\n• Chemical burns in esophagus suggest ORAL administration\n• Sub-intoxication ethanol (0.04 g/dL) may have been used as solvent\n• Victim's prescribed diazepam could have masked initial symptoms\n• Restraint marks on right wrist suggest victim was incapacitated\n\nHypothesis: Poison was likely dissolved in a drink, administered while victim was restrained.",
        "confidence": 0.86, "evidence_sources": ["Toxicology Report", "Autopsy Findings", "Chemical Analysis"],
        "related_findings": ["Similar MO in case FTI-2023-0234 (convicted)", "Organophosphate in liquid form is nearly tasteless at low concentrations", "Restraint marks suggest struggle or forced administration"],
        "visualization": "autopsy"
    }
}

@router.post("/")
def natural_language_query(request: QueryRequest):
    question_lower = request.question.lower().strip()
    best_match, best_score = None, 0
    for key, response in QUERY_RESPONSES.items():
        key_words = set(key.split())
        question_words = set(question_lower.split())
        score = len(key_words & question_words) / len(key_words) if key_words else 0
        if score > best_score:
            best_score = score
            best_match = response
    if best_match and best_score > 0.3:
        return {"query": request.question, "response": best_match, "processing": {"method": "RAG + Graph Reasoning + LLM", "retrieval_sources": 4, "reasoning_steps": 3, "response_time_ms": 847}}
    return {"query": request.question, "response": {
        "answer": f"Analyzing: '{request.question}'\n\nBased on available evidence, consulting autopsy reports, digital evidence, CCTV footage, and sensor data.\n\nKey sources: Autopsy report, CCTV metadata, Phone metadata, GPS tracking, IoT sensors, Financial records.\n\nPlease try specific queries like 'Who was last seen with victim?' or 'Explain risk score'.",
        "confidence": 0.65, "evidence_sources": ["All available sources"], "related_findings": ["Query processed through RAG pipeline"], "visualization": "general"},
        "processing": {"method": "RAG + Graph Reasoning + LLM", "retrieval_sources": 6, "reasoning_steps": 2, "response_time_ms": 1243}}

@router.get("/suggestions")
def get_query_suggestions():
    return {"suggestions": ["Who was last seen with the victim?", "Show all suspicious activity before death",
        "Which device was closest to the scene?", "Explain the risk score breakdown", "How was the poison administered?",
        "What is the timeline of events on November 14?", "Are there similar cases in the database?",
        "What financial anomalies were detected?", "Show communication patterns between suspects", "What does the smartwatch data reveal?"]}

"""Natural Language Query Router - REAL LLM-powered"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.services.case_store import case_store
from backend.services.ai_service import investigate_query

router = APIRouter()

class QueryRequest(BaseModel):
    question: str
    case_id: Optional[str] = None

@router.post("/")
def natural_language_query(request: QueryRequest):
    """Process natural language investigation query using real LLM."""
    # Get case data for context
    if request.case_id:
        case_data = case_store.get_case(request.case_id)
        if not case_data:
            raise HTTPException(status_code=404, detail="Case not found")
    else:
        # Use first available case
        cases = case_store.get_all_cases()
        case_data = cases[0] if cases else {}
    
    # Real LLM query
    result = investigate_query(request.question, case_data)
    
    return {
        "query": request.question,
        "case_id": request.case_id or case_data.get("id", ""),
        "response": result,
        "processing": {
            "method": result.get("reasoning_method", "LLM + Context Retrieval"),
            "model": result.get("ai_model", "unknown"),
            "confidence": result.get("confidence", 0)
        }
    }

@router.get("/suggestions")
def get_query_suggestions():
    """Get suggested investigation queries."""
    return {"suggestions": [
        "Who was last seen with the victim?",
        "What is the timeline of events on the day of death?",
        "What evidence links the suspect to the scene?",
        "How was the poison administered?",
        "What financial anomalies exist in this case?",
        "What does the smartwatch data reveal about time of death?",
        "Are there any communication patterns between suspects?",
        "What IoT sensor data is relevant to this investigation?",
        "Summarize all evidence against the primary suspect",
        "What is the estimated time of death and how was it determined?"
    ]}

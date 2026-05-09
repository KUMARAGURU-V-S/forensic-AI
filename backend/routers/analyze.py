"""
Analyze Router — Full autopsy report analysis with LLM enhancement.
Ported from forensix-ai-nextjs app/api/analyze/route.ts

Combines: NLP baseline + GraphRAG context + LLM enhancement
"""
import json
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

from backend.services.forensic_engine import analyze_autopsy_report, estimate_time_of_death
from backend.services.llm_provider import universal_llm
from backend.services.graphrag_service import retrieve_forensic_context

router = APIRouter()


class AnalyzeRequest(BaseModel):
    text: Optional[str] = None
    type: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    caseTitle: Optional[str] = None


def _extract_json(text: str):
    """Extract JSON from LLM response."""
    if not text:
        return None
    try:
        return json.loads(text.strip())
    except Exception:
        pass
    m = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except Exception:
            pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except Exception:
            pass
    return None


@router.post("/")
def analyze_endpoint(request: AnalyzeRequest):
    """Full analysis: NLP + GraphRAG + LLM enhancement."""

    # TOD Estimation
    if request.type == "tod":
        params = request.params or {}
        result = estimate_time_of_death(
            rectal_temp=params.get("rectalTemp", 28.5),
            ambient_temp=params.get("ambientTemp", 18),
            body_weight=params.get("bodyWeight", 78),
            corrective_factor=params.get("correctiveFactor", 0.9),
            rigor_mortis=params.get("rigorMortis", "full"),
            lividity=params.get("lividity", "fixed"),
            decomposition=params.get("decomposition", "absent"),
        )
        return result

    # Full Report Analysis
    if not request.text:
        raise HTTPException(400, 'Provide "text" or "type:tod" with params')

    # Local NLP baseline
    local_analysis = analyze_autopsy_report(request.text)

    # GraphRAG: retrieve verified forensic knowledge
    graphrag_context = retrieve_forensic_context(request.text[:600])

    # LLM-enhanced analysis
    llm_analysis = None
    llm_error = None

    json_schema = """{
  "causeOfDeath": "string",
  "mannerOfDeath": "natural|accident|suicide|homicide|undetermined",
  "riskScore": 0-100,
  "injuries": ["string"],
  "toxicology": ["string"],
  "anomalies": [{"type": "string", "severity": "CRITICAL|HIGH|MODERATE|LOW", "description": "string", "recommendation": "string"}],
  "summary": "2-3 sentence forensic summary",
  "keyFindings": ["string"],
  "investigativeLeads": ["string"]
}"""

    system_content = f"You are a senior forensic pathologist AI. Analyze the autopsy report and return ONLY a valid JSON object matching this schema — no markdown, no prose:\n{json_schema}"
    if graphrag_context:
        system_content += f"\n\nVERIFIED FORENSIC KNOWLEDGE (use this, do not contradict it):\n{graphrag_context}"

    try:
        result = universal_llm.chat(
            [
                {"role": "system", "content": system_content},
                {"role": "user", "content": f"Analyze this forensic report and return ONLY the JSON object:\n\n{request.text[:4000]}"},
            ],
            max_tokens=2000,
            temperature=0.1,
        )
        if result["provider"] != "local" and result["content"]:
            parsed = _extract_json(result["content"])
            if parsed and isinstance(parsed, dict):
                llm_analysis = parsed
            else:
                llm_error = "JSON parse failed"
    except Exception as e:
        llm_error = str(e)

    # Merge results
    merged = {**local_analysis, "llmEnhanced": bool(llm_analysis), "llmError": llm_error}

    if llm_analysis:
        merged["aiSummary"] = llm_analysis.get("summary")
        merged["aiKeyFindings"] = llm_analysis.get("keyFindings", [])
        merged["aiInvestigativeLeads"] = llm_analysis.get("investigativeLeads", [])
        merged["aiAnomalies"] = llm_analysis.get("anomalies", [])
        if llm_analysis.get("mannerOfDeath"):
            merged["mannerOfDeath"] = llm_analysis["mannerOfDeath"]
        if llm_analysis.get("causeOfDeath"):
            merged["causeOfDeath"] = [llm_analysis["causeOfDeath"]]
        merged["riskScore"] = max(local_analysis.get("riskScore", 0), llm_analysis.get("riskScore", 0))

    # Recalculate risk level
    rs = merged.get("riskScore", 0)
    merged["riskLevel"] = "CRITICAL" if rs >= 75 else ("HIGH" if rs >= 50 else ("MODERATE" if rs >= 30 else "LOW"))

    return merged

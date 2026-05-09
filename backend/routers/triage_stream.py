"""
Triage Stream Router — Server-Sent Events for analysis progress.
Ported from forensix-ai-nextjs app/api/triage-stream/route.ts
"""
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

TRIAGE_STAGES = [
    {"stage": "nlp_init", "label": "Initializing forensic NLP pipeline…", "progress": 5},
    {"stage": "entity_extraction", "label": "Extracting forensic entities (NER)…", "progress": 15},
    {"stage": "cause_analysis", "label": "Analyzing cause of death indicators…", "progress": 25},
    {"stage": "injury_mapping", "label": "Mapping injury patterns…", "progress": 35},
    {"stage": "toxicology_parse", "label": "Parsing toxicology findings…", "progress": 45},
    {"stage": "graphrag_retrieve", "label": "Retrieving GraphRAG forensic knowledge…", "progress": 55},
    {"stage": "llm_analysis", "label": "LLM-enhanced forensic analysis…", "progress": 65},
    {"stage": "anomaly_detection", "label": "Detecting anomalies and inconsistencies…", "progress": 75},
    {"stage": "risk_scoring", "label": "Computing multi-factor risk score…", "progress": 85},
    {"stage": "report_generation", "label": "Generating investigation report…", "progress": 95},
    {"stage": "complete", "label": "Analysis complete", "progress": 100},
]


async def event_generator():
    """Generate SSE events simulating analysis progress."""
    import json
    for stage in TRIAGE_STAGES:
        yield f"data: {json.dumps(stage)}\n\n"
        await asyncio.sleep(0.8)


@router.get("/stream")
async def triage_stream():
    """SSE endpoint for real-time triage progress."""
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )

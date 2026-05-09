"""
═══════════════════════════════════════════════════════════════════════════
ForensiX AI — FastAPI Server with SSE Streaming
═══════════════════════════════════════════════════════════════════════════

Endpoints:
  POST /api/investigate/stream   — Run full 8-agent pipeline with SSE streaming
  POST /api/investigate/resume   — Resume after human-in-the-loop interrupt
  GET  /api/investigate/state    — Get current state of a thread
  GET  /api/health               — Health check
═══════════════════════════════════════════════════════════════════════════
"""

import os
import json
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from langgraph.types import Command

from graph import graph, ForensicState

load_dotenv()

app = FastAPI(
    title="ForensiX AI — Multi-Agent Forensic System",
    version="2.0.0",
    description="LangGraph-based 8-agent forensic investigation pipeline",
)

# CORS for Next.js frontend
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══ REQUEST/RESPONSE MODELS ═══

class InvestigateRequest(BaseModel):
    case_id: str
    report_text: Optional[str] = None
    evidence: Optional[list[dict]] = None
    cctv_frames: Optional[list[str]] = None  # base64 images
    toxicology_data: Optional[list[dict]] = None
    thread_id: Optional[str] = None


class ResumeRequest(BaseModel):
    thread_id: str
    response: str  # human decision (e.g., "approve", "reject", "escalate")


class StateRequest(BaseModel):
    thread_id: str


# ═══ ENDPOINTS ═══

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "ForensiX AI Multi-Agent System",
        "version": "2.0.0",
        "framework": "LangGraph",
        "agents": 8,
        "providers": {
            "gemini": bool(os.getenv("GOOGLE_API_KEY")),
            "featherless": bool(os.getenv("LLM_API_KEY")),
            "huggingface": bool(os.getenv("HF_TOKEN")),
        },
    }


@app.post("/api/investigate/stream")
async def investigate_stream(req: InvestigateRequest):
    """Run the full 8-agent forensic pipeline with real-time SSE streaming."""
    thread_id = req.thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    # Build initial state
    initial_state: dict = {
        "case_id": req.case_id,
        "report_text": req.report_text or "",
        "evidence": req.evidence or [],
        "cctv_frames": req.cctv_frames or [],
        "toxicology_data": req.toxicology_data or [],
        "findings": [],
        "correlations": [],
        "errors": [],
        "completed_agents": [],
        "risk_score": 0.0,
        "risk_level": "UNKNOWN",
        "risk_factors": {},
        "explanation": "",
        "investigative_leads": [],
        "phase": "starting",
        "human_decision": "",
    }

    async def event_stream():
        # Send thread_id first
        yield f"data: {json.dumps({'type': 'thread_id', 'thread_id': thread_id})}\n\n"

        try:
            async for chunk in graph.astream(initial_state, config=config, stream_mode="updates"):
                if "__interrupt__" in chunk:
                    # Human-in-the-loop pause
                    interrupts = chunk["__interrupt__"]
                    yield f"data: {json.dumps({'type': 'interrupt', 'data': [{'value': i.value, 'id': str(i.id)} for i in interrupts]})}\n\n"
                else:
                    for node_name, update in chunk.items():
                        # Progress event
                        event = {
                            "type": "agent_update",
                            "agent": node_name,
                            "completed_agents": update.get("completed_agents", []),
                            "new_findings": len(update.get("findings", [])),
                            "new_correlations": len(update.get("correlations", [])),
                            "risk_score": update.get("risk_score"),
                            "risk_level": update.get("risk_level"),
                            "errors": update.get("errors", []),
                        }
                        yield f"data: {json.dumps(event)}\n\n"

            # Get final state
            final_state = graph.get_state(config)
            final_data = {
                "type": "complete",
                "case_id": req.case_id,
                "thread_id": thread_id,
                "risk_score": final_state.values.get("risk_score", 0),
                "risk_level": final_state.values.get("risk_level", "UNKNOWN"),
                "findings_count": len(final_state.values.get("findings", [])),
                "correlations_count": len(final_state.values.get("correlations", [])),
                "completed_agents": final_state.values.get("completed_agents", []),
                "findings": final_state.values.get("findings", []),
                "correlations": final_state.values.get("correlations", []),
                "explanation": final_state.values.get("explanation", ""),
                "investigative_leads": final_state.values.get("investigative_leads", []),
                "risk_factors": final_state.values.get("risk_factors", {}),
                "errors": final_state.values.get("errors", []),
            }
            yield f"data: {json.dumps(final_data)}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@app.post("/api/investigate/resume")
async def investigate_resume(req: ResumeRequest):
    """Resume investigation after human-in-the-loop interrupt."""
    config = {"configurable": {"thread_id": req.thread_id}}

    # Check if thread exists and is interrupted
    state = graph.get_state(config)
    if not state or not state.next:
        raise HTTPException(404, "Thread not found or not in interrupted state")

    async def event_stream():
        try:
            async for chunk in graph.astream(Command(resume=req.response), config=config, stream_mode="updates"):
                if "__interrupt__" in chunk:
                    interrupts = chunk["__interrupt__"]
                    yield f"data: {json.dumps({'type': 'interrupt', 'data': [{'value': i.value, 'id': str(i.id)} for i in interrupts]})}\n\n"
                else:
                    for node_name, update in chunk.items():
                        yield f"data: {json.dumps({'type': 'agent_update', 'agent': node_name, 'data': {k: v for k, v in update.items() if k != 'findings'}})}\n\n"

            final_state = graph.get_state(config)
            yield f"data: {json.dumps({'type': 'complete', 'risk_score': final_state.values.get('risk_score', 0), 'explanation': final_state.values.get('explanation', '')})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@app.post("/api/investigate/state")
async def get_investigation_state(req: StateRequest):
    """Get current state of an investigation thread."""
    config = {"configurable": {"thread_id": req.thread_id}}
    state = graph.get_state(config)

    if not state:
        raise HTTPException(404, "Thread not found")

    return {
        "thread_id": req.thread_id,
        "next_nodes": list(state.next) if state.next else [],
        "is_interrupted": bool(state.next),
        "values": {
            "case_id": state.values.get("case_id"),
            "risk_score": state.values.get("risk_score"),
            "risk_level": state.values.get("risk_level"),
            "completed_agents": state.values.get("completed_agents", []),
            "findings_count": len(state.values.get("findings", [])),
            "correlations_count": len(state.values.get("correlations", [])),
            "errors": state.values.get("errors", []),
        },
    }


# ═══ RUN ═══

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    print(f"\n🔬 ForensiX AI — LangGraph Multi-Agent Server")
    print(f"   Running on http://{host}:{port}")
    print(f"   Docs: http://{host}:{port}/docs")
    print(f"   Agents: 8 | Framework: LangGraph | Streaming: SSE\n")
    uvicorn.run("server:app", host=host, port=port, reload=True)

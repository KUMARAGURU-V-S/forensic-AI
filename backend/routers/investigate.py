"""
LangGraph Investigation Router — exposes the 8-agent forensic pipeline via SSE.
Imports from langgraph-agents/graph.py at runtime with graceful fallback when
LangGraph is not installed.
"""

import os
import sys
import io
import json
import uuid
import base64
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()

# ─── Try to import the LangGraph graph ───────────────────────────────────────
_LANGGRAPH_AVAILABLE = False
_LANGGRAPH_ERROR = ""
_graph = None

try:
    _lg_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "langgraph-agents")
    )
    if _lg_path not in sys.path:
        sys.path.insert(0, _lg_path)

    from graph import graph as __graph  # noqa: E402
    _graph = __graph
    _LANGGRAPH_AVAILABLE = True
except ImportError as _e:
    _LANGGRAPH_ERROR = f"Missing dependency: {_e}"
except Exception as _e:
    _LANGGRAPH_ERROR = str(_e)


# ─── Pydantic models ─────────────────────────────────────────────────────────

class InvestigateRequest(BaseModel):
    case_id: str
    report_text: Optional[str] = None
    evidence: Optional[list] = None
    cctv_frames: Optional[list] = None
    toxicology_data: Optional[list] = None
    thread_id: Optional[str] = None


class ResumeRequest(BaseModel):
    thread_id: str
    response: str  # "approve" | "reject" | "escalate"


class StateRequest(BaseModel):
    thread_id: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/extract-pdf")
async def extract_pdf_text(file: UploadFile = File(...)):
    """Extract plain text from a PDF autopsy report using pdfplumber."""
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    try:
        import pdfplumber  # noqa: PLC0415
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = []
            for i, page in enumerate(pdf.pages):
                txt = page.extract_text() or ""
                if txt.strip():
                    pages.append(f"[Page {i + 1}]\n{txt}")
            text = "\n\n".join(pages).strip()
        if not text:
            return {"text": "", "pages": len(pdf.pages), "method": "failed",
                    "warning": "No text found — PDF may be scanned/image-only. Paste text manually."}
        return {"text": text, "pages": len(pdf.pages), "method": "pdfplumber",
                "chars": len(text)}
    except ImportError:
        raise HTTPException(503, "pdfplumber not installed on this server")
    except Exception as e:
        raise HTTPException(500, f"PDF extraction failed: {e}")


@router.get("/status")
def langgraph_status():
    return {
        "available": _LANGGRAPH_AVAILABLE,
        "error": _LANGGRAPH_ERROR if not _LANGGRAPH_AVAILABLE else None,
        "framework": "LangGraph" if _LANGGRAPH_AVAILABLE else None,
        "agents": 8 if _LANGGRAPH_AVAILABLE else 0,
        "features": ["streaming_sse", "human_in_the_loop", "parallel_phase1", "memory_saver"] if _LANGGRAPH_AVAILABLE else [],
    }


@router.post("/stream")
async def investigate_stream(req: InvestigateRequest):
    """Run the full 8-agent forensic pipeline with real-time SSE streaming."""

    if not _LANGGRAPH_AVAILABLE:
        async def _unavailable():
            yield f'data: {json.dumps({"type": "error", "error": _LANGGRAPH_ERROR, "hint": "Install langgraph-agents requirements.txt"})}\n\n'
        return StreamingResponse(_unavailable(), media_type="text/event-stream")

    thread_id = req.thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

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
        yield f'data: {json.dumps({"type": "thread_id", "thread_id": thread_id})}\n\n'
        try:
            async for chunk in _graph.astream(initial_state, config=config, stream_mode="updates"):
                if "__interrupt__" in chunk:
                    interrupts = chunk["__interrupt__"]
                    yield f'data: {json.dumps({"type": "interrupt", "data": [{"value": i.value, "id": str(i.id)} for i in interrupts]})}\n\n'
                else:
                    for node_name, update in chunk.items():
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
                        yield f'data: {json.dumps(event)}\n\n'

            final = _graph.get_state(config)
            yield f'data: {json.dumps({"type": "complete", "case_id": req.case_id, "thread_id": thread_id, "risk_score": final.values.get("risk_score", 0), "risk_level": final.values.get("risk_level", "UNKNOWN"), "findings_count": len(final.values.get("findings", [])), "correlations_count": len(final.values.get("correlations", [])), "completed_agents": final.values.get("completed_agents", []), "findings": final.values.get("findings", []), "correlations": final.values.get("correlations", []), "explanation": final.values.get("explanation", ""), "investigative_leads": final.values.get("investigative_leads", []), "risk_factors": final.values.get("risk_factors", {}), "errors": final.values.get("errors", [])})}\n\n'

        except Exception as e:
            yield f'data: {json.dumps({"type": "error", "error": str(e)})}\n\n'

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.post("/resume")
async def investigate_resume(req: ResumeRequest):
    """Resume an interrupted investigation (human-in-the-loop)."""
    if not _LANGGRAPH_AVAILABLE:
        raise HTTPException(503, _LANGGRAPH_ERROR)

    from langgraph.types import Command  # noqa: PLC0415

    config = {"configurable": {"thread_id": req.thread_id}}
    state = _graph.get_state(config)
    if not state or not state.next:
        raise HTTPException(404, "Thread not found or not in interrupted state")

    async def event_stream():
        try:
            async for chunk in _graph.astream(Command(resume=req.response), config=config, stream_mode="updates"):
                if "__interrupt__" in chunk:
                    interrupts = chunk["__interrupt__"]
                    yield f'data: {json.dumps({"type": "interrupt", "data": [{"value": i.value, "id": str(i.id)} for i in interrupts]})}\n\n'
                else:
                    for node_name, update in chunk.items():
                        yield f'data: {json.dumps({"type": "agent_update", "agent": node_name, "completed_agents": update.get("completed_agents", []), "risk_score": update.get("risk_score"), "risk_level": update.get("risk_level")})}\n\n'

            final = _graph.get_state(config)
            yield f'data: {json.dumps({"type": "complete", "risk_score": final.values.get("risk_score", 0), "risk_level": final.values.get("risk_level", "UNKNOWN"), "explanation": final.values.get("explanation", ""), "investigative_leads": final.values.get("investigative_leads", [])})}\n\n'
        except Exception as e:
            yield f'data: {json.dumps({"type": "error", "error": str(e)})}\n\n'

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/state")
def get_investigation_state(req: StateRequest):
    """Get current state of an investigation thread."""
    if not _LANGGRAPH_AVAILABLE:
        raise HTTPException(503, _LANGGRAPH_ERROR)

    config = {"configurable": {"thread_id": req.thread_id}}
    state = _graph.get_state(config)
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

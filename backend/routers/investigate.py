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
import re
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


def _build_complete_event(values: dict, thread_id: Optional[str] = None, case_id: Optional[str] = None) -> dict:
    payload = {
        "type": "complete",
        "risk_score": values.get("risk_score", 0),
        "risk_level": values.get("risk_level", "UNKNOWN"),
        "findings_count": len(values.get("findings", [])),
        "correlations_count": len(values.get("correlations", [])),
        "completed_agents": values.get("completed_agents", []),
        "findings": values.get("findings", []),
        "correlations": values.get("correlations", []),
        "explanation": values.get("explanation", ""),
        "investigative_leads": values.get("investigative_leads", []),
        "risk_factors": values.get("risk_factors", {}),
        "errors": values.get("errors", []),
    }
    if thread_id is not None:
        payload["thread_id"] = thread_id
    if case_id is not None:
        payload["case_id"] = case_id
    return payload


def _normalize_extracted_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\x00", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _text_quality_score(text: str) -> float:
    text = _normalize_extracted_text(text)
    if not text:
        return 0.0

    tokens = re.findall(r"\S+", text)
    if not tokens:
        return 0.0

    alpha_chars = sum(ch.isalpha() for ch in text)
    printable_chars = sum(ch.isprintable() for ch in text)
    whitespace_chars = sum(ch.isspace() for ch in text)
    natural_words = len(
        re.findall(r"\b(?:[A-Z]{2,}|[A-Z]?[a-z]{2,})(?:['/-](?:[A-Z]?[a-z]{2,}|[A-Z]{2,}))*\b", text)
    )

    suspicious_tokens = 0
    for token in tokens:
        alpha_only = re.sub(r"[^A-Za-z]", "", token)
        if not alpha_only:
            continue
        has_mixed_case = bool(re.search(r"[a-z][A-Z]", alpha_only))
        if len(alpha_only) >= 18 or (len(alpha_only) >= 10 and has_mixed_case):
            suspicious_tokens += 1

    alpha_ratio = alpha_chars / max(len(text), 1)
    printable_ratio = printable_chars / max(len(text), 1)
    whitespace_ratio = whitespace_chars / max(len(text), 1)
    word_ratio = natural_words / max(len(tokens), 1)
    garble_penalty = min((suspicious_tokens * 4) / max(len(tokens), 1), 1.0)
    whitespace_score = min(whitespace_ratio / 0.18, 1.0)

    return (
        (word_ratio * 0.35)
        + (whitespace_score * 0.15)
        + (alpha_ratio * 0.1)
        + (printable_ratio * 0.1)
        + ((1.0 - garble_penalty) * 0.3)
    )


def _extract_pdf_candidates(data: bytes) -> list[dict]:
    candidates: list[dict] = []

    try:
        import pdfplumber  # noqa: PLC0415

        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = []
            for i, page in enumerate(pdf.pages):
                txt = _normalize_extracted_text(page.extract_text() or "")
                if txt:
                    pages.append(f"[Page {i + 1}]\n{txt}")
            text = "\n\n".join(pages).strip()
            candidates.append({
                "method": "pdfplumber",
                "text": text,
                "pages": len(pdf.pages),
                "score": _text_quality_score(text),
            })
    except ImportError:
        pass

    try:
        from pypdf import PdfReader  # noqa: PLC0415

        reader = PdfReader(io.BytesIO(data))
        pages = []
        for i, page in enumerate(reader.pages):
            txt = _normalize_extracted_text(page.extract_text() or "")
            if txt:
                pages.append(f"[Page {i + 1}]\n{txt}")
        text = "\n\n".join(pages).strip()
        candidates.append({
            "method": "pypdf",
            "text": text,
            "pages": len(reader.pages),
            "score": _text_quality_score(text),
        })
    except ImportError:
        pass

    return candidates


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/extract-pdf")
async def extract_pdf_text(file: UploadFile = File(...)):
    """Extract plain text from a PDF autopsy report using the best available parser."""
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")

    candidates = _extract_pdf_candidates(data)
    if not candidates:
        raise HTTPException(503, "No supported PDF extractor installed on this server")

    best = max(
        candidates,
        key=lambda candidate: (candidate["score"], len(candidate["text"])),
    )

    if not best["text"]:
        return {
            "text": "",
            "pages": best["pages"],
            "method": best["method"],
            "warning": "No extractable text found. PDF may be scanned or image-only.",
        }

    response = {
        "text": best["text"],
        "pages": best["pages"],
        "method": best["method"],
        "chars": len(best["text"]),
    }

    if best["score"] < 0.75:
        response["warning"] = (
            "Text extraction looks low-confidence. Try a text-based PDF, export to TXT, "
            "or enable OCR for scanned reports."
        )
    elif best["method"] != "pdfplumber":
        response["warning"] = f"Used {best['method']} because it produced cleaner text than pdfplumber."

    return response


@router.get("/status")
def langgraph_status():
    google_ready = bool(os.getenv("GOOGLE_API_KEY", "").startswith("AIza") or os.getenv("GEMINI_API_KEY", "").startswith("AIza"))
    vision_ready = bool(google_ready or os.getenv("FEATHERLESS_VISION_MODEL") or os.getenv("VISION_MODEL") or os.getenv("LLM_VISION_MODEL"))
    return {
        "available": _LANGGRAPH_AVAILABLE,
        "error": _LANGGRAPH_ERROR if not _LANGGRAPH_AVAILABLE else None,
        "framework": "LangGraph" if _LANGGRAPH_AVAILABLE else None,
        "agents": 8 if _LANGGRAPH_AVAILABLE else 0,
        "features": ["streaming_sse", "human_in_the_loop", "parallel_phase1", "memory_saver"] if _LANGGRAPH_AVAILABLE else [],
        "google_gemini_available": google_ready,
        "vision_model_available": vision_ready,
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
                            "findings": update.get("findings", []),
                            "new_correlations": len(update.get("correlations", [])),
                            "correlations": update.get("correlations", []),
                            "risk_score": update.get("risk_score"),
                            "risk_level": update.get("risk_level"),
                            "risk_factors": update.get("risk_factors"),
                            "explanation": update.get("explanation"),
                            "investigative_leads": update.get("investigative_leads", []),
                            "errors": update.get("errors", []),
                        }
                        yield f'data: {json.dumps(event)}\n\n'

            final = _graph.get_state(config)
            yield f'data: {json.dumps(_build_complete_event(final.values, thread_id=thread_id, case_id=req.case_id))}\n\n'

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
                        yield f'data: {json.dumps({"type": "agent_update", "agent": node_name, "completed_agents": update.get("completed_agents", []), "new_findings": len(update.get("findings", [])), "findings": update.get("findings", []), "new_correlations": len(update.get("correlations", [])), "correlations": update.get("correlations", []), "risk_score": update.get("risk_score"), "risk_level": update.get("risk_level"), "risk_factors": update.get("risk_factors"), "explanation": update.get("explanation"), "investigative_leads": update.get("investigative_leads", []), "errors": update.get("errors", [])})}\n\n'

            final = _graph.get_state(config)
            yield f'data: {json.dumps(_build_complete_event(final.values, thread_id=req.thread_id, case_id=final.values.get("case_id")))}\n\n'
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

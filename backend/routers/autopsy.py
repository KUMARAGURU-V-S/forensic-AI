"""
Autopsy Router — Forensic Autopsy Intelligence Workspace
Uses run_in_executor to run the synchronous pipeline in a thread pool —
this avoids all asyncio/event-loop issues with blocking OCR and LLM calls.
"""
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from backend.services.auth_service import get_current_user
from backend.services.autopsy_service import (
    save_autopsy_file, sha256_bytes, create_report_record,
    run_pipeline_sync, list_reports, get_report,
    delete_report, update_report, query_report,
)

router = APIRouter()

ALLOWED_EXTS = {".pdf", ".txt", ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".docx", ".text"}

# Thread pool for blocking pipeline work (OCR, LLM calls)
_EXECUTOR = ThreadPoolExecutor(max_workers=3, thread_name_prefix="autopsy-pipeline")


class QueryRequest(BaseModel):
    question: str


# ── Upload ─────────────────────────────────────────────────────────────────────

@router.post("/upload/{case_id}")
async def upload_autopsy_report(
    case_id: str,
    file: UploadFile = File(...),
    uploader: str = Form(default="investigator"),
    user: dict = Depends(get_current_user),
):
    """
    Upload autopsy report and fire-and-forget the sync pipeline in a thread.
    Returns immediately with report_id; frontend polls /reports for status.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTS))}"
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    sha       = sha256_bytes(data)
    file_path = save_autopsy_file(case_id, file.filename or "report.bin", data)
    size_bytes = len(data)

    report_id = create_report_record(
        case_id=case_id,
        filename=file.filename or "report.bin",
        file_path=file_path,
        sha256=sha,
        size_bytes=size_bytes,
        uploader=user.get("username", uploader),
    )

    # Fire-and-forget: run sync pipeline in thread pool, don't await
    loop = asyncio.get_event_loop()
    loop.run_in_executor(
        _EXECUTOR,
        run_pipeline_sync,
        report_id, file_path, file.filename or "report.bin", case_id
    )

    return {
        "report_id": report_id,
        "case_id": case_id,
        "filename": file.filename,
        "sha256": sha,
        "size_bytes": size_bytes,
        "status": "processing",
        "message": "Report uploaded. Pipeline running. Poll /reports for status updates.",
    }


# ── List Reports ───────────────────────────────────────────────────────────────

@router.get("/{case_id}/reports")
def get_reports(case_id: str, user: dict = Depends(get_current_user)):
    """List all autopsy reports for a case with their current pipeline status."""
    reports = list_reports(case_id)
    return {"case_id": case_id, "reports": reports, "count": len(reports)}


# ── Get Single Report ─────────────────────────────────────────────────────────

@router.get("/{case_id}/report/{report_id}")
def get_single_report(case_id: str, report_id: str, user: dict = Depends(get_current_user)):
    """Return a single report with full structured extraction."""
    report = get_report(report_id)
    if not report or report["case_id"] != case_id:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


# ── RAG Query ──────────────────────────────────────────────────────────────────

@router.post("/{case_id}/report/{report_id}/query")
def query_autopsy_report(
    case_id: str, report_id: str, req: QueryRequest,
    user: dict = Depends(get_current_user),
):
    """Semantic RAG query against the autopsy report."""
    report = get_report(report_id)
    if not report or report["case_id"] != case_id:
        raise HTTPException(status_code=404, detail="Report not found")
    if report["status"] not in ("complete", "analyzing"):
        raise HTTPException(status_code=400,
            detail=f"Report status is '{report['status']}' — must be 'complete' to query")
    return query_report(report_id, req.question)


# ── Re-run Analysis ────────────────────────────────────────────────────────────

@router.post("/{case_id}/report/{report_id}/rerun")
async def rerun_analysis(
    case_id: str, report_id: str,
    user: dict = Depends(get_current_user),
):
    """Reset and re-run the full AI pipeline for a report."""
    report = get_report(report_id)
    if not report or report["case_id"] != case_id:
        raise HTTPException(status_code=404, detail="Report not found")

    # Reset status fields
    update_report(report_id,
        status="processing",
        structured_json=None,
        ocr_text=None,
        chunks_json=None,
        ai_summary=None,
        ocr_status="pending",
        confidence=0.0,
    )

    # Re-run pipeline in thread pool
    loop = asyncio.get_event_loop()
    loop.run_in_executor(
        _EXECUTOR,
        run_pipeline_sync,
        report_id, report["file_path"], report["filename"], case_id
    )

    return {"report_id": report_id, "status": "processing",
            "message": "Re-analysis started. Poll /reports for updates."}


# ── Delete Report ──────────────────────────────────────────────────────────────

@router.delete("/{case_id}/report/{report_id}")
def delete_autopsy_report(
    case_id: str, report_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete an autopsy report and its extracted data."""
    report = get_report(report_id)
    if not report or report["case_id"] != case_id:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"deleted": delete_report(report_id), "report_id": report_id}


# ── Standalone text analysis ──────────────────────────────────────────────────

class TextAnalysisRequest(BaseModel):
    text: str
    case_id: Optional[str] = None


@router.post("/analyze-text")
def analyze_text(req: TextAnalysisRequest, user: dict = Depends(get_current_user)):
    """Synchronously analyze raw autopsy text (no file upload required)."""
    from backend.services.ai_service import analyze_autopsy_full
    return analyze_autopsy_full(req.text)

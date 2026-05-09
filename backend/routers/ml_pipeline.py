"""
ML Pipeline Router — HuggingFace inference models.
Ported from forensix-ai-nextjs app/api/ml/route.ts

Supports: NER, zero-shot classification, embeddings, forensic classification
"""
import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

HF_TOKEN = os.environ.get("HF_TOKEN", "")


class MLRequest(BaseModel):
    task: str
    text: str
    labels: Optional[List[str]] = None


def _hf_inference(model: str, payload: dict) -> dict:
    """Call HuggingFace Inference API."""
    if not HF_TOKEN:
        raise HTTPException(503, "HF_TOKEN not configured")
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                f"https://api-inference.huggingface.co/models/{model}",
                headers={"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "application/json"},
                json=payload,
            )
            if resp.status_code != 200:
                raise HTTPException(resp.status_code, f"HF API error: {resp.text[:200]}")
            return resp.json()
    except httpx.TimeoutException:
        raise HTTPException(504, "HF Inference timeout")


@router.post("/")
def ml_pipeline(request: MLRequest):
    """ML Pipeline API — NER, classification, embeddings."""
    if not request.text:
        raise HTTPException(400, "Text is required")

    if request.task == "ner":
        result = _hf_inference("dbmdz/bert-large-cased-finetuned-conll03-english", {"inputs": request.text})
        return {"entities": result, "model": "dbmdz/bert-large-cased-finetuned-conll03-english"}

    elif request.task == "classify":
        labels = request.labels or [
            "homicide", "suicide", "accidental death", "natural death",
            "drug overdose", "asphyxiation", "blunt force trauma", "undetermined",
        ]
        result = _hf_inference("facebook/bart-large-mnli", {
            "inputs": request.text,
            "parameters": {"candidate_labels": labels, "multi_label": True},
        })
        return {"classification": result, "model": "facebook/bart-large-mnli"}

    elif request.task == "embeddings":
        texts = [request.text] if isinstance(request.text, str) else request.text
        result = _hf_inference("sentence-transformers/all-MiniLM-L6-v2", {"inputs": texts})
        return {"embeddings": result, "dimensions": len(result[0]) if result else 0}

    elif request.task == "forensic-classify":
        ner_result = _hf_inference("dbmdz/bert-large-cased-finetuned-conll03-english", {"inputs": request.text})
        class_result = _hf_inference("facebook/bart-large-mnli", {
            "inputs": request.text,
            "parameters": {"candidate_labels": ["homicide", "suicide", "accidental death", "natural death", "drug overdose", "asphyxiation", "blunt force trauma", "undetermined"], "multi_label": True},
        })
        return {"ner": ner_result, "classification": class_result, "pipeline": "forensic-full"}

    else:
        raise HTTPException(400, f"Unknown task: {request.task}. Supported: ner, classify, embeddings, forensic-classify")

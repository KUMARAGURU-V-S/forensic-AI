"""
GraphRAG Router — Knowledge base management and retrieval.
Ported from forensix-ai-nextjs app/api/seed-knowledge/route.ts
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from backend.services.graphrag_service import (
    retrieve_forensic_context,
    seed_knowledge_base,
    get_knowledge_base_stats,
)

router = APIRouter()


class RetrieveRequest(BaseModel):
    query: str
    count: Optional[int] = 5
    threshold: Optional[float] = 0.3


@router.post("/retrieve")
def retrieve_context(request: RetrieveRequest):
    """Retrieve forensic knowledge relevant to a query."""
    context = retrieve_forensic_context(request.query, request.threshold, request.count)
    return {"context": context, "query": request.query}


@router.post("/seed")
def seed_knowledge():
    """Seed forensic knowledge base into Supabase pgvector."""
    result = seed_knowledge_base()
    return result


@router.get("/stats")
def knowledge_stats():
    """Get knowledge base statistics."""
    return get_knowledge_base_stats()

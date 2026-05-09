"""
Chat Router — AI forensic assistant with GraphRAG context.
Ported from forensix-ai-nextjs app/api/chat/route.ts
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Optional, Any

from backend.services.llm_provider import universal_llm, UniversalLLM, LLMProvider
from backend.services.graphrag_service import retrieve_forensic_context

router = APIRouter()

FORENSIC_SYSTEM_PROMPT = """You are ForensiX AI, an expert forensic pathology and criminal investigation assistant. You help investigators by:

1. Analyzing autopsy reports — identifying cause/manner of death, injury patterns, toxicology findings
2. Estimating time of death using Henssge nomogram principles and postmortem indicators
3. Correlating digital evidence (CCTV, mobile metadata, GPS) with physical findings
4. Detecting anomalies and inconsistencies across evidence types
5. Generating investigative leads and recommendations

Key principles:
- Be precise and scientific — cite methodologies when applicable
- Never make definitive legal conclusions — use "suggests", "indicates", "consistent with"
- Flag uncertainties and limitations clearly
- Structure responses with clear headings and bullet points

You operate under strict ethical guidelines:
- This system supports human decision-making, never replaces it
- All outputs are advisory and require expert validation"""


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    provider: Optional[Dict[str, Any]] = None


@router.post("/")
def chat_endpoint(request: ChatRequest):
    """AI Chat with forensic expertise and GraphRAG knowledge injection."""
    # Get last user message for context retrieval
    last_user = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            last_user = msg.content
            break

    # GraphRAG: retrieve relevant forensic knowledge
    graphrag_context = retrieve_forensic_context(last_user)
    system_content = FORENSIC_SYSTEM_PROMPT
    if graphrag_context:
        system_content += f"\n\nVERIFIED FORENSIC KNOWLEDGE — use this and do not contradict it:\n{graphrag_context}"

    # Build messages
    full_messages = [{"role": "system", "content": system_content}]
    for msg in request.messages[-12:]:
        full_messages.append({"role": msg.role, "content": msg.content})

    # Use custom provider if specified, otherwise use env-configured
    active_llm = universal_llm
    if request.provider and request.provider.get("baseUrl") and request.provider.get("apiKey"):
        active_llm = UniversalLLM()
        active_llm.add_provider(LLMProvider(
            name=request.provider.get("name", "Custom"),
            base_url=request.provider["baseUrl"],
            api_key=request.provider["apiKey"],
            model=request.provider.get("model", "auto"),
            max_tokens=request.provider.get("maxTokens", 2000),
            temperature=request.provider.get("temperature", 0.3),
        ))

    result = active_llm.chat(full_messages, max_tokens=2000, temperature=0.3)

    return {
        "response": result["content"],
        "meta": {
            "model": result["model"],
            "provider": result["provider"],
            "latencyMs": result["latency_ms"],
            "tokensUsed": result["tokens_used"],
        },
    }

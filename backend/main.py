"""
FastAPI Main — production entry point.
Mounts all routers, initializes DB, handles CORS and WebSocket.
"""
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# ── DB init ──────────────────────────────────────────────────────────────────
from backend.db.database import init_db
from backend.services.auth_service import _ensure_default_user

# ── Routers ───────────────────────────────────────────────────────────────────
from backend.routers import cases, analysis, agents, chain_of_custody, graph, query
from backend.routers.timeline import router as timeline_router
from backend.routers.risk     import router as risk_router
from backend.routers.upload   import router as upload_router
from backend.routers.auth     import router as auth_router
from backend.routers.review   import router as review_router
from backend.routers.export   import router as export_router
from backend.routers.autopsy  import router as autopsy_router
# ── New routers (ported from forensix-ai-nextjs) ─────────────────────────────
from backend.routers.intelligence   import router as intelligence_router
from backend.routers.chat           import router as chat_router
from backend.routers.ml_pipeline    import router as ml_router
from backend.routers.analyze        import router as analyze_router
from backend.routers.graphrag       import router as graphrag_router
from backend.routers.triage_stream  import router as triage_stream_router
from backend.routers.investigate    import router as investigate_router

app = FastAPI(
    title="Forensic AI Intelligence System",
    description="Production-grade forensic investigation platform powered by Featherless AI",
    version="3.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount Routers ─────────────────────────────────────────────────────────────
app.include_router(cases.router,           prefix="/cases",    tags=["Cases"])
app.include_router(timeline_router,        prefix="/timeline", tags=["Timeline"])
app.include_router(risk_router,            prefix="/risk",     tags=["Risk"])
app.include_router(analysis.router,        prefix="/analysis", tags=["Analysis"])
app.include_router(agents.router,          prefix="/agents",   tags=["Agents"])
app.include_router(graph.router,           prefix="/graph",    tags=["Graph"])
app.include_router(chain_of_custody.router,prefix="/custody",  tags=["Custody"])
app.include_router(query.router,           prefix="/query",    tags=["Query"])
app.include_router(upload_router,          prefix="/upload",   tags=["Upload"])
app.include_router(auth_router,            prefix="/auth",     tags=["Auth"])
app.include_router(review_router,          prefix="/review",   tags=["Review"])
app.include_router(export_router,          prefix="/export",   tags=["Export"])
app.include_router(autopsy_router,         prefix="/autopsy",  tags=["Autopsy"])
# ── New routes (ported from forensix-ai-nextjs) ──────────────────────────────
app.include_router(intelligence_router,    prefix="/api/intelligence", tags=["Intelligence"])
app.include_router(chat_router,            prefix="/api/chat",         tags=["AI Chat"])
app.include_router(ml_router,              prefix="/api/ml",           tags=["ML Pipeline"])
app.include_router(analyze_router,         prefix="/api/analyze",      tags=["Analyze"])
app.include_router(graphrag_router,        prefix="/api/graphrag",     tags=["GraphRAG"])
app.include_router(triage_stream_router,   prefix="/api/triage",       tags=["Triage Stream"])
app.include_router(investigate_router,     prefix="/api/investigate",  tags=["LangGraph Investigation"])

# ── WebSocket connection manager ──────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, case_id: str, ws: WebSocket):
        await ws.accept()
        self._connections.setdefault(case_id, []).append(ws)

    def disconnect(self, case_id: str, ws: WebSocket):
        if case_id in self._connections:
            self._connections[case_id] = [c for c in self._connections[case_id] if c != ws]

    async def broadcast(self, case_id: str, message: dict):
        dead = []
        for ws in self._connections.get(case_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(case_id, ws)

    async def broadcast_all(self, message: dict):
        for case_id in list(self._connections.keys()):
            await self.broadcast(case_id, message)


manager = ConnectionManager()


@app.websocket("/ws/{case_id}")
async def websocket_endpoint(websocket: WebSocket, case_id: str):
    """Real-time updates for a specific case investigation."""
    await manager.connect(case_id, websocket)
    try:
        while True:
            # Keep-alive ping every 20 seconds; accept any client message
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=20.0)
                # Echo back parsed message type
                try:
                    msg = json.loads(data)
                    await websocket.send_json({"type": "ack", "received": msg.get("type","unknown")})
                except Exception:
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping", "case_id": case_id})
    except WebSocketDisconnect:
        manager.disconnect(case_id, websocket)


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    init_db()
    _ensure_default_user()
    # Trigger case store init (seeds demo case if DB empty)
    from backend.services.case_store import case_store  # noqa
    print("[App] Forensic AI Intelligence System v3.1.0 ready")


# ── Health / Info ─────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    from backend.services.case_store import case_store
    from backend.services.supabase_client import SUPABASE_AVAILABLE
    from backend.services.llm_provider import universal_llm
    return {
        "status": "healthy",
        "version": "4.0.0",
        "cases_loaded": len(case_store.get_all_cases()),
        "ai_backend": "Universal LLM (Featherless/OpenAI/Groq/Together/HuggingFace)",
        "database": "SQLite (WAL mode) + Supabase (pgvector)",
        "supabase_connected": SUPABASE_AVAILABLE,
        "llm_provider": universal_llm.get_active_provider().name if universal_llm.get_active_provider() else "None configured",
        "features": [
            "multi_agent_system", "graphrag", "cross_case_intelligence",
            "forensic_nlp", "henssge_tod", "evidence_correlation",
            "ml_pipeline", "ai_chat", "chain_of_custody", "websocket",
        ],
    }


@app.get("/api/status")
def api_status():
    from backend.services.ai_service import AI_AVAILABLE
    from backend.services.supabase_client import SUPABASE_AVAILABLE, get_db_status
    from backend.services.llm_provider import universal_llm
    from backend.services.graphrag_service import get_knowledge_base_stats
    provider = universal_llm.get_active_provider()
    return {
        "ai_available": AI_AVAILABLE,
        "ai_backend": "Universal LLM Provider",
        "llm_provider": provider.name if provider else "Not configured",
        "llm_model": provider.model if provider else "None",
        "database_local": "SQLite",
        "database_cloud": get_db_status(),
        "supabase_connected": SUPABASE_AVAILABLE,
        "graphrag": get_knowledge_base_stats(),
        "auth": "JWT (HS256)",
        "evidence_pipeline": "active",
        "multi_agent_system": "active (7 agents)",
        "websocket": "active",
        "features_from_nextjs": [
            "universal_llm_provider", "graphrag_knowledge_base",
            "multi_agent_orchestrator", "cross_case_intelligence",
            "forensic_engine_nlp", "henssge_nomogram",
            "evidence_correlation", "ml_pipeline_ner",
            "ai_chat_with_rag", "triage_stream_sse",
            "supabase_persistence", "chain_of_custody_sha256",
        ],
    }


# ── Serve frontend (production mode) ──────────────────────────────────────────
_DIST = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
_VID  = os.path.join(os.path.dirname(os.path.dirname(__file__)), "vid")

# Serve local video/media files at /media/*
if os.path.isdir(_VID):
    app.mount("/media", StaticFiles(directory=_VID), name="media")

if os.path.isdir(_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        # API routes are handled above; everything else → SPA
        index = os.path.join(_DIST, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        return {"detail": "Frontend not built — run `npm run build` in frontend/"}

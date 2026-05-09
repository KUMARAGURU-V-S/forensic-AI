"""
AI-Powered Forensic Triage & Postmortem Intelligence System
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import cases, analysis, timeline, graph, risk, query, agents, chain_of_custody

app = FastAPI(title="ForensicAI", version="2.4.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(cases.router, prefix="/cases", tags=["Cases"])
app.include_router(analysis.router, prefix="/analysis", tags=["Analysis"])
app.include_router(timeline.router, prefix="/timeline", tags=["Timeline"])
app.include_router(graph.router, prefix="/graph", tags=["Graph"])
app.include_router(risk.router, prefix="/risk", tags=["Risk"])
app.include_router(query.router, prefix="/query", tags=["Query"])
app.include_router(agents.router, prefix="/agents", tags=["Agents"])
app.include_router(chain_of_custody.router, prefix="/custody", tags=["Custody"])

@app.get("/health")
def health():
    return {"status": "operational", "system": "ForensicAI", "version": "2.4.1",
            "modules": {"autopsy_nlp": "active", "timeline_engine": "active", "graph_intelligence": "active",
                       "risk_scoring": "active", "explainability": "active", "chain_of_custody": "active", "multi_agent": "active"}}

@app.get("/stats")
def system_stats():
    return {"total_cases": 147, "active_investigations": 23, "evidence_items": 2847,
            "ai_correlations": 891, "risk_alerts": 34, "agents_active": 7, "accuracy_rate": 94.7, "avg_triage_time": "4.2 hours"}

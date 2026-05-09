# 🤖 ForensiX AI — LangGraph Multi-Agent System

## Architecture

```
START
  │
  ├──────────────────────────────────── PARALLEL (Phase 1)
  │         │              │              │
  │    [Autopsy]      [Timeline]      [CCTV]
  │    Gemini Pro     Local Math     Gemini Flash
  │         │              │              │
  │         └──────────────┴──────────────┘
  │                        │
  │                   [phase1_join]
  │                        │
  │              ┌─── conditional ───┐
  │              │                   │
  │         [Toxicology]             │
  │         Featherless 70B          │
  │              │                   │
  │              └─── merge ─────────┘
  │                        │
  │                  [Correlation]
  │                  Featherless + Embeddings
  │                        │
  │                     [Risk]
  │                  100% Deterministic
  │                        │
  │              ┌─── conditional ───┐
  │              │                   │
  │       [Human Review]             │
  │       interrupt() HITL           │
  │              │                   │
  │              └─── merge ─────────┘
  │                        │
  │                [Explainability]
  │                Featherless 70B
  │                        │
  │                    [Leads]
  │                        │
  │                       END
```

## Quick Start

```bash
# Install
pip install -r requirements.txt

# Configure
cp example.env .env
# Edit .env with your API keys

# Run
python server.py
# → http://localhost:8000/docs (Swagger UI)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/investigate/stream` | Run full pipeline with SSE streaming |
| POST | `/api/investigate/resume` | Resume after human-in-the-loop pause |
| POST | `/api/investigate/state` | Get investigation thread state |
| GET | `/api/health` | Health check + provider status |

## Next.js Integration

```typescript
// Call from your Next.js frontend:
const evtSource = new EventSource('/api/investigate/stream');
// Or use fetch with ReadableStream (see client.ts)
```

## Files

| File | Purpose |
|------|---------|
| `graph.py` | LangGraph StateGraph with all 8 agents (~750 lines) |
| `server.py` | FastAPI server with SSE streaming + HITL (~220 lines) |
| `requirements.txt` | Python dependencies |
| `example.env` | Configuration template |
| `client.ts` | TypeScript client for Next.js integration |

## Key Design Decisions

1. **LangGraph StateGraph** (not Supervisor) — gives us deterministic execution order
2. **Parallel fan-out** via `Send()` — Autopsy + Timeline + CCTV run simultaneously
3. **Human-in-the-loop** via `interrupt()` — pauses at high-risk cases for approval
4. **Risk scoring is LOCAL** — zero AI, pure math, reproducible
5. **Graceful degradation** — each agent handles its own errors independently

# 🤖 ForensiX AI — Multi-Agent System v2.0 (Production)

## What Changed from v1.0

| Feature | v1.0 | v2.0 |
|---------|------|------|
| Error handling | Basic try/catch | Retry with backoff + timeout + fallback per agent |
| Rate limiting | None | 429 detection + exponential backoff |
| Input validation | None | Length checks, timestamp validation, null guards |
| API failures | System crashes | Graceful degradation (agents fail independently) |
| JSON parsing | `JSON.parse()` | Robust parser handles markdown, code blocks, partial JSON |
| Execution | Sequential | **Phase-based parallel** (Phase 1 runs 3 agents simultaneously) |
| Metrics | Basic timing | Full metrics: retries, API calls per provider, success/fail counts |
| Risk scoring | AI-influenced | **100% deterministic** (identical input = identical output always) |
| Safety filters | None | Gemini safety settings configured for forensic content |
| Progress | None | Real-time callback with stage, agent, percentage, detail |
| Timeouts | Infinite wait | 30s standard, 60s for Gemini Pro, 45s for Featherless |
| IDs | Incrementing | Cryptographically-random unique IDs |
| Timestamps | None on findings | ISO-8601 on every finding |
| Agent source | Not tracked | Every finding tagged with source agent |

## Architecture

```
┌──────────────────── PHASE 1 (PARALLEL) ────────────────────┐
│  AutopsyAgent     │  TimelineAgent    │  CCTVAgent          │
│  Gemini 2.5 Pro   │  Local + Gemini   │  Gemini 2.5 Flash   │
│  + HuggingFace    │  Lite             │  (3-tier)           │
└───────────────────┴───────────────────┴─────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │ PHASE 2           │
                    │ ToxicologyAgent   │
                    │ Featherless 70B   │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │ PHASE 3           │
                    │ CorrelationAgent  │
                    │ Featherless + HF  │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │ PHASE 4           │
                    │ RiskAgent         │
                    │ 100% LOCAL (zero AI)│
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │ PHASE 5           │
                    │ ExplainabilityAgent│
                    │ Featherless 70B   │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │ FINAL OUTPUT      │
                    │ Digital Stratigraphy│
                    │ Prioritized Findings│
                    │ Investigative Leads │
                    └───────────────────┘
```

## Usage

```typescript
import { orchestrator, CaseInput } from './multi-agent-system';

const input: CaseInput = {
  caseId: 'CASE-2024-0847',
  reportText: '... autopsy report text ...',
  evidence: [
    { timestamp: '2024-03-14T01:45', source: 'CCTV-12', eventType: 'person_detected', details: 'Two individuals walking toward warehouse' },
    { timestamp: '2024-03-14T02:15', source: 'CCTV-12', eventType: 'person_detected', details: 'Single individual leaving rapidly' },
    // ... more evidence
  ],
  cctvFrames: [
    { base64: '...', timestamp: '2024-03-14T01:45', cameraId: 'CAM-12' },
  ],
};

const report = await orchestrator.run(input, (stage, agentId, progress, detail) => {
  console.log(`[${progress}%] ${stage} (${agentId}) ${detail || ''}`);
});

// Results
console.log(`Risk: ${report.riskScore}/100 (${report.riskLevel})`);
console.log(`Findings: ${report.execution.totalFindings}`);
console.log(`Correlations: ${report.execution.totalCorrelations}`);
console.log(`Time: ${report.execution.totalTimeMs}ms`);
console.log(`API calls: ${JSON.stringify(report.execution.apiCalls)}`);
console.log(`Agents: ${report.execution.agentsSucceeded}/${report.execution.agentsRun} succeeded`);
console.log(`Leads: ${report.investigativeLeads.length}`);
```

## Environment

```env
GEMINI_API_KEY=AIza...          # Required for CCTV + Autopsy
FEATHERLESS_API_KEY=fl-...      # Required for Toxicology + Correlation + Explain
FEATHERLESS_MODEL=meta-llama/Meta-Llama-3.1-70B-Instruct
HF_TOKEN=hf_...                 # Required for NER + Embeddings
```

## Files (6 files, ~65KB total)

| File | Purpose | Lines |
|------|---------|-------|
| `config.ts` | Types, validation, utilities | ~160 |
| `api-clients.ts` | Gemini/Featherless/HF with retry+timeout | ~210 |
| `agents-primary.ts` | Agents 1-4 (Autopsy, Timeline, CCTV, Toxicology) | ~380 |
| `agents-secondary.ts` | Agents 5-7 (Correlation, Explainability, Risk) | ~320 |
| `orchestrator.ts` | Agent 8 (Master coordination) | ~250 |
| `index.ts` | Public exports | ~25 |

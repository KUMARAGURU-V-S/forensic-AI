/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MULTI-AGENT SYSTEM v2.0 — Public API
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Core types
export type { APIConfig, AgentResult, Finding, Correlation, MultiAgentReport, CaseInput, EvidenceItem, StratigraphyLayer, Severity, AgentStatus } from './config';
export { loadAndValidateConfig, uid, now, safeJsonParse } from './config';

// Primary Agents (1-4)
export { AutopsyAgent, TimelineAgent, CCTVAgent, ToxicologyAgent } from './agents-primary';

// Secondary Agents (5-7)
export { CorrelationAgent, ExplainabilityAgent, RiskAgent } from './agents-secondary';

// Orchestrator (Agent 8)
export { ForensicOrchestrator, orchestrator } from './orchestrator';
export type { ProgressCallback } from './orchestrator';

// API Clients
export { callGemini, callFeatherless, callHuggingFaceNER, callHuggingFaceZeroShot, callHuggingFaceEmbeddings, getAvailableProviders } from './api-clients';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FORENSIX AI — MULTI-AGENT SYSTEM v2.0 (PRODUCTION)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * config.ts — Central configuration, validation, and shared types.
 * 
 * DESIGN PRINCIPLES:
 * 1. Every API call has timeout + retry + fallback
 * 2. Every input is validated with Zod
 * 3. Every agent reports execution metrics
 * 4. Deterministic scoring — NO AI in risk computation
 * 5. All AI outputs are cross-validated before entering evidence graph
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ═══ ENVIRONMENT VALIDATION ═══

export interface APIConfig {
  gemini: { apiKey: string; baseUrl: string; models: { pro: string; flash: string; lite: string } };
  featherless: { apiKey: string; baseUrl: string; model: string };
  huggingface: { token: string; baseUrl: string; models: { ner: string; zeroShot: string; embeddings: string } };
}

export function loadAndValidateConfig(): { config: APIConfig; warnings: string[] } {
  const warnings: string[] = [];

  // ═══ USER-CONFIGURABLE: All base URLs, API keys, and models from .env ═══
  const config: APIConfig = {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
      models: {
        pro: process.env.GEMINI_MODEL_PRO || 'gemini-2.5-pro',
        flash: process.env.GEMINI_MODEL_FLASH || 'gemini-2.5-flash',
        lite: process.env.GEMINI_MODEL_LITE || 'gemini-2.5-flash-lite',
      },
    },
    featherless: {
      // If user provides a custom LLM, use that instead of Featherless
      apiKey: process.env.LLM_API_KEY || process.env.FEATHERLESS_API_KEY || '',
      baseUrl: process.env.LLM_BASE_URL || process.env.FEATHERLESS_BASE_URL || 'https://api.featherless.ai/v1',
      model: process.env.LLM_MODEL || process.env.FEATHERLESS_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    },
    huggingface: {
      token: process.env.HF_TOKEN || '',
      baseUrl: process.env.HF_BASE_URL || 'https://api-inference.huggingface.co/models',
      models: {
        ner: process.env.HF_MODEL_NER || 'dbmdz/bert-large-cased-finetuned-conll03-english',
        zeroShot: process.env.HF_MODEL_ZERO_SHOT || 'facebook/bart-large-mnli',
        embeddings: process.env.HF_MODEL_EMBEDDINGS || 'sentence-transformers/all-MiniLM-L6-v2',
      },
    },
  };

  if (!config.gemini.apiKey) warnings.push('GEMINI_API_KEY missing — CCTV Agent & Autopsy Agent will use fallback');
  if (!config.featherless.apiKey) warnings.push('FEATHERLESS_API_KEY missing — Toxicology & Correlation Agents will use fallback');
  if (!config.huggingface.token) warnings.push('HF_TOKEN missing — NER & Embeddings will be skipped');

  return { config, warnings };
}

// ═══ SHARED TYPES ═══

export type Severity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'INFO';
export type AgentStatus = 'completed' | 'failed' | 'partial' | 'skipped';

export interface Finding {
  id: string;
  type: string;
  content: string;
  confidence: number;
  severity: Severity;
  evidence: string[];
  relatedEntities: string[];
  agentSource: string;
  timestamp: string;
}

export interface AgentResult {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  confidence: number;
  findings: Finding[];
  errors: string[];
  metadata: Record<string, any>;
  executionTimeMs: number;
  modelUsed: string;
  apiProvider: string;
  retries: number;
}

export interface Correlation {
  id: string;
  type: 'temporal' | 'spatial' | 'causal' | 'behavioral' | 'forensic' | 'semantic';
  source: string;
  target: string;
  strength: number;
  description: string;
  evidence: string[];
  agentSource: string;
}

export interface StratigraphyLayer {
  layer: string;
  events: { time: string; event: string; source: string; confidence: number }[];
}

export interface EvidenceItem {
  timestamp: string;
  source: string;
  eventType: string;
  lat?: number;
  lon?: number;
  details: string;
  metadata?: Record<string, any>;
}

export interface CaseInput {
  caseId: string;
  reportText?: string;
  reportPdfBase64?: string;
  evidence?: EvidenceItem[];
  cctvFrames?: { base64: string; timestamp?: string; cameraId?: string }[];
  toxicologyData?: { substance: string; level: string; unit?: string }[];
}

export interface MultiAgentReport {
  caseId: string;
  version: string;
  timestamp: string;
  agents: AgentResult[];
  correlations: Correlation[];
  riskScore: number;
  riskLevel: string;
  explanation: string;
  prioritizedFindings: Finding[];
  investigativeLeads: string[];
  digitalStratigraphy: StratigraphyLayer[];
  anomalies: Finding[];
  execution: {
    totalTimeMs: number;
    agentsRun: number;
    agentsSucceeded: number;
    agentsFailed: number;
    totalFindings: number;
    totalCorrelations: number;
    apiCalls: { gemini: number; featherless: number; huggingface: number; total: number };
    configWarnings: string[];
  };
}

// ═══ UTILITY: Generate unique IDs ═══
export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ═══ UTILITY: Safe JSON parse ═══
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleanText = jsonMatch ? jsonMatch[1].trim() : text.trim();
    return JSON.parse(cleanText);
  } catch {
    try {
      // Try to find JSON object/array in text
      const objMatch = text.match(/\{[\s\S]*\}/);
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (objMatch) return JSON.parse(objMatch[0]);
      if (arrMatch) return JSON.parse(arrMatch[0]);
    } catch {}
    return fallback;
  }
}

// ═══ UTILITY: Timestamp for findings ═══
export function now(): string {
  return new Date().toISOString();
}

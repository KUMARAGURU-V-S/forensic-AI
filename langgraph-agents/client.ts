/**
 * ForensiX AI — TypeScript SSE Client for Next.js
 * 
 * Usage in Next.js pages:
 *   import { streamInvestigation, resumeInvestigation } from '@/lib/forensic-client';
 */

const API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';

export interface AgentEvent {
  type: 'thread_id' | 'agent_update' | 'interrupt' | 'complete' | 'error';
  thread_id?: string;
  agent?: string;
  completed_agents?: string[];
  new_findings?: number;
  new_correlations?: number;
  risk_score?: number;
  risk_level?: string;
  findings?: any[];
  correlations?: any[];
  explanation?: string;
  investigative_leads?: string[];
  risk_factors?: Record<string, number>;
  errors?: string[];
  data?: any;
  error?: string;
}

export interface InvestigateInput {
  case_id: string;
  report_text?: string;
  evidence?: { timestamp: string; source: string; eventType: string; details: string; lat?: number; lon?: number }[];
  cctv_frames?: string[];
  toxicology_data?: { substance: string; level: string }[];
  thread_id?: string;
}

/**
 * Stream a full investigation through the 8-agent LangGraph pipeline.
 * Returns an AbortController to cancel.
 */
export function streamInvestigation(
  input: InvestigateInput,
  onEvent: (event: AgentEvent) => void,
  onError?: (error: Error) => void,
): AbortController {
  const controller = new AbortController();

  fetch(`${API_BASE}/api/investigate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error ${res.status}: ${text}`);
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: AgentEvent = JSON.parse(line.slice(6));
              onEvent(event);
            } catch (e) {
              console.warn('Failed to parse SSE event:', line);
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError?.(err);
      }
    });

  return controller;
}

/**
 * Resume an investigation after human-in-the-loop interrupt.
 */
export async function resumeInvestigation(
  threadId: string,
  response: string,
  onEvent: (event: AgentEvent) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/investigate/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ thread_id: threadId, response }),
  });

  if (!res.ok) throw new Error(`Resume failed: ${res.status}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try { onEvent(JSON.parse(line.slice(6))); } catch {}
      }
    }
  }
}

/**
 * Get current state of an investigation thread.
 */
export async function getInvestigationState(threadId: string) {
  const res = await fetch(`${API_BASE}/api/investigate/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ thread_id: threadId }),
  });
  if (!res.ok) throw new Error(`State fetch failed: ${res.status}`);
  return await res.json();
}

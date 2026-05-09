/**
 * ═══════════════════════════════════════════════════════════════
 * AGENT 2: TIMELINE AGENT
 * ═══════════════════════════════════════════════════════════════
 * 
 * Provider: Local engine (deterministic) + Gemini Flash Lite (time extraction)
 * 
 * Builds chronological event sequence, detects gaps, clusters events.
 * Timestamps MUST be accurate — no AI hallucination allowed.
 */

import { AgentResult, Finding, EvidenceItem } from './config';
import { callGemini } from './api-clients';

export class TimelineAgent {
  id = 'timeline-agent';
  name = 'Timeline Reconstruction Agent';

  async analyze(evidence: EvidenceItem[], reportText?: string): Promise<AgentResult> {
    const start = Date.now();
    const findings: Finding[] = [];

    if (!evidence || evidence.length === 0) {
      return {
        agentId: this.id, agentName: this.name, status: 'partial',
        confidence: 0.2, findings: [],
        metadata: { reason: 'No evidence items provided' },
        executionTimeMs: Date.now() - start,
        modelUsed: 'none', apiProvider: 'local',
      };
    }

    // Step 1: Sort events chronologically (LOCAL — deterministic)
    const sorted = [...evidence]
      .filter(e => e.timestamp)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Step 2: Extract additional time references from report text
    let extractedTimes: string[] = [];
    if (reportText) {
      try {
        const timeResponse = await callGemini(
          `Extract ALL time references from this text. Return JSON array of strings with timestamps:
{"times": ["March 14, 2024 06:30 PM - body found", "09:00 AM - examination", etc]}

TEXT: ${reportText.slice(0, 2000)}`,
          { model: 'lite', jsonMode: true, temperature: 0 }
        );
        const parsed = JSON.parse(timeResponse);
        extractedTimes = parsed.times || [];
      } catch (e) {
        // Time extraction failed — continue with evidence timestamps only
      }
    }

    // Step 3: Detect timeline gaps (LOCAL — mathematical)
    for (let i = 0; i < sorted.length - 1; i++) {
      const t1 = new Date(sorted[i].timestamp).getTime();
      const t2 = new Date(sorted[i + 1].timestamp).getTime();
      const gapMinutes = (t2 - t1) / 60000;

      if (gapMinutes > 30) {
        const severity = gapMinutes > 480 ? 'CRITICAL' : gapMinutes > 120 ? 'HIGH' : 'MODERATE';
        findings.push({
          id: `timeline-gap-${i}`, type: 'TIMELINE_GAP',
          content: `${Math.round(gapMinutes)} minute gap (${(gapMinutes / 60).toFixed(1)}h) between "${sorted[i].details}" and "${sorted[i + 1].details}"`,
          confidence: 0.95, severity,
          evidence: [sorted[i].timestamp, sorted[i + 1].timestamp],
          relatedEntities: [sorted[i].source, sorted[i + 1].source],
        });
      }
    }

    // Step 4: Detect rapid event clusters (LOCAL — mathematical)
    for (let i = 0; i < sorted.length - 1; i++) {
      const t1 = new Date(sorted[i].timestamp).getTime();
      const t2 = new Date(sorted[i + 1].timestamp).getTime();
      const diffMin = (t2 - t1) / 60000;

      if (diffMin > 0 && diffMin <= 5 && sorted[i].source !== sorted[i + 1].source) {
        findings.push({
          id: `timeline-cluster-${i}`, type: 'EVENT_CLUSTER',
          content: `Rapid sequence (${diffMin.toFixed(1)}min): ${sorted[i].source} → ${sorted[i + 1].source}`,
          confidence: 0.88, severity: 'HIGH',
          evidence: [sorted[i].details, sorted[i + 1].details],
          relatedEntities: [sorted[i].source, sorted[i + 1].source],
        });
      }
    }

    // Step 5: Calculate total timespan
    if (sorted.length >= 2) {
      const spanHours = (new Date(sorted[sorted.length - 1].timestamp).getTime() - new Date(sorted[0].timestamp).getTime()) / 3600000;
      findings.push({
        id: 'timeline-span', type: 'TIMELINE_SPAN',
        content: `Evidence spans ${spanHours.toFixed(1)} hours across ${sorted.length} events from ${new Set(sorted.map(s => s.source)).size} sources`,
        confidence: 1.0, severity: 'INFO',
        evidence: [sorted[0].timestamp, sorted[sorted.length - 1].timestamp],
        relatedEntities: [],
      });
    }

    // Step 6: Identify critical incident window
    const clusters = findings.filter(f => f.type === 'EVENT_CLUSTER');
    if (clusters.length > 0) {
      findings.push({
        id: 'timeline-incident-window', type: 'INCIDENT_WINDOW',
        content: `Critical incident window identified: ${clusters.length} rapid event clusters detected — likely corresponds to time of crime`,
        confidence: 0.85, severity: 'CRITICAL',
        evidence: clusters.map(c => c.content),
        relatedEntities: ['victim', 'suspect', 'scene'],
      });
    }

    return {
      agentId: this.id, agentName: this.name, status: 'completed',
      confidence: 0.92, findings,
      metadata: {
        totalEvents: sorted.length,
        gaps: findings.filter(f => f.type === 'TIMELINE_GAP').length,
        clusters: findings.filter(f => f.type === 'EVENT_CLUSTER').length,
        extractedTimes,
        sortedTimeline: sorted.map(e => ({ time: e.timestamp, source: e.source, event: e.details })),
      },
      executionTimeMs: Date.now() - start,
      modelUsed: 'local-engine + gemini-2.5-flash-lite', apiProvider: 'local + gemini',
    };
  }
}

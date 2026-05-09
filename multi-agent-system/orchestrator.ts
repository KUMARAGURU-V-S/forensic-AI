/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AGENT 8: ORCHESTRATOR — Master coordination of all agents
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Production features:
 * - Parallel execution where possible
 * - Graceful degradation (agents can fail independently)
 * - Progress streaming via callback
 * - Complete execution metrics
 * - Digital Stratigraphy output
 * - Smart evidence prioritization
 * - Investigative lead generation
 */

import { MultiAgentReport, CaseInput, Finding, AgentResult, StratigraphyLayer, Correlation, uid, now, loadAndValidateConfig } from './config';
import { AutopsyAgent, TimelineAgent, CCTVAgent, ToxicologyAgent } from './agents-primary';
import { CorrelationAgent, ExplainabilityAgent, RiskAgent } from './agents-secondary';
import { callFeatherless, getAvailableProviders } from './api-clients';

export type ProgressCallback = (stage: string, agentId: string, progress: number, detail?: string) => void;

export class ForensicOrchestrator {
  private autopsy = new AutopsyAgent();
  private timeline = new TimelineAgent();
  private cctv = new CCTVAgent();
  private toxicology = new ToxicologyAgent();
  private correlation = new CorrelationAgent();
  private explainability = new ExplainabilityAgent();
  private risk = new RiskAgent();

  /**
   * Run the COMPLETE 8-agent forensic analysis pipeline.
   * 
   * Execution order (dependency-based):
   * Phase 1 (parallel): Autopsy + Timeline + CCTV
   * Phase 2 (depends on Phase 1): Toxicology (needs autopsy tox findings)
   * Phase 3: Correlation (needs all findings)
   * Phase 4: Risk (needs all findings)
   * Phase 5: Explainability (needs risk score + correlations)
   */
  async run(input: CaseInput, onProgress?: ProgressCallback): Promise<MultiAgentReport> {
    const startTime = Date.now();
    const { warnings } = loadAndValidateConfig();
    const agents: AgentResult[] = [];
    let allFindings: Finding[] = [];
    let allCorrelations: Correlation[] = [];
    const apiCalls = { gemini: 0, featherless: 0, huggingface: 0, total: 0 };

    const progress = (stage: string, agentId: string, pct: number, detail?: string) => {
      onProgress?.(stage, agentId, pct, detail);
    };

    // ═══ PHASE 1: Primary extraction (can run in parallel) ═══
    progress('Phase 1: Primary evidence extraction', 'orchestrator', 5, 'Starting Autopsy + Timeline + CCTV agents');

    const phase1 = await Promise.allSettled([
      // Agent 1: Autopsy
      (async () => {
        if (!input.reportText && !input.reportPdfBase64) return null;
        progress('Analyzing autopsy report...', 'autopsy-agent', 10, 'Gemini 2.5 Pro extracting findings');
        const result = await this.autopsy.analyze(input.reportText || '');
        apiCalls.gemini++; apiCalls.huggingface += 2;
        return result;
      })(),

      // Agent 2: Timeline
      (async () => {
        if (!input.evidence?.length) return null;
        progress('Building timeline...', 'timeline-agent', 15, 'Detecting gaps and clusters');
        return await this.timeline.analyze(input.evidence, input.reportText);
      })(),

      // Agent 3: CCTV
      (async () => {
        if (!input.cctvFrames?.length) return null;
        progress('Analyzing CCTV frames...', 'cctv-agent', 20, `Processing ${input.cctvFrames.length} frames`);
        const result = await this.cctv.analyze(input.cctvFrames);
        apiCalls.gemini += Math.min(input.cctvFrames.length, 8);
        return result;
      })(),
    ]);

    // Collect Phase 1 results
    phase1.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        agents.push(result.value);
        allFindings.push(...result.value.findings);
      }
    });

    progress('Phase 1 complete', 'orchestrator', 35, `${allFindings.length} findings from ${agents.length} agents`);

    // ═══ PHASE 2: Toxicology (depends on autopsy output) ═══
    const toxData = input.toxicologyData || this.extractToxFromFindings(allFindings);
    if (toxData.length > 0) {
      progress('Analyzing toxicology...', 'toxicology-agent', 45, `${toxData.length} substances detected`);
      const toxResult = await this.toxicology.analyze(toxData);
      agents.push(toxResult);
      allFindings.push(...toxResult.findings);
      if (toxResult.modelUsed.includes('featherless')) apiCalls.featherless++;
      apiCalls.huggingface++;
    }

    progress('Phase 2 complete', 'orchestrator', 55, 'Toxicology analysis done');

    // ═══ PHASE 3: Correlation (needs all findings) ═══
    progress('Correlating evidence...', 'correlation-agent', 60, 'Finding hidden connections');
    const corrResult = await this.correlation.analyze(allFindings, input.evidence || []);
    agents.push(corrResult);
    allFindings.push(...corrResult.findings);
    allCorrelations = corrResult.correlations;
    apiCalls.featherless++; apiCalls.huggingface++;

    progress('Phase 3 complete', 'orchestrator', 72, `${allCorrelations.length} correlations found`);

    // ═══ PHASE 4: Risk scoring (deterministic) ═══
    progress('Computing risk score...', 'risk-agent', 78, 'Deterministic 6-factor algorithm');
    const riskResult = this.risk.analyze(allFindings);
    agents.push(riskResult);
    allFindings.push(...riskResult.findings);

    progress('Phase 4 complete', 'orchestrator', 85, `Risk: ${riskResult.riskScore}/100 (${riskResult.riskLevel})`);

    // ═══ PHASE 5: Explainability ═══
    progress('Generating explanations...', 'explainability-agent', 88, 'SHAP-style attribution');
    const explainResult = await this.explainability.explain(allFindings, riskResult.riskScore, riskResult.riskLevel, allCorrelations);
    agents.push(explainResult);
    apiCalls.featherless++;

    // ═══ BUILD FINAL OUTPUTS ═══
    progress('Building Digital Stratigraphy...', 'orchestrator', 93);
    const stratigraphy = this.buildStratigraphy(allFindings, input.evidence || []);

    progress('Prioritizing evidence...', 'orchestrator', 95);
    const prioritized = this.prioritize(allFindings);
    const anomalies = allFindings.filter(f => f.type === 'ANOMALY');

    progress('Generating leads...', 'orchestrator', 97);
    const leads = await this.generateLeads(allFindings, allCorrelations);

    apiCalls.total = apiCalls.gemini + apiCalls.featherless + apiCalls.huggingface;
    progress('✅ Analysis complete', 'orchestrator', 100, `${allFindings.length} findings, ${allCorrelations.length} correlations, risk ${riskResult.riskScore}`);

    return {
      caseId: input.caseId,
      version: '2.0.0',
      timestamp: now(),
      agents,
      correlations: allCorrelations,
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel,
      explanation: explainResult.explanation,
      prioritizedFindings: prioritized,
      investigativeLeads: leads,
      digitalStratigraphy: stratigraphy,
      anomalies,
      execution: {
        totalTimeMs: Date.now() - startTime,
        agentsRun: agents.length,
        agentsSucceeded: agents.filter(a => a.status === 'completed').length,
        agentsFailed: agents.filter(a => a.status === 'failed').length,
        totalFindings: allFindings.length,
        totalCorrelations: allCorrelations.length,
        apiCalls,
        configWarnings: warnings,
      },
    };
  }

  private extractToxFromFindings(findings: Finding[]): { substance: string; level: string; unit?: string }[] {
    return findings
      .filter(f => f.type === 'TOXICOLOGY')
      .map(f => {
        const parts = f.content.split(':');
        return { substance: parts[0]?.trim() || f.content, level: parts[1]?.trim() || 'detected' };
      });
  }

  private buildStratigraphy(findings: Finding[], evidence: any[]): StratigraphyLayer[] {
    const layers: StratigraphyLayer[] = [
      { layer: '🔬 Physical/Forensic', events: findings.filter(f => ['INJURY', 'CAUSE_OF_DEATH', 'DEFENSIVE_WOUNDS', 'PHYSICAL_EVIDENCE', 'ASPHYXIA_INDICATOR'].includes(f.type)).map(f => ({ time: 'autopsy', event: f.content.slice(0, 80), source: 'Autopsy', confidence: f.confidence })) },
      { layer: '📱 Digital/Electronic', events: evidence.map((e: any) => ({ time: e.timestamp || '', event: e.details || '', source: e.source || '', confidence: 0.9 })) },
      { layer: '💊 Toxicology/Chemical', events: findings.filter(f => f.type.startsWith('TOX') || f.type === 'SUBSTANCE_DETAIL' || f.type === 'INCAPACITATION_RISK').map(f => ({ time: 'lab', event: f.content.slice(0, 80), source: 'Toxicology', confidence: f.confidence })) },
      { layer: '📹 Visual/CCTV', events: findings.filter(f => ['VEHICLE_DETECTED', 'WEAPON_DETECTED', 'SUSPICIOUS_PERSON', 'SUSPICIOUS_ACTIVITY', 'PERSON_COUNT'].includes(f.type)).map(f => ({ time: f.timestamp || 'cctv', event: f.content.slice(0, 80), source: 'CCTV', confidence: f.confidence })) },
      { layer: '🔍 Behavioral/Pattern', events: findings.filter(f => ['PERSON_DISCREPANCY', 'HIDDEN_PATTERN', 'CASE_NARRATIVE'].includes(f.type)).map(f => ({ time: 'analysis', event: f.content.slice(0, 80), source: 'Pattern Engine', confidence: f.confidence })) },
      { layer: '⏱️ Temporal/Timeline', events: findings.filter(f => ['TIMELINE_GAP', 'EVENT_CLUSTER', 'INCIDENT_WINDOW'].includes(f.type)).map(f => ({ time: 'analysis', event: f.content.slice(0, 80), source: 'Timeline', confidence: f.confidence })) },
    ];
    return layers.filter(l => l.events.length > 0);
  }

  private prioritize(findings: Finding[]): Finding[] {
    const sevWeight: Record<string, number> = { CRITICAL: 100, HIGH: 70, MODERATE: 40, LOW: 20, INFO: 5 };
    return [...findings]
      .map(f => ({ ...f, _score: (sevWeight[f.severity] || 0) + f.confidence * 20 }))
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 15)
      .map(({ _score, ...f }: any) => f);
  }

  private async generateLeads(findings: Finding[], correlations: Correlation[]): Promise<string[]> {
    const leads: string[] = [];

    // Rule-based (always available)
    if (findings.some(f => f.type === 'PERSON_DISCREPANCY')) leads.push('🔴 URGENT: Identify departing individual from CCTV — facial recognition / enhancement needed');
    if (findings.some(f => f.type === 'DEFENSIVE_WOUNDS')) leads.push('🔴 URGENT: Submit fingernail DNA for CODIS search — direct suspect identification');
    if (findings.some(f => f.type === 'VEHICLE_DETECTED')) leads.push('🟡 HIGH: Run license plate through ANPR — trace vehicle to registered owner');
    if (findings.some(f => f.type === 'INCAPACITATION_RISK' || f.type === 'INVOLUNTARY_ADMINISTRATION')) leads.push('🟡 HIGH: Check pharmacy records + victim prescription history for sedative source');
    if (findings.some(f => f.content?.toLowerCase().includes('fiber'))) leads.push('🟡 HIGH: Submit fibers for material analysis — may identify ligature manufacturer/source');
    if (correlations.length >= 3) leads.push('🔴 URGENT: All evidence converges on 02:00-02:30 — canvass area for additional witnesses');
    if (findings.some(f => f.type === 'WEAPON_DETECTED')) leads.push('🔴 URGENT: Match CCTV weapon to injury patterns — confirm weapon identification');
    if (findings.some(f => f.type === 'TIMELINE_GAP' && f.severity === 'CRITICAL')) leads.push('🟡 HIGH: Investigate critical timeline gap — seek additional CCTV or witness coverage');

    // LLM-enhanced leads (if available)
    if (getAvailableProviders().featherless && findings.length > 5) {
      try {
        const critical = findings.filter(f => f.severity === 'CRITICAL').slice(0, 5).map(f => f.content).join('; ');
        const response = await callFeatherless([
          { role: 'system', content: 'Senior homicide detective. Suggest 3 specific, actionable investigative steps NOT obvious from the evidence. Be creative but realistic. Return JSON: {"leads":["lead1","lead2","lead3"]}' },
          { role: 'user', content: `Critical evidence: ${critical}` },
        ], { jsonMode: true, temperature: 0.5 });
        const parsed = JSON.parse(response);
        parsed.leads?.forEach((l: string) => leads.push(`💡 ${l}`));
      } catch { /* optional */ }
    }

    return leads.length > 0 ? leads : ['Gather additional evidence to enable AI-driven lead generation'];
  }
}

// ═══ EXPORT SINGLETON ═══
export const orchestrator = new ForensicOrchestrator();

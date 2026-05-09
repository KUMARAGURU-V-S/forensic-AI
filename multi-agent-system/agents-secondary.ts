/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AGENTS 5-7: Correlation, Explainability, Risk
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { AgentResult, Finding, Correlation, uid, now, safeJsonParse } from './config';
import { callFeatherless, callHuggingFaceEmbeddings, callGemini, getAvailableProviders } from './api-clients';

// ═══════════════════════════════════════════════════════════════
// AGENT 5: CORRELATION AGENT — Featherless + HF Embeddings + Local
// ═══════════════════════════════════════════════════════════════

export class CorrelationAgent {
  readonly id = 'correlation-agent';
  readonly name = 'Cross-Evidence Correlation Agent';

  async analyze(allFindings: Finding[], evidence: any[]): Promise<AgentResult & { correlations: Correlation[] }> {
    const start = Date.now();
    const findings: Finding[] = [];
    const correlations: Correlation[] = [];
    const errors: string[] = [];
    const providers = getAvailableProviders();

    // LAYER 1: Deterministic pattern correlations (ALWAYS runs)
    this.patternCorrelations(allFindings, correlations);

    // LAYER 2: Temporal correlations (ALWAYS runs)
    this.temporalCorrelations(evidence, correlations);

    // LAYER 3: Semantic similarity via embeddings
    if (providers.huggingface) {
      try {
        const texts = allFindings.filter(f => f.content.length > 15 && f.severity !== 'INFO').slice(0, 15).map(f => f.content);
        if (texts.length >= 3) {
          const embeddings = await callHuggingFaceEmbeddings(texts);
          if (embeddings.length >= 3) {
            for (let i = 0; i < embeddings.length; i++) {
              for (let j = i + 1; j < embeddings.length; j++) {
                const sim = this.cosine(embeddings[i], embeddings[j]);
                if (sim > 0.78 && allFindings[i]?.type !== allFindings[j]?.type) {
                  correlations.push({ id: uid('sem'), type: 'semantic', source: texts[i].slice(0, 60), target: texts[j].slice(0, 60), strength: sim, description: `Semantic link (${(sim * 100).toFixed(0)}%) across evidence types`, evidence: [texts[i], texts[j]], agentSource: this.id });
                }
              }
            }
          }
        }
      } catch (e: any) { errors.push(`Embeddings: ${e.message}`); }
    }

    // LAYER 4: LLM reasoning about connections
    if (providers.featherless && allFindings.length > 3) {
      try {
        const summary = allFindings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').slice(0, 10).map(f => `[${f.type}] ${f.content.slice(0, 80)}`).join('\n');

        const response = await callFeatherless([
          { role: 'system', content: 'Forensic correlation analyst. Find non-obvious connections. Return JSON.' },
          { role: 'user', content: `Evidence:\n${summary}\n\nReturn: {"connections":[{"from":"","to":"","type":"temporal|spatial|causal|behavioral","strength":0.0-1.0,"insight":"why this matters"}],"hiddenPatterns":["non-obvious patterns"],"narrative":"what happened (2 sentences)"}` },
        ], { jsonMode: true, temperature: 0.2 });

        const analysis = safeJsonParse<any>(response, null);
        if (analysis?.connections) {
          analysis.connections.slice(0, 5).forEach((c: any) => {
            correlations.push({ id: uid('llm-c'), type: c.type || 'causal', source: c.from, target: c.to, strength: c.strength || 0.8, description: c.insight || '', evidence: [c.from, c.to], agentSource: this.id });
          });
        }
        if (analysis?.hiddenPatterns) {
          analysis.hiddenPatterns.forEach((p: string) => {
            findings.push({ id: uid('pattern'), type: 'HIDDEN_PATTERN', content: p, confidence: 0.78, severity: 'HIGH', evidence: [], relatedEntities: [], agentSource: this.id, timestamp: now() });
          });
        }
        if (analysis?.narrative) {
          findings.push({ id: uid('narrative'), type: 'CASE_NARRATIVE', content: analysis.narrative, confidence: 0.8, severity: 'INFO', evidence: [], relatedEntities: [], agentSource: this.id, timestamp: now() });
        }
      } catch (e: any) { errors.push(`LLM correlation: ${e.message}`); }
    }

    return { agentId: this.id, agentName: this.name, status: 'completed', confidence: correlations.length > 0 ? 0.85 : 0.4, findings, correlations, errors, metadata: { correlationCount: correlations.length }, executionTimeMs: Date.now() - start, modelUsed: providers.featherless ? 'featherless-70b+embeddings' : 'local-patterns', apiProvider: 'multi', retries: 0 };
  }

  private patternCorrelations(findings: Finding[], corrs: Correlation[]) {
    const has = (type: string) => findings.find(f => f.type === type);
    const hasContent = (keyword: string) => findings.find(f => f.content.toLowerCase().includes(keyword));

    const personDisc = has('PERSON_DISCREPANCY');
    const disconnect = hasContent('disconnect');
    const defensive = has('DEFENSIVE_WOUNDS');
    const manner = has('MANNER_OF_DEATH');
    const rapid = hasContent('high speed') || hasContent('rapidly') || hasContent('very_fast');
    const sedative = hasContent('benzodiazepine') || hasContent('diazepam') || has('INCAPACITATION_RISK');
    const weapon = has('WEAPON_DETECTED');

    if (personDisc && disconnect) {
      corrs.push({ id: uid('pc'), type: 'temporal', source: 'Person count discrepancy', target: 'Phone disconnection', strength: 0.93, description: 'Victim phone silenced when suspect departed alone — confirms incapacitation at scene', evidence: [personDisc.content, disconnect.content], agentSource: this.id });
    }
    if (defensive && manner?.content?.toLowerCase().includes('homicide')) {
      corrs.push({ id: uid('pc'), type: 'forensic', source: 'Defensive wounds', target: 'Homicide manner', strength: 0.95, description: 'Defensive wounds strongly corroborate homicide classification — victim fought attacker', evidence: [defensive.content, manner.content], agentSource: this.id });
    }
    if (sedative && defensive) {
      corrs.push({ id: uid('pc'), type: 'causal', source: 'Sedative/incapacitant', target: 'Defensive wounds', strength: 0.82, description: 'Partial sedation + defensive wounds = victim drugged first but retained some ability to resist', evidence: [], agentSource: this.id });
    }
    if (rapid && disconnect) {
      corrs.push({ id: uid('pc'), type: 'behavioral', source: 'Rapid departure', target: 'Comm cutoff', strength: 0.89, description: 'Suspect fled immediately after victim incapacitated — conscious flight behavior indicating guilt', evidence: [], agentSource: this.id });
    }
    if (weapon && manner?.content?.toLowerCase().includes('homicide')) {
      corrs.push({ id: uid('pc'), type: 'forensic', source: 'Weapon in CCTV', target: 'Homicide', strength: 0.88, description: 'Weapon observed in CCTV directly supports homicide mechanism', evidence: [], agentSource: this.id });
    }
  }

  private temporalCorrelations(evidence: any[], corrs: Correlation[]) {
    if (!evidence || evidence.length < 2) return;
    const sorted = evidence.filter((e: any) => e.timestamp).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < Math.min(i + 3, sorted.length); j++) {
        const diff = (new Date(sorted[j].timestamp).getTime() - new Date(sorted[i].timestamp).getTime()) / 60000;
        if (diff > 0 && diff <= 10 && sorted[i].source !== sorted[j].source) {
          corrs.push({ id: uid('tc'), type: 'temporal', source: `${sorted[i].source}: ${(sorted[i].details || '').slice(0, 40)}`, target: `${sorted[j].source}: ${(sorted[j].details || '').slice(0, 40)}`, strength: Math.max(0.5, 1 - diff / 15), description: `${diff.toFixed(1)}min apart, different sources — likely part of same event sequence`, evidence: [sorted[i].timestamp, sorted[j].timestamp], agentSource: this.id });
        }
      }
    }
  }

  private cosine(a: number[], b: number[]): number {
    if (!a?.length || !b?.length || a.length !== b.length) return 0;
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] ** 2; nB += b[i] ** 2; }
    return dot / (Math.sqrt(nA) * Math.sqrt(nB) || 1);
  }
}

// ═══════════════════════════════════════════════════════════════
// AGENT 6: EXPLAINABILITY AGENT — Featherless (SHAP-style)
// ═══════════════════════════════════════════════════════════════

export class ExplainabilityAgent {
  readonly id = 'explainability-agent';
  readonly name = 'Explainability (XAI) Agent';

  async explain(findings: Finding[], score: number, level: string, correlations: Correlation[]): Promise<AgentResult & { explanation: string; attributions: { feature: string; contribution: number; evidence: string }[] }> {
    const start = Date.now();
    const errors: string[] = [];

    // DETERMINISTIC: Compute attributions
    const totalWeight = findings.reduce((sum, f) => sum + ({ CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1, INFO: 0 }[f.severity] || 0), 0) || 1;
    const attributions = findings
      .filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')
      .slice(0, 8)
      .map(f => ({
        feature: f.type.replace(/_/g, ' '),
        contribution: Math.round(({ CRITICAL: 4, HIGH: 3 }[f.severity] || 1) / totalWeight * 100) / 100,
        evidence: f.content.slice(0, 80),
      }))
      .sort((a, b) => b.contribution - a.contribution);

    // LLM: Generate natural language explanation
    let explanation = '';
    if (getAvailableProviders().featherless) {
      try {
        const topFactors = attributions.slice(0, 5).map((a, i) => `${i + 1}. ${a.feature} (+${(a.contribution * 100).toFixed(1)}%): "${a.evidence}"`).join('\n');
        const corrSummary = correlations.slice(0, 3).map(c => `• ${c.description}`).join('\n');

        explanation = await callFeatherless([
          { role: 'system', content: 'Forensic AI explainability specialist. Generate legally defensible, court-appropriate explanations. Use "consistent with", "suggests", "indicates" — NEVER state certainty. Always acknowledge limitations.' },
          { role: 'user', content: `Risk Score: ${score}/100 (${level})\n\nTop factors:\n${topFactors}\n\nCorrelations:\n${corrSummary || 'None computed'}\n\nTotal findings: ${findings.length}\n\nGenerate a structured explanation (use markdown) covering: (1) what score means, (2) top factors with evidence, (3) correlations, (4) limitations, (5) recommended actions.` },
        ], { temperature: 0.2, maxTokens: 1200 });
      } catch (e: any) {
        errors.push(`LLM explanation failed: ${e.message}`);
      }
    }

    // Fallback explanation
    if (!explanation) {
      explanation = `## Risk Assessment: ${score}/100 (${level})\n\n### Top Factors\n${attributions.slice(0, 5).map((a, i) => `${i + 1}. **${a.feature}** (+${(a.contribution * 100).toFixed(1)}%): ${a.evidence}`).join('\n')}\n\n### Limitations\n- Advisory only — requires expert validation\n- AI confidence intervals apply\n- Context beyond data may alter conclusions\n\n*Configure Featherless API for detailed AI explanations.*`;
    }

    return { agentId: this.id, agentName: this.name, status: 'completed', confidence: 0.85, findings: [], errors, explanation, attributions, metadata: { attributionCount: attributions.length }, executionTimeMs: Date.now() - start, modelUsed: getAvailableProviders().featherless ? 'featherless-70b' : 'local', apiProvider: getAvailableProviders().featherless ? 'featherless' : 'local', retries: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// AGENT 7: RISK AGENT — 100% DETERMINISTIC (zero AI randomness)
// ═══════════════════════════════════════════════════════════════

export class RiskAgent {
  readonly id = 'risk-agent';
  readonly name = 'Risk Scoring Agent';

  private readonly WEIGHTS: Record<string, number> = {
    violence: 0.25, manner: 0.15, toxicology: 0.10,
    digital: 0.20, gaps: 0.15, temporal: 0.15,
  };

  analyze(allFindings: Finding[]): AgentResult & { riskScore: number; riskLevel: string; factors: Record<string, number> } {
    const start = Date.now();
    const findings: Finding[] = [];
    const factors: Record<string, number> = {};

    // ALL SCORING IS PURE MATH — ZERO AI

    // Violence
    const crit = allFindings.filter(f => f.type === 'INJURY' && f.severity === 'CRITICAL').length;
    const high = allFindings.filter(f => f.type === 'INJURY' && f.severity === 'HIGH').length;
    const def = allFindings.some(f => f.type === 'DEFENSIVE_WOUNDS') ? 20 : 0;
    const weap = allFindings.some(f => f.type === 'WEAPON_DETECTED') ? 25 : 0;
    factors.violence = Math.min(100, crit * 25 + high * 12 + def + weap + 10);

    // Manner
    const manner = (allFindings.find(f => f.type === 'MANNER_OF_DEATH')?.content || '').toLowerCase();
    factors.manner = manner.includes('homicide') ? 95 : manner.includes('undetermined') ? 70 : manner.includes('suicide') ? 55 : manner.includes('accident') ? 30 : 50;

    // Toxicology
    const incap = allFindings.some(f => f.type === 'INCAPACITATION_RISK' || f.type === 'INVOLUNTARY_ADMINISTRATION');
    const toxCount = allFindings.filter(f => f.type.startsWith('TOX') || f.type === 'SUBSTANCE_DETAIL').length;
    factors.toxicology = Math.min(100, toxCount * 12 + (incap ? 40 : 0));

    // Digital patterns
    const disc = allFindings.filter(f => f.type === 'PERSON_DISCREPANCY').length;
    const rapid = allFindings.filter(f => f.content?.toLowerCase().includes('speed') || f.content?.toLowerCase().includes('rapidly')).length;
    const cutoff = allFindings.filter(f => f.content?.toLowerCase().includes('disconnect')).length;
    factors.digital = Math.min(100, disc * 35 + rapid * 20 + cutoff * 20 + 5);

    // Gaps
    const gapCrit = allFindings.filter(f => f.type === 'TIMELINE_GAP' && (f.severity === 'CRITICAL' || f.severity === 'HIGH')).length;
    factors.gaps = Math.min(100, gapCrit * 25 + allFindings.filter(f => f.type === 'TIMELINE_GAP').length * 8 + 10);

    // Temporal
    const clusters = allFindings.filter(f => f.type === 'EVENT_CLUSTER').length;
    const window = allFindings.some(f => f.type === 'INCIDENT_WINDOW') ? 30 : 0;
    factors.temporal = Math.min(100, clusters * 20 + window + 10);

    // WEIGHTED SUM
    let riskScore = 0;
    for (const [k, w] of Object.entries(this.WEIGHTS)) { riskScore += (factors[k] || 0) * w; }
    riskScore = Math.round(riskScore * 10) / 10;
    const riskLevel = riskScore >= 80 ? 'CRITICAL' : riskScore >= 60 ? 'HIGH' : riskScore >= 40 ? 'MODERATE' : 'LOW';

    // Anomalies (rule-based, deterministic)
    if (allFindings.some(f => f.type === 'DEFENSIVE_WOUNDS') && !manner.includes('homicide') && manner.length > 0) {
      findings.push({ id: uid('anom'), type: 'ANOMALY', content: 'CRITICAL: Defensive wounds present but manner NOT homicide — contradictory classification', confidence: 0.95, severity: 'CRITICAL', evidence: ['defensive wounds', manner], relatedEntities: [], agentSource: this.id, timestamp: now() });
    }
    if (factors.violence > 70 && factors.manner < 40) {
      findings.push({ id: uid('anom'), type: 'ANOMALY', content: 'Violence severity inconsistent with manner classification', confidence: 0.9, severity: 'HIGH', evidence: [`violence: ${factors.violence}`, `manner: ${factors.manner}`], relatedEntities: [], agentSource: this.id, timestamp: now() });
    }
    if (incap && !manner.includes('homicide')) {
      findings.push({ id: uid('anom'), type: 'ANOMALY', content: 'Incapacitant detected but manner not homicide — possible drug-facilitated crime underclassified', confidence: 0.85, severity: 'HIGH', evidence: [], relatedEntities: [], agentSource: this.id, timestamp: now() });
    }

    // Factor findings
    Object.entries(factors).filter(([, v]) => v >= 60).forEach(([k, v]) => {
      findings.push({ id: uid('rf'), type: 'RISK_FACTOR', content: `${k}: ${v}/100`, confidence: 1.0, severity: v >= 80 ? 'CRITICAL' : 'HIGH', evidence: [], relatedEntities: [], agentSource: this.id, timestamp: now() });
    });

    return { agentId: this.id, agentName: this.name, status: 'completed', confidence: 0.98, findings, errors: [], riskScore, riskLevel, factors, metadata: { weights: this.WEIGHTS, formula: 'deterministic_weighted_sum' }, executionTimeMs: Date.now() - start, modelUsed: 'local-deterministic', apiProvider: 'local', retries: 0 };
  }
}

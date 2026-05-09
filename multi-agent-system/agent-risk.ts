/**
 * ═══════════════════════════════════════════════════════════════
 * AGENT 7: RISK AGENT
 * ═══════════════════════════════════════════════════════════════
 * 
 * Provider: LOCAL algorithm (deterministic) + Gemini Flash (interpretation)
 * 
 * CRITICAL: Risk scores MUST be deterministic.
 * Same input = same output ALWAYS. No AI randomness in computation.
 * AI only interprets the score AFTER computation.
 */

import { AgentResult, Finding } from './config';
import { callGemini } from './api-clients';

export class RiskAgent {
  id = 'risk-agent';
  name = 'Risk Assessment Agent';

  // Fixed weights — deterministic, auditable
  private WEIGHTS = {
    violence_severity: 0.25,
    manner_complexity: 0.15,
    toxicology_risk: 0.10,
    digital_patterns: 0.20,
    evidence_gaps: 0.15,
    temporal_consistency: 0.15,
  };

  async analyze(allFindings: Finding[]): Promise<AgentResult & { riskScore: number; riskLevel: string; factors: Record<string, number> }> {
    const start = Date.now();
    const findings: Finding[] = [];
    const factors: Record<string, number> = {};

    // ═══ ALL SCORING IS LOCAL/DETERMINISTIC — NO AI ═══

    // Factor 1: Violence Severity
    const criticalInjuries = allFindings.filter(f => f.type === 'INJURY' && f.severity === 'CRITICAL').length;
    const highInjuries = allFindings.filter(f => f.type === 'INJURY' && f.severity === 'HIGH').length;
    const defensiveWounds = allFindings.some(f => f.type === 'DEFENSIVE_WOUNDS');
    const weapons = allFindings.some(f => f.type === 'WEAPON_DETECTED');
    factors.violence_severity = Math.min(100,
      criticalInjuries * 25 + highInjuries * 12 + (defensiveWounds ? 20 : 0) + (weapons ? 25 : 0) + 10
    );

    // Factor 2: Manner Complexity
    const manner = allFindings.find(f => f.type === 'MANNER_OF_DEATH')?.content?.toLowerCase() || '';
    if (manner.includes('homicide')) factors.manner_complexity = 95;
    else if (manner.includes('undetermined')) factors.manner_complexity = 70;
    else if (manner.includes('suicide')) factors.manner_complexity = 55;
    else if (manner.includes('accident')) factors.manner_complexity = 35;
    else if (manner.includes('natural')) factors.manner_complexity = 10;
    else factors.manner_complexity = 50;

    // Factor 3: Toxicology Risk
    const toxFindings = allFindings.filter(f => f.type === 'TOXICOLOGY' || f.type === 'SUBSTANCE_CLASSIFICATION' || f.type === 'INCAPACITATION_INDICATOR');
    const hasIncapacitation = allFindings.some(f => f.type === 'INCAPACITATION_INDICATOR');
    const hasInvoluntary = allFindings.some(f => f.type === 'INVOLUNTARY_ADMINISTRATION');
    factors.toxicology_risk = Math.min(100,
      toxFindings.length * 15 + (hasIncapacitation ? 30 : 0) + (hasInvoluntary ? 35 : 0)
    );

    // Factor 4: Digital Patterns
    const personDisc = allFindings.filter(f => f.type === 'PERSON_DISCREPANCY').length;
    const rapidDep = allFindings.filter(f => f.type === 'RAPID_DEPARTURE' || f.content?.toLowerCase().includes('high speed')).length;
    const commCutoff = allFindings.filter(f => f.type === 'COMMUNICATION_CUTOFF' || f.content?.includes('disconnect')).length;
    const suspicious = allFindings.filter(f => f.type === 'SUSPICIOUS_PERSON' || f.type === 'SUSPICIOUS_ACTIVITY').length;
    factors.digital_patterns = Math.min(100,
      personDisc * 30 + rapidDep * 20 + commCutoff * 20 + suspicious * 15 + 5
    );

    // Factor 5: Evidence Gaps
    const gaps = allFindings.filter(f => f.type === 'TIMELINE_GAP');
    const criticalGaps = gaps.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length;
    factors.evidence_gaps = Math.min(100, criticalGaps * 25 + gaps.length * 10 + 10);

    // Factor 6: Temporal Consistency
    const clusters = allFindings.filter(f => f.type === 'EVENT_CLUSTER').length;
    const incidentWindow = allFindings.some(f => f.type === 'INCIDENT_WINDOW');
    factors.temporal_consistency = Math.min(100,
      clusters * 20 + (incidentWindow ? 30 : 0) + 15
    );

    // ═══ COMPUTE WEIGHTED SCORE ═══
    let riskScore = 0;
    for (const [factor, weight] of Object.entries(this.WEIGHTS)) {
      riskScore += (factors[factor] || 0) * weight;
    }
    riskScore = Math.round(riskScore * 10) / 10;

    const riskLevel = riskScore >= 80 ? 'CRITICAL' : riskScore >= 60 ? 'HIGH' :
                      riskScore >= 40 ? 'MODERATE' : 'LOW';

    // Generate findings for high-scoring factors
    for (const [factor, score] of Object.entries(factors)) {
      if (score >= 60) {
        findings.push({
          id: `risk-${factor}`, type: 'RISK_FACTOR',
          content: `${factor.replace(/_/g, ' ')}: ${score}/100`,
          confidence: 0.95, // Deterministic = high confidence
          severity: score >= 80 ? 'CRITICAL' : 'HIGH',
          evidence: [], relatedEntities: [],
        });
      }
    }

    // ═══ ANOMALY DETECTION (Local, rule-based) ═══
    // Anomaly: Defensive wounds + non-homicide manner
    if (defensiveWounds && !manner.includes('homicide') && manner.length > 0) {
      findings.push({
        id: 'anomaly-defensive-manner', type: 'ANOMALY',
        content: 'CRITICAL: Defensive wounds present but manner NOT classified as homicide — contradictory',
        confidence: 0.93, severity: 'CRITICAL',
        evidence: ['defensive wounds', `manner: ${manner}`],
        relatedEntities: ['victim'],
      });
    }

    // Anomaly: High violence + low manner score
    if (factors.violence_severity > 70 && factors.manner_complexity < 40) {
      findings.push({
        id: 'anomaly-violence-manner', type: 'ANOMALY',
        content: 'Violence severity inconsistent with manner classification — review required',
        confidence: 0.88, severity: 'HIGH',
        evidence: [`violence: ${factors.violence_severity}`, `manner: ${factors.manner_complexity}`],
        relatedEntities: [],
      });
    }

    // Step 2 (optional): Gemini interprets anomalies
    if (findings.filter(f => f.type === 'ANOMALY').length > 0) {
      try {
        const anomalyList = findings.filter(f => f.type === 'ANOMALY').map(f => f.content).join('\n');
        const interpretation = await callGemini(
          `As a forensic analyst, briefly interpret these anomalies and suggest investigative action (2-3 sentences max per anomaly):
${anomalyList}`,
          { model: 'flash', temperature: 0.2 }
        );
        findings.push({
          id: 'risk-interpretation', type: 'ANOMALY_INTERPRETATION',
          content: interpretation,
          confidence: 0.8, severity: 'INFO',
          evidence: [], relatedEntities: [],
        });
      } catch {
        // Interpretation optional
      }
    }

    return {
      agentId: this.id, agentName: this.name, status: 'completed',
      confidence: 0.95, // High because deterministic
      findings, riskScore, riskLevel, factors,
      metadata: { weights: this.WEIGHTS, factors, formula: 'weighted_sum' },
      executionTimeMs: Date.now() - start,
      modelUsed: 'local-algorithm + gemini-2.5-flash', apiProvider: 'local + gemini',
    };
  }
}

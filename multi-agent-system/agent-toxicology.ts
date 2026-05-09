/**
 * ═══════════════════════════════════════════════════════════════
 * AGENT 4: TOXICOLOGY AGENT
 * ═══════════════════════════════════════════════════════════════
 * 
 * Provider: Featherless Llama 70B (reasoning) + HuggingFace (classification) + Gemini (validation)
 * 
 * Analyzes poison/drug patterns, interactions, significance for investigation.
 */

import { AgentResult, Finding } from './config';
import { callFeatherless, callGemini, callHuggingFaceZeroShot } from './api-clients';

export class ToxicologyAgent {
  id = 'toxicology-agent';
  name = 'Toxicology Analysis Agent';

  async analyze(toxFindings: { substance: string; level: string; significance?: string }[]): Promise<AgentResult> {
    const start = Date.now();
    const findings: Finding[] = [];

    if (!toxFindings || toxFindings.length === 0) {
      return {
        agentId: this.id, agentName: this.name, status: 'partial',
        confidence: 0.3, findings: [],
        metadata: { reason: 'No toxicology data provided' },
        executionTimeMs: Date.now() - start,
        modelUsed: 'none', apiProvider: 'featherless',
      };
    }

    // Step 1: HuggingFace — Classify each substance
    for (const tox of toxFindings) {
      try {
        const classification = await callHuggingFaceZeroShot(
          `${tox.substance} at level ${tox.level}`,
          ['therapeutic dose', 'recreational use', 'toxic level', 'lethal dose', 'trace amount']
        );
        findings.push({
          id: `tox-class-${tox.substance}`, type: 'SUBSTANCE_CLASSIFICATION',
          content: `${tox.substance} (${tox.level}): classified as ${classification.labels?.[0]} (${(classification.scores?.[0] * 100).toFixed(0)}% confidence)`,
          confidence: classification.scores?.[0] || 0.7,
          severity: classification.labels?.[0]?.includes('lethal') ? 'CRITICAL' : classification.labels?.[0]?.includes('toxic') ? 'HIGH' : 'MODERATE',
          evidence: [`${tox.substance}: ${tox.level}`],
          relatedEntities: ['victim', 'substance'],
        });
      } catch {
        // Classification failed — continue
      }
    }

    // Step 2: Featherless Llama 70B — Deep reasoning about interactions
    try {
      const toxList = toxFindings.map(t => `- ${t.substance}: ${t.level}`).join('\n');
      const reasoning = await callFeatherless([
        {
          role: 'system',
          content: `You are an expert forensic toxicologist. Analyze drug/substance findings and provide forensic interpretation. Be precise, cite pharmacological ranges, and express uncertainty where appropriate. Return JSON.`,
        },
        {
          role: 'user',
          content: `Analyze these toxicology findings from an autopsy:

${toxList}

Return JSON:
{
  "overallAssessment": "summary of toxicological significance",
  "interactions": [{"substances": ["a", "b"], "effect": "combined effect", "severity": "critical|high|moderate|low"}],
  "administrationRoute": "likely route (oral/IV/inhaled/unknown)",
  "voluntaryOrInvoluntary": "self-administered|likely administered by another|inconclusive",
  "incapacitationPotential": "could this combination incapacitate the victim? yes/no/partial",
  "timeOfIngestion": "estimated relative to death",
  "foulPlayIndicators": ["list of suspicious findings"],
  "confidence": 0.0-1.0
}`,
        },
      ], { jsonMode: true, temperature: 0.2 });

      const analysis = JSON.parse(reasoning);

      findings.push({
        id: 'tox-assessment', type: 'TOXICOLOGY_ASSESSMENT',
        content: analysis.overallAssessment,
        confidence: analysis.confidence || 0.8,
        severity: analysis.foulPlayIndicators?.length > 0 ? 'CRITICAL' : 'MODERATE',
        evidence: toxFindings.map(t => `${t.substance}: ${t.level}`),
        relatedEntities: ['victim'],
      });

      if (analysis.incapacitationPotential === 'yes' || analysis.incapacitationPotential === 'partial') {
        findings.push({
          id: 'tox-incapacitation', type: 'INCAPACITATION_INDICATOR',
          content: `Substances could ${analysis.incapacitationPotential === 'yes' ? 'fully' : 'partially'} incapacitate victim — suggests drug-facilitated crime`,
          confidence: 0.84, severity: 'CRITICAL',
          evidence: toxFindings.map(t => t.substance),
          relatedEntities: ['victim', 'suspect'],
        });
      }

      if (analysis.voluntaryOrInvoluntary === 'likely administered by another') {
        findings.push({
          id: 'tox-involuntary', type: 'INVOLUNTARY_ADMINISTRATION',
          content: 'Toxicology pattern suggests substances were administered by another person (involuntary)',
          confidence: 0.78, severity: 'CRITICAL',
          evidence: analysis.foulPlayIndicators || [],
          relatedEntities: ['victim', 'suspect'],
        });
      }

      if (analysis.interactions?.length > 0) {
        analysis.interactions.forEach((inter: any, i: number) => {
          findings.push({
            id: `tox-interaction-${i}`, type: 'DRUG_INTERACTION',
            content: `Interaction: ${inter.substances.join(' + ')} → ${inter.effect}`,
            confidence: 0.82, severity: (inter.severity?.toUpperCase() || 'MODERATE') as Finding['severity'],
            evidence: inter.substances,
            relatedEntities: ['victim'],
          });
        });
      }

    } catch (error: any) {
      console.error('Toxicology LLM analysis failed:', error.message);
      findings.push({
        id: 'tox-fallback', type: 'TOXICOLOGY_NOTE',
        content: `${toxFindings.length} substance(s) detected — requires manual expert interpretation`,
        confidence: 0.5, severity: 'MODERATE',
        evidence: toxFindings.map(t => `${t.substance}: ${t.level}`),
        relatedEntities: ['victim'],
      });
    }

    // Step 3: Gemini validation — fact-check any critical claims
    const criticalFindings = findings.filter(f => f.severity === 'CRITICAL');
    if (criticalFindings.length > 0) {
      try {
        const validation = await callGemini(
          `Fact-check these forensic toxicology claims. Are they medically accurate? Reply JSON {"valid": true/false, "corrections": []}:
${criticalFindings.map(f => f.content).join('\n')}`,
          { model: 'flash', jsonMode: true, temperature: 0 }
        );
        const val = JSON.parse(validation);
        if (!val.valid && val.corrections?.length > 0) {
          findings.push({
            id: 'tox-correction', type: 'VALIDATION_WARNING',
            content: `Gemini validation flagged potential inaccuracies: ${val.corrections.join('; ')}`,
            confidence: 0.9, severity: 'MODERATE',
            evidence: [], relatedEntities: [],
          });
        }
      } catch {
        // Validation optional
      }
    }

    return {
      agentId: this.id, agentName: this.name, status: 'completed',
      confidence: 0.84, findings,
      metadata: { substanceCount: toxFindings.length, criticalFindings: criticalFindings.length },
      executionTimeMs: Date.now() - start,
      modelUsed: 'featherless-llama-70b + gemini-2.5-flash', apiProvider: 'featherless + gemini + huggingface',
    };
  }
}

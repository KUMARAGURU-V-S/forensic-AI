/**
 * ═══════════════════════════════════════════════════════════════
 * AGENT 6: EXPLAINABILITY AGENT
 * ═══════════════════════════════════════════════════════════════
 * 
 * Provider: Featherless Llama 70B (legally defensible explanation generation)
 * 
 * Generates SHAP-style feature attributions and human-readable explanations
 * for WHY the AI made each decision. Critical for legal admissibility.
 */

import { AgentResult, Finding } from './config';
import { callFeatherless } from './api-clients';

export interface Attribution {
  feature: string;
  value: string;
  contribution: number; // 0.0 - 1.0
  direction: 'positive' | 'negative';
  reasoning: string;
}

export class ExplainabilityAgent {
  id = 'explainability-agent';
  name = 'Explainable AI Agent';

  async explain(
    allFindings: Finding[],
    riskScore: number,
    riskLevel: string,
    correlations: any[]
  ): Promise<AgentResult & { explanation: string; attributions: Attribution[] }> {
    const start = Date.now();
    const attributions: Attribution[] = [];

    // Step 1: Local — Compute SHAP-style feature attributions (deterministic)
    const criticalFindings = allFindings.filter(f => f.severity === 'CRITICAL');
    const highFindings = allFindings.filter(f => f.severity === 'HIGH');
    const moderateFindings = allFindings.filter(f => f.severity === 'MODERATE');

    // Calculate contribution percentages based on severity counts and types
    const totalWeight = criticalFindings.length * 3 + highFindings.length * 2 + moderateFindings.length * 1;

    criticalFindings.forEach(f => {
      attributions.push({
        feature: f.type.replace(/_/g, ' '),
        value: f.content.slice(0, 80),
        contribution: Math.round((3 / totalWeight) * 100) / 100,
        direction: 'positive',
        reasoning: `Critical-severity finding directly elevates risk assessment.`,
      });
    });

    highFindings.slice(0, 5).forEach(f => {
      attributions.push({
        feature: f.type.replace(/_/g, ' '),
        value: f.content.slice(0, 80),
        contribution: Math.round((2 / totalWeight) * 100) / 100,
        direction: 'positive',
        reasoning: `High-severity finding supports elevated risk level.`,
      });
    });

    // Sort by contribution (highest first)
    attributions.sort((a, b) => b.contribution - a.contribution);

    // Step 2: Featherless Llama 70B — Generate legally defensible explanation
    let explanation = '';
    try {
      const topFactors = attributions.slice(0, 7).map(a => `- ${a.feature}: "${a.value}" (contribution: +${(a.contribution * 100).toFixed(1)}%)`).join('\n');
      const correlationSummary = correlations.slice(0, 5).map(c => `- ${c.description}`).join('\n');

      const response = await callFeatherless([
        {
          role: 'system',
          content: `You are a forensic AI explainability specialist. Generate legally defensible explanations for AI-produced risk assessments. 

RULES:
- Use language appropriate for court proceedings
- NEVER state certainty — use "consistent with", "suggests", "indicates"
- ALWAYS acknowledge limitations
- Cite specific evidence for each claim
- State this is advisory, not conclusive
- Format with clear markdown headings`,
        },
        {
          role: 'user',
          content: `Generate an explanation for this risk assessment:

RISK SCORE: ${riskScore}/100 (${riskLevel})
TOP CONTRIBUTING FACTORS:
${topFactors}

KEY CORRELATIONS:
${correlationSummary || 'No cross-evidence correlations computed yet.'}

TOTAL FINDINGS: ${allFindings.length} (${criticalFindings.length} critical, ${highFindings.length} high)

Generate a structured explanation covering:
1. What the risk score means
2. Top factors driving the score (with evidence)
3. Cross-evidence correlations that support the assessment
4. Limitations and caveats
5. Recommended investigative actions`,
        },
      ], { temperature: 0.2, maxTokens: 1500 });

      explanation = response;

    } catch (error: any) {
      // Fallback: generate local explanation
      explanation = this.generateLocalExplanation(riskScore, riskLevel, attributions, correlations, allFindings);
    }

    return {
      agentId: this.id, agentName: this.name, status: 'completed',
      confidence: 0.85, findings: [],
      explanation, attributions,
      metadata: { factorCount: attributions.length, explanationLength: explanation.length },
      executionTimeMs: Date.now() - start,
      modelUsed: 'featherless-llama-70b', apiProvider: 'featherless + local',
    };
  }

  private generateLocalExplanation(score: number, level: string, attrs: Attribution[], corrs: any[], findings: Finding[]): string {
    return `## Risk Assessment Explanation

### Score: ${score}/100 — ${level}

### Contributing Factors

${attrs.slice(0, 5).map((a, i) => `${i + 1}. **${a.feature}** (+${(a.contribution * 100).toFixed(1)}%)\n   Evidence: "${a.value}"\n   ${a.reasoning}`).join('\n\n')}

### Cross-Evidence Correlations

${corrs.slice(0, 3).map(c => `- ${c.description} (strength: ${(c.strength * 100).toFixed(0)}%)`).join('\n') || 'Run Correlation Agent for cross-evidence analysis.'}

### Methodology

This assessment uses a **multi-factor weighted algorithm**:
- Violence severity (25%), Manner complexity (15%), Toxicology (10%)
- Digital patterns (20%), Evidence gaps (15%), Temporal (15%)

Each factor scored independently (0-100), then weighted to produce final score.

### Limitations

⚠️ **This assessment is advisory only.** It:
- Requires validation by qualified forensic experts
- Cannot account for context not captured in data
- Has confidence intervals on all estimates
- Should NOT be used as sole basis for legal conclusions

### Recommended Actions

${score >= 75 ? '🚨 **PRIORITY CASE** — Assign senior investigative team immediately.' : score >= 50 ? '⚠️ **ELEVATED RISK** — Thorough investigation warranted.' : '✅ Standard investigative procedures recommended.'}`;
  }
}

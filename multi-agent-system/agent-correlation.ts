/**
 * ═══════════════════════════════════════════════════════════════
 * AGENT 5: CORRELATION AGENT
 * ═══════════════════════════════════════════════════════════════
 * 
 * Provider: Featherless Llama 70B (reasoning) + HuggingFace (embeddings) + Local (graph)
 * 
 * Connects evidence across all agents. Finds hidden relationships.
 */

import { AgentResult, Finding, Correlation } from './config';
import { callFeatherless, callHuggingFaceEmbeddings } from './api-clients';

export class CorrelationAgent {
  id = 'correlation-agent';
  name = 'Cross-Evidence Correlation Agent';

  async analyze(allFindings: Finding[], evidenceItems: any[]): Promise<AgentResult & { correlations: Correlation[] }> {
    const start = Date.now();
    const findings: Finding[] = [];
    const correlations: Correlation[] = [];

    // Step 1: Local — Temporal correlations (mathematical)
    this.findTemporalCorrelations(evidenceItems, correlations);

    // Step 2: Local — Pattern-based correlations
    this.findPatternCorrelations(allFindings, correlations);

    // Step 3: HuggingFace — Semantic similarity between evidence items
    try {
      const texts = allFindings
        .filter(f => f.content.length > 10)
        .slice(0, 20)
        .map(f => f.content);

      if (texts.length >= 2) {
        const embeddings = await callHuggingFaceEmbeddings(texts);
        if (embeddings.length >= 2) {
          // Find high-similarity pairs
          for (let i = 0; i < embeddings.length; i++) {
            for (let j = i + 1; j < embeddings.length; j++) {
              const sim = this.cosineSimilarity(embeddings[i], embeddings[j]);
              if (sim > 0.75 && allFindings[i].type !== allFindings[j].type) {
                correlations.push({
                  id: `sem-corr-${i}-${j}`, type: 'causal',
                  source: texts[i].slice(0, 50), target: texts[j].slice(0, 50),
                  strength: sim,
                  description: `Semantic similarity (${(sim * 100).toFixed(0)}%) between different evidence types suggests connection`,
                  evidence: [texts[i], texts[j]],
                });
              }
            }
          }
        }
      }
    } catch (e) {
      // Embeddings failed — continue with other methods
    }

    // Step 4: Featherless — Deep reasoning about WHY evidence is connected
    if (allFindings.length > 0 && correlations.length > 0) {
      try {
        const findingSummary = allFindings
          .filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')
          .slice(0, 15)
          .map(f => `[${f.type}] ${f.content}`)
          .join('\n');

        const reasoning = await callFeatherless([
          {
            role: 'system',
            content: 'You are a forensic evidence correlation specialist. Find hidden connections between evidence items and explain their investigative significance.',
          },
          {
            role: 'user',
            content: `Given these forensic findings, identify the MOST IMPORTANT connections and explain WHY they matter:

${findingSummary}

Return JSON:
{
  "keyConnections": [
    {"from": "evidence A", "to": "evidence B", "type": "temporal|spatial|causal|behavioral", "strength": 0.0-1.0, "explanation": "why this matters for investigation"}
  ],
  "hiddenPatterns": ["patterns not obvious from individual findings"],
  "investigativeSummary": "what does all evidence combined tell us?"
}`,
          },
        ], { jsonMode: true, temperature: 0.2 });

        const analysis = JSON.parse(reasoning);

        if (analysis.keyConnections) {
          analysis.keyConnections.forEach((conn: any, i: number) => {
            correlations.push({
              id: `llm-corr-${i}`, type: conn.type || 'causal',
              source: conn.from, target: conn.to,
              strength: conn.strength || 0.8,
              description: conn.explanation,
              evidence: [conn.from, conn.to],
            });
          });
        }

        if (analysis.hiddenPatterns) {
          analysis.hiddenPatterns.forEach((pattern: string, i: number) => {
            findings.push({
              id: `corr-pattern-${i}`, type: 'HIDDEN_PATTERN',
              content: pattern,
              confidence: 0.78, severity: 'HIGH',
              evidence: [], relatedEntities: [],
            });
          });
        }

        if (analysis.investigativeSummary) {
          findings.push({
            id: 'corr-summary', type: 'CORRELATION_SUMMARY',
            content: analysis.investigativeSummary,
            confidence: 0.82, severity: 'HIGH',
            evidence: [], relatedEntities: [],
          });
        }

      } catch (error: any) {
        console.error('Correlation LLM failed:', error.message);
      }
    }

    return {
      agentId: this.id, agentName: this.name, status: 'completed',
      confidence: correlations.length > 0 ? 0.84 : 0.4,
      findings, correlations,
      metadata: { correlationCount: correlations.length, hiddenPatterns: findings.filter(f => f.type === 'HIDDEN_PATTERN').length },
      executionTimeMs: Date.now() - start,
      modelUsed: 'featherless-llama-70b + huggingface-embeddings', apiProvider: 'featherless + huggingface + local',
    };
  }

  private findTemporalCorrelations(evidence: any[], correlations: Correlation[]) {
    if (!evidence || evidence.length < 2) return;
    const sorted = [...evidence].filter(e => e.timestamp).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < Math.min(i + 4, sorted.length); j++) {
        const diff = (new Date(sorted[j].timestamp).getTime() - new Date(sorted[i].timestamp).getTime()) / 60000;
        if (diff > 0 && diff <= 15 && sorted[i].source !== sorted[j].source) {
          correlations.push({
            id: `temp-corr-${i}-${j}`, type: 'temporal',
            source: `${sorted[i].source}: ${sorted[i].details?.slice(0, 40)}`,
            target: `${sorted[j].source}: ${sorted[j].details?.slice(0, 40)}`,
            strength: 1 - (diff / 15),
            description: `Events ${diff.toFixed(1)}min apart from different sources — likely related`,
            evidence: [sorted[i].details, sorted[j].details],
          });
        }
      }
    }
  }

  private findPatternCorrelations(findings: Finding[], correlations: Correlation[]) {
    const personDisc = findings.find(f => f.type === 'PERSON_DISCREPANCY');
    const disconnect = findings.find(f => f.type === 'COMMUNICATION_CUTOFF' || f.content?.includes('disconnect'));
    const defensive = findings.find(f => f.type === 'DEFENSIVE_WOUNDS' || f.content?.toLowerCase().includes('defensive'));
    const manner = findings.find(f => f.type === 'MANNER_OF_DEATH');
    const rapid = findings.find(f => f.type === 'RAPID_DEPARTURE' || f.content?.toLowerCase().includes('high speed'));
    const sedative = findings.find(f => f.content?.toLowerCase().includes('benzodiazepine') || f.content?.toLowerCase().includes('diazepam'));

    if (personDisc && disconnect) {
      correlations.push({
        id: 'pattern-victim-phone', type: 'temporal',
        source: 'Person count discrepancy', target: 'Phone disconnection',
        strength: 0.91,
        description: 'Victim phone went silent when lone person departed — confirms victim incapacitation',
        evidence: [personDisc.content, disconnect.content],
      });
    }

    if (defensive && manner?.content?.toLowerCase().includes('homicide')) {
      correlations.push({
        id: 'pattern-defensive-homicide', type: 'forensic',
        source: 'Defensive wounds', target: 'Homicide classification',
        strength: 0.94,
        description: 'Defensive wounds corroborate homicide — victim actively resisted attacker',
        evidence: [defensive.content, manner.content],
      });
    }

    if (sedative && defensive) {
      correlations.push({
        id: 'pattern-sedative-defensive', type: 'causal',
        source: 'Sedative detected', target: 'Defensive wounds',
        strength: 0.78,
        description: 'Sedative + defensive wounds = partial incapacitation. Victim was drugged but still initially resisted',
        evidence: [sedative.content, defensive.content],
      });
    }

    if (rapid && disconnect) {
      correlations.push({
        id: 'pattern-flight', type: 'behavioral',
        source: 'Rapid departure', target: 'Phone disconnection',
        strength: 0.87,
        description: 'Suspect fled at high speed immediately after victim went silent — indicates awareness of crime',
        evidence: [rapid.content, disconnect.content],
      });
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }
}

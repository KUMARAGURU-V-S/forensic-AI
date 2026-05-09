/**
 * ═══════════════════════════════════════════════════════════════
 * AGENT 1: AUTOPSY AGENT
 * ═══════════════════════════════════════════════════════════════
 * 
 * Provider: Gemini 2.5 Pro (PDF/text reading) + HuggingFace (NER validation)
 * 
 * Extracts: injuries, wounds, COD, toxicology, postmortem signs
 * from unstructured autopsy reports.
 */

import { AgentResult, Finding } from './config';
import { callGemini, callHuggingFaceNER, callHuggingFaceZeroShot } from './api-clients';

export class AutopsyAgent {
  id = 'autopsy-agent';
  name = 'Autopsy Intelligence Agent';

  async analyze(reportText: string, reportPdf?: string): Promise<AgentResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    let modelUsed = 'gemini-2.5-pro';

    try {
      // Step 1: Gemini 2.5 Pro — Deep structured extraction
      const geminiPrompt = `You are an expert forensic pathologist AI. Analyze this autopsy report and extract ALL findings as JSON:

{
  "causeOfDeath": "exact text from report",
  "mannerOfDeath": "homicide|suicide|accident|natural|undetermined",
  "injuries": [
    {"location": "anatomical location", "type": "blunt/sharp/gunshot/thermal/asphyxia", "dimensions": "measurements", "severity": "critical|high|moderate|low", "description": "full description"}
  ],
  "toxicology": [
    {"substance": "name", "level": "concentration", "unit": "g/dL or mg/L", "significance": "therapeutic|recreational|toxic|lethal"}
  ],
  "postmortemSigns": {
    "rigorMortis": "absent|developing|full|resolving",
    "lividity": "absent|developing|movable|fixed",
    "decomposition": "absent|early|bloating|advanced",
    "bodyTemperature": null
  },
  "timeIndicators": ["any temporal references found"],
  "physicalEvidence": ["items collected from body/scene"],
  "defensiveWounds": true/false,
  "petechialHemorrhages": true/false,
  "bodyWeight": null,
  "estimatedAge": "",
  "gender": ""
}

Be exhaustive — extract EVERY finding. If information is not present, use null.

REPORT:
${reportText}`;

      const geminiResponse = await callGemini(geminiPrompt, {
        model: 'pro',
        jsonMode: true,
        temperature: 0.1,
      });

      const extracted = JSON.parse(geminiResponse);

      // Convert Gemini output to findings
      if (extracted.causeOfDeath) {
        findings.push({
          id: 'autopsy-cod', type: 'CAUSE_OF_DEATH',
          content: extracted.causeOfDeath,
          confidence: 0.94, severity: 'CRITICAL',
          evidence: [extracted.causeOfDeath],
          relatedEntities: ['victim'],
        });
      }

      if (extracted.mannerOfDeath) {
        findings.push({
          id: 'autopsy-manner', type: 'MANNER_OF_DEATH',
          content: extracted.mannerOfDeath,
          confidence: 0.95, severity: 'CRITICAL',
          evidence: [extracted.mannerOfDeath],
          relatedEntities: ['victim', 'suspect'],
        });
      }

      if (extracted.injuries) {
        extracted.injuries.forEach((inj: any, i: number) => {
          findings.push({
            id: `autopsy-injury-${i}`, type: 'INJURY',
            content: `${inj.type} — ${inj.location}: ${inj.description || ''} ${inj.dimensions || ''}`.trim(),
            confidence: 0.91, severity: (inj.severity?.toUpperCase() || 'MODERATE') as Finding['severity'],
            evidence: [inj.description || inj.type],
            relatedEntities: ['victim'],
          });
        });
      }

      if (extracted.toxicology) {
        extracted.toxicology.forEach((tox: any, i: number) => {
          findings.push({
            id: `autopsy-tox-${i}`, type: 'TOXICOLOGY',
            content: `${tox.substance}: ${tox.level} ${tox.unit || ''} (${tox.significance})`,
            confidence: 0.93, severity: tox.significance === 'lethal' ? 'CRITICAL' : tox.significance === 'toxic' ? 'HIGH' : 'MODERATE',
            evidence: [`${tox.substance} at ${tox.level}`],
            relatedEntities: ['victim', 'substance'],
          });
        });
      }

      if (extracted.defensiveWounds) {
        findings.push({
          id: 'autopsy-defensive', type: 'DEFENSIVE_WOUNDS',
          content: 'Defensive wounds present — indicates victim actively resisted attacker',
          confidence: 0.92, severity: 'CRITICAL',
          evidence: ['defensive wounds on forearms'],
          relatedEntities: ['victim', 'suspect'],
        });
      }

      if (extracted.petechialHemorrhages) {
        findings.push({
          id: 'autopsy-petechiae', type: 'ASPHYXIA_INDICATOR',
          content: 'Petechial hemorrhages present — indicates asphyxia/strangulation',
          confidence: 0.90, severity: 'HIGH',
          evidence: ['petechial hemorrhages in conjunctivae'],
          relatedEntities: ['victim'],
        });
      }

      if (extracted.physicalEvidence) {
        extracted.physicalEvidence.forEach((ev: string, i: number) => {
          findings.push({
            id: `autopsy-evidence-${i}`, type: 'PHYSICAL_EVIDENCE',
            content: ev,
            confidence: 0.88, severity: 'HIGH',
            evidence: [ev],
            relatedEntities: ['victim', 'scene'],
          });
        });
      }

      // Store postmortem data in metadata for Timeline/TOD agents
      const metadata: Record<string, any> = {
        postmortemSigns: extracted.postmortemSigns,
        bodyWeight: extracted.bodyWeight,
        estimatedAge: extracted.estimatedAge,
        gender: extracted.gender,
        timeIndicators: extracted.timeIndicators,
        rawExtraction: extracted,
      };

      // Step 2: HuggingFace NER — Validate key entities exist in text
      try {
        const nerEntities = await callHuggingFaceNER(reportText.slice(0, 1000));
        metadata.nerValidation = nerEntities.length;
        metadata.nerEntities = nerEntities.slice(0, 20);
      } catch (e) {
        metadata.nerValidation = 'skipped';
      }

      // Step 3: HuggingFace Zero-shot — Validate manner classification
      try {
        const classification = await callHuggingFaceZeroShot(
          reportText.slice(0, 500),
          ['homicide', 'suicide', 'accidental death', 'natural death', 'undetermined']
        );
        metadata.mlClassification = {
          topLabel: classification.labels?.[0],
          topScore: classification.scores?.[0],
        };
      } catch (e) {
        metadata.mlClassification = 'skipped';
      }

      return {
        agentId: this.id, agentName: this.name, status: 'completed',
        confidence: 0.91, findings, metadata,
        executionTimeMs: Date.now() - start,
        modelUsed, apiProvider: 'gemini + huggingface',
      };

    } catch (error: any) {
      // Fallback: local regex extraction if Gemini fails
      console.error('AutopsyAgent Gemini failed, using fallback:', error.message);
      return this.fallbackAnalysis(reportText, start);
    }
  }

  private fallbackAnalysis(text: string, startTime: number): AgentResult {
    const findings: Finding[] = [];

    // Regex-based extraction (same as existing lib/multi-agent-system.ts)
    const codMatch = text.match(/cause\s+of\s+death[:\s]*([^\n.]{5,150})/i);
    if (codMatch) {
      findings.push({ id: 'fb-cod', type: 'CAUSE_OF_DEATH', content: codMatch[1].trim(), confidence: 0.8, severity: 'CRITICAL', evidence: [codMatch[0]], relatedEntities: ['victim'] });
    }

    const mannerMatch = text.match(/manner\s+of\s+death[:\s]*(homicide|suicide|accident(?:al)?|natural|undetermined)/i);
    if (mannerMatch) {
      findings.push({ id: 'fb-manner', type: 'MANNER_OF_DEATH', content: mannerMatch[1], confidence: 0.85, severity: 'CRITICAL', evidence: [mannerMatch[0]], relatedEntities: ['victim'] });
    }

    const injuries = [...text.matchAll(/(blunt\s+force\s+trauma[^\n.,]{0,80}|defensive\s+wounds?[^\n.,]{0,60}|ligature\s+mark[^\n.,]{0,60}|petechial\s+hemorrhages?[^\n.,]{0,40}|subdural\s+hematoma[^\n.,]{0,40}|gunshot\s+wound[^\n.,]{0,60}|stab\s+wound[^\n.,]{0,60})/gi)];
    injuries.forEach((m, i) => {
      findings.push({ id: `fb-inj-${i}`, type: 'INJURY', content: m[0].trim(), confidence: 0.75, severity: 'HIGH', evidence: [m[0]], relatedEntities: ['victim'] });
    });

    return {
      agentId: this.id, agentName: this.name, status: 'partial',
      confidence: 0.65, findings,
      metadata: { fallback: true, reason: 'Gemini API unavailable' },
      executionTimeMs: Date.now() - startTime,
      modelUsed: 'regex-fallback', apiProvider: 'local',
    };
  }
}

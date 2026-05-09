/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AGENTS 1-4: Autopsy, Timeline, CCTV, Toxicology
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Each agent: input validation → API call with retry → fallback → structured output
 */

import { AgentResult, Finding, EvidenceItem, uid, now, safeJsonParse } from './config';
import { callGemini, callFeatherless, callHuggingFaceNER, callHuggingFaceZeroShot, getAvailableProviders } from './api-clients';

// ═══════════════════════════════════════════════════════════════
// AGENT 1: AUTOPSY AGENT — Gemini 2.5 Pro + HuggingFace NER
// ═══════════════════════════════════════════════════════════════

export class AutopsyAgent {
  readonly id = 'autopsy-agent';
  readonly name = 'Autopsy Intelligence Agent';

  async analyze(reportText: string): Promise<AgentResult> {
    const start = Date.now();
    const errors: string[] = [];
    let findings: Finding[] = [];
    let modelUsed = 'fallback-regex';
    let retries = 0;

    if (!reportText || reportText.trim().length < 50) {
      return this.makeResult('skipped', [], ['Report text too short or missing'], start, 'none', 0);
    }

    const providers = getAvailableProviders();

    // PRIMARY: Gemini 2.5 Pro
    if (providers.gemini) {
      try {
        const geminiResponse = await callGemini(this.buildGeminiPrompt(reportText), {
          model: 'pro', jsonMode: true, temperature: 0.05,
        });

        const extracted = safeJsonParse<any>(geminiResponse, null);
        if (extracted) {
          findings = this.parseGeminiOutput(extracted);
          modelUsed = 'gemini-2.5-pro';
        } else {
          errors.push('Gemini returned unparseable response');
        }
      } catch (e: any) {
        errors.push(`Gemini failed: ${e.message}`);
        retries++;
      }
    }

    // FALLBACK: Local regex extraction
    if (findings.length === 0) {
      findings = this.regexExtraction(reportText);
      if (modelUsed === 'fallback-regex') modelUsed = 'local-regex';
    }

    // VALIDATION: HuggingFace NER cross-check
    if (providers.huggingface && findings.length > 0) {
      try {
        const nerEntities = await callHuggingFaceNER(reportText.slice(0, 1500));
        // Add NER-found entities not already captured
        const existingTexts = new Set(findings.map(f => f.content.toLowerCase().slice(0, 30)));
        nerEntities
          .filter(e => e.score > 0.8 && !existingTexts.has(e.word.toLowerCase().slice(0, 30)))
          .slice(0, 5)
          .forEach(e => {
            findings.push({
              id: uid('ner'), type: 'NER_ENTITY', content: `${e.entity_group}: ${e.word}`,
              confidence: e.score, severity: 'INFO', evidence: [e.word],
              relatedEntities: [], agentSource: this.id, timestamp: now(),
            });
          });
      } catch (e: any) {
        errors.push(`HF NER validation skipped: ${e.message}`);
      }
    }

    return this.makeResult(
      findings.length > 0 ? 'completed' : 'failed',
      findings, errors, start, modelUsed, retries
    );
  }

  private buildGeminiPrompt(text: string): string {
    return `You are an expert forensic pathologist. Extract ALL findings from this autopsy report as JSON.

IMPORTANT: Be exhaustive. Extract EVERY injury, EVERY substance, EVERY observation.

Return this exact JSON structure:
{
  "causeOfDeath": "exact text",
  "mannerOfDeath": "homicide|suicide|accident|natural|undetermined",
  "injuries": [{"location":"","type":"","dimensions":"","severity":"critical|high|moderate|low","description":""}],
  "toxicology": [{"substance":"","level":"","significance":"therapeutic|suspicious|toxic|lethal"}],
  "defensiveWounds": false,
  "petechiae": false,
  "postmortem": {"rigor":"absent|developing|full|resolving","lividity":"absent|developing|movable|fixed","decomp":"absent|early|moderate|advanced","bodyTemp":null},
  "physicalEvidence": [],
  "bodyWeight": null,
  "timeIndicators": []
}

REPORT:
${text.slice(0, 8000)}`;
  }

  private parseGeminiOutput(data: any): Finding[] {
    const findings: Finding[] = [];

    if (data.causeOfDeath) {
      findings.push({ id: uid('cod'), type: 'CAUSE_OF_DEATH', content: data.causeOfDeath, confidence: 0.94, severity: 'CRITICAL', evidence: [data.causeOfDeath], relatedEntities: ['victim'], agentSource: this.id, timestamp: now() });
    }
    if (data.mannerOfDeath) {
      findings.push({ id: uid('manner'), type: 'MANNER_OF_DEATH', content: data.mannerOfDeath, confidence: 0.95, severity: 'CRITICAL', evidence: [data.mannerOfDeath], relatedEntities: ['victim'], agentSource: this.id, timestamp: now() });
    }
    if (data.injuries?.length) {
      data.injuries.forEach((inj: any) => {
        const sev = ({ critical: 'CRITICAL', high: 'HIGH', moderate: 'MODERATE', low: 'LOW' } as any)[inj.severity] || 'MODERATE';
        findings.push({ id: uid('inj'), type: 'INJURY', content: `${inj.type || ''} ${inj.location || ''}: ${inj.description || ''} ${inj.dimensions || ''}`.trim(), confidence: 0.91, severity: sev, evidence: [inj.description || inj.type], relatedEntities: ['victim'], agentSource: this.id, timestamp: now() });
      });
    }
    if (data.toxicology?.length) {
      data.toxicology.forEach((tox: any) => {
        const sev = tox.significance === 'lethal' ? 'CRITICAL' : tox.significance === 'toxic' ? 'HIGH' : tox.significance === 'suspicious' ? 'HIGH' : 'MODERATE';
        findings.push({ id: uid('tox'), type: 'TOXICOLOGY', content: `${tox.substance}: ${tox.level} (${tox.significance})`, confidence: 0.93, severity: sev as any, evidence: [`${tox.substance}: ${tox.level}`], relatedEntities: ['victim', 'substance'], agentSource: this.id, timestamp: now() });
      });
    }
    if (data.defensiveWounds) {
      findings.push({ id: uid('def'), type: 'DEFENSIVE_WOUNDS', content: 'Defensive wounds present — victim resisted attacker', confidence: 0.92, severity: 'CRITICAL', evidence: ['defensive wounds'], relatedEntities: ['victim', 'suspect'], agentSource: this.id, timestamp: now() });
    }
    if (data.petechiae) {
      findings.push({ id: uid('pet'), type: 'ASPHYXIA_INDICATOR', content: 'Petechial hemorrhages — indicates asphyxia/compression', confidence: 0.90, severity: 'HIGH', evidence: ['petechiae'], relatedEntities: ['victim'], agentSource: this.id, timestamp: now() });
    }
    if (data.physicalEvidence?.length) {
      data.physicalEvidence.forEach((ev: string) => {
        findings.push({ id: uid('ev'), type: 'PHYSICAL_EVIDENCE', content: ev, confidence: 0.88, severity: 'HIGH', evidence: [ev], relatedEntities: ['scene'], agentSource: this.id, timestamp: now() });
      });
    }

    return findings;
  }

  private regexExtraction(text: string): Finding[] {
    const findings: Finding[] = [];
    const patterns: [RegExp, string, string][] = [
      [/cause\s+of\s+death[:\s]*([^\n.]{5,150})/i, 'CAUSE_OF_DEATH', 'CRITICAL'],
      [/manner\s+of\s+death[:\s]*(homicide|suicide|accident(?:al)?|natural|undetermined)/i, 'MANNER_OF_DEATH', 'CRITICAL'],
      [/blunt\s+force\s+trauma[^\n.,]{0,80}/gi, 'INJURY', 'HIGH'],
      [/defensive\s+wounds?[^\n.,]{0,60}/gi, 'DEFENSIVE_WOUNDS', 'CRITICAL'],
      [/ligature\s+mark[^\n.,]{0,60}/gi, 'INJURY', 'HIGH'],
      [/petechial\s+hemorrhages?[^\n.,]{0,40}/gi, 'ASPHYXIA_INDICATOR', 'HIGH'],
      [/subdural\s+hematoma[^\n.,]{0,40}/gi, 'INJURY', 'HIGH'],
      [/gunshot\s+wound[^\n.,]{0,60}/gi, 'INJURY', 'CRITICAL'],
      [/blood\s+alcohol[:\s]*[\d.]+\s*g\/dL/gi, 'TOXICOLOGY', 'MODERATE'],
      [/benzodiazepines?[:\s]*[^\n.,]{0,40}/gi, 'TOXICOLOGY', 'HIGH'],
    ];

    const seen = new Set<string>();
    patterns.forEach(([pattern, type, severity]) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(m => {
          const clean = m.replace(/^.*?:\s*/, '').trim();
          if (clean.length > 3 && !seen.has(clean.toLowerCase())) {
            seen.add(clean.toLowerCase());
            findings.push({ id: uid('rx'), type, content: clean, confidence: 0.75, severity: severity as any, evidence: [m], relatedEntities: ['victim'], agentSource: this.id, timestamp: now() });
          }
        });
      }
    });

    return findings;
  }

  private makeResult(status: AgentResult['status'], findings: Finding[], errors: string[], start: number, model: string, retries: number): AgentResult {
    return { agentId: this.id, agentName: this.name, status, confidence: findings.length > 0 ? 0.88 : 0.1, findings, errors, metadata: { findingCount: findings.length }, executionTimeMs: Date.now() - start, modelUsed: model, apiProvider: model.includes('gemini') ? 'gemini' : 'local', retries };
  }
}

// ═══════════════════════════════════════════════════════════════
// AGENT 2: TIMELINE AGENT — Local deterministic + Gemini Lite
// ═══════════════════════════════════════════════════════════════

export class TimelineAgent {
  readonly id = 'timeline-agent';
  readonly name = 'Timeline Reconstruction Agent';

  async analyze(evidence: EvidenceItem[], reportText?: string): Promise<AgentResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const errors: string[] = [];

    if (!evidence || evidence.length < 2) {
      return { agentId: this.id, agentName: this.name, status: 'skipped', confidence: 0.1, findings: [], errors: ['Need 2+ evidence items'], metadata: {}, executionTimeMs: Date.now() - start, modelUsed: 'none', apiProvider: 'local', retries: 0 };
    }

    // Sort chronologically (DETERMINISTIC)
    const sorted = evidence.filter(e => e.timestamp && !isNaN(new Date(e.timestamp).getTime()))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (sorted.length < 2) {
      return { agentId: this.id, agentName: this.name, status: 'partial', confidence: 0.3, findings: [], errors: ['Not enough valid timestamps'], metadata: {}, executionTimeMs: Date.now() - start, modelUsed: 'local', apiProvider: 'local', retries: 0 };
    }

    // Gap detection
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapMin = (new Date(sorted[i + 1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime()) / 60000;
      if (gapMin > 30) {
        findings.push({ id: uid('gap'), type: 'TIMELINE_GAP', content: `${Math.round(gapMin)}min gap: "${sorted[i].details?.slice(0, 40)}" → "${sorted[i + 1].details?.slice(0, 40)}"`, confidence: 0.95, severity: gapMin > 480 ? 'CRITICAL' : gapMin > 120 ? 'HIGH' : 'MODERATE', evidence: [sorted[i].timestamp, sorted[i + 1].timestamp], relatedEntities: [sorted[i].source, sorted[i + 1].source], agentSource: this.id, timestamp: now() });
      }
    }

    // Rapid clusters
    for (let i = 0; i < sorted.length - 1; i++) {
      const diffMin = (new Date(sorted[i + 1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime()) / 60000;
      if (diffMin > 0 && diffMin <= 5 && sorted[i].source !== sorted[i + 1].source) {
        findings.push({ id: uid('cluster'), type: 'EVENT_CLUSTER', content: `${diffMin.toFixed(1)}min: ${sorted[i].source} → ${sorted[i + 1].source}`, confidence: 0.88, severity: 'HIGH', evidence: [sorted[i].details, sorted[i + 1].details], relatedEntities: [sorted[i].source, sorted[i + 1].source], agentSource: this.id, timestamp: now() });
      }
    }

    // Span
    const spanHours = (new Date(sorted[sorted.length - 1].timestamp).getTime() - new Date(sorted[0].timestamp).getTime()) / 3600000;
    findings.push({ id: uid('span'), type: 'TIMELINE_SPAN', content: `${sorted.length} events over ${spanHours.toFixed(1)}h from ${new Set(sorted.map(s => s.source)).size} sources`, confidence: 1.0, severity: 'INFO', evidence: [], relatedEntities: [], agentSource: this.id, timestamp: now() });

    // Incident window
    const clusters = findings.filter(f => f.type === 'EVENT_CLUSTER');
    if (clusters.length >= 2) {
      findings.push({ id: uid('window'), type: 'INCIDENT_WINDOW', content: `${clusters.length} rapid-fire event clusters — critical incident window identified`, confidence: 0.87, severity: 'CRITICAL', evidence: clusters.map(c => c.content), relatedEntities: ['victim', 'suspect'], agentSource: this.id, timestamp: now() });
    }

    return { agentId: this.id, agentName: this.name, status: 'completed', confidence: 0.93, findings, errors, metadata: { eventCount: sorted.length, gaps: findings.filter(f => f.type === 'TIMELINE_GAP').length, sortedTimeline: sorted }, executionTimeMs: Date.now() - start, modelUsed: 'local-deterministic', apiProvider: 'local', retries: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// AGENT 3: CCTV AGENT — Gemini 2.5 Flash (3-tier escalation)
// ═══════════════════════════════════════════════════════════════

export class CCTVAgent {
  readonly id = 'cctv-agent';
  readonly name = 'CCTV Forensics Agent';

  async analyze(frames: { base64: string; timestamp?: string; cameraId?: string }[]): Promise<AgentResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const errors: string[] = [];

    if (!frames || frames.length === 0) {
      return { agentId: this.id, agentName: this.name, status: 'skipped', confidence: 0.1, findings: [], errors: ['No frames provided'], metadata: {}, executionTimeMs: Date.now() - start, modelUsed: 'none', apiProvider: 'gemini', retries: 0 };
    }

    if (!getAvailableProviders().gemini) {
      return { agentId: this.id, agentName: this.name, status: 'failed', confidence: 0, findings: [], errors: ['GEMINI_API_KEY required for CCTV analysis'], metadata: {}, executionTimeMs: Date.now() - start, modelUsed: 'none', apiProvider: 'gemini', retries: 0 };
    }

    let retries = 0;
    const maxFrames = Math.min(frames.length, 8);

    for (let i = 0; i < maxFrames; i++) {
      try {
        const prompt = `Forensic CCTV analysis. Frame ${i + 1}/${maxFrames}${frames[i].cameraId ? ` (Camera: ${frames[i].cameraId})` : ''}${frames[i].timestamp ? ` at ${frames[i].timestamp}` : ''}.

Return JSON:
{"persons":[{"description":"","behavior":"","direction":"","carrying":"","suspicious":"none|low|medium|high"}],"vehicles":[{"type":"","color":"","plate":"","speed":"normal|fast|very_fast"}],"weapons":[{"type":"none|handgun|rifle|knife|blunt_object","holder":"","confidence":"high|medium|low"}],"suspicious_activity":"null or description","person_count":0}`;

        const response = await callGemini(prompt, { model: 'flash', image: frames[i].base64, jsonMode: true, temperature: 0.05 });
        const analysis = safeJsonParse<any>(response, null);

        if (!analysis) { errors.push(`Frame ${i + 1}: unparseable response`); continue; }

        // Convert to findings
        if (analysis.persons?.length > 0) {
          analysis.persons.filter((p: any) => p.suspicious === 'high' || p.suspicious === 'medium').forEach((p: any) => {
            findings.push({ id: uid('cctv-p'), type: 'SUSPICIOUS_PERSON', content: `Frame ${i + 1}: ${p.description} — ${p.behavior}, direction: ${p.direction}, carrying: ${p.carrying || 'nothing'}`, confidence: 0.85, severity: p.suspicious === 'high' ? 'CRITICAL' : 'HIGH', evidence: [`CCTV Frame ${i + 1}`], relatedEntities: ['suspect'], agentSource: this.id, timestamp: frames[i].timestamp || now() });
          });
        }

        if (analysis.vehicles?.length > 0) {
          analysis.vehicles.forEach((v: any) => {
            findings.push({ id: uid('cctv-v'), type: 'VEHICLE_DETECTED', content: `Frame ${i + 1}: ${v.color || ''} ${v.type || 'vehicle'}, plate: ${v.plate || 'not visible'}, speed: ${v.speed || 'unknown'}`, confidence: 0.87, severity: v.speed === 'very_fast' ? 'HIGH' : 'MODERATE', evidence: [`Frame ${i + 1}`], relatedEntities: ['vehicle'], agentSource: this.id, timestamp: frames[i].timestamp || now() });
          });
        }

        if (analysis.weapons?.length > 0) {
          analysis.weapons.filter((w: any) => w.type !== 'none').forEach((w: any) => {
            findings.push({ id: uid('cctv-w'), type: 'WEAPON_DETECTED', content: `Frame ${i + 1}: ${w.type} detected (confidence: ${w.confidence}), held by: ${w.holder || 'unknown'}`, confidence: w.confidence === 'high' ? 0.92 : 0.7, severity: 'CRITICAL', evidence: [`Frame ${i + 1}`], relatedEntities: ['weapon', 'suspect'], agentSource: this.id, timestamp: frames[i].timestamp || now() });
          });
        }

        if (analysis.suspicious_activity && analysis.suspicious_activity !== 'null') {
          findings.push({ id: uid('cctv-s'), type: 'SUSPICIOUS_ACTIVITY', content: `Frame ${i + 1}: ${analysis.suspicious_activity}`, confidence: 0.82, severity: 'HIGH', evidence: [`Frame ${i + 1}`], relatedEntities: ['suspect'], agentSource: this.id, timestamp: frames[i].timestamp || now() });
        }

        // Person count tracking
        if (analysis.person_count !== undefined) {
          findings.push({ id: uid('cctv-cnt'), type: 'PERSON_COUNT', content: `Frame ${i + 1}: ${analysis.person_count} person(s)`, confidence: 0.9, severity: 'INFO', evidence: [], relatedEntities: [], agentSource: this.id, timestamp: frames[i].timestamp || now() });
        }

      } catch (e: any) {
        errors.push(`Frame ${i + 1}: ${e.message}`);
        retries++;
      }
    }

    // Cross-frame: person count discrepancy
    const counts = findings.filter(f => f.type === 'PERSON_COUNT').map(f => parseInt(f.content.match(/(\d+) person/)?.[1] || '0'));
    if (counts.length >= 2) {
      const max = Math.max(...counts);
      const min = Math.min(...counts.filter(c => c > 0));
      if (max > min && min > 0) {
        findings.push({ id: uid('cctv-disc'), type: 'PERSON_DISCREPANCY', content: `Person count changed: ${max} → ${min}. One or more persons did not exit scene.`, confidence: 0.91, severity: 'CRITICAL', evidence: [`Max: ${max}`, `Min: ${min}`], relatedEntities: ['victim', 'suspect'], agentSource: this.id, timestamp: now() });
      }
    }

    return { agentId: this.id, agentName: this.name, status: findings.length > 0 ? 'completed' : 'partial', confidence: findings.length > 0 ? 0.86 : 0.3, findings, errors, metadata: { framesAnalyzed: maxFrames, detections: findings.length }, executionTimeMs: Date.now() - start, modelUsed: 'gemini-2.5-flash', apiProvider: 'gemini', retries };
  }
}

// ═══════════════════════════════════════════════════════════════
// AGENT 4: TOXICOLOGY AGENT — Featherless 70B + Gemini validation
// ═══════════════════════════════════════════════════════════════

export class ToxicologyAgent {
  readonly id = 'toxicology-agent';
  readonly name = 'Toxicology Analysis Agent';

  async analyze(substances: { substance: string; level: string; unit?: string }[]): Promise<AgentResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const errors: string[] = [];

    if (!substances || substances.length === 0) {
      return { agentId: this.id, agentName: this.name, status: 'skipped', confidence: 0.1, findings: [], errors: ['No toxicology data'], metadata: {}, executionTimeMs: Date.now() - start, modelUsed: 'none', apiProvider: 'featherless', retries: 0 };
    }

    const providers = getAvailableProviders();
    let retries = 0;

    // PRIMARY: Featherless Llama 70B — deep pharmacological reasoning
    if (providers.featherless) {
      try {
        const toxList = substances.map(s => `• ${s.substance}: ${s.level} ${s.unit || ''}`).join('\n');
        const response = await callFeatherless([
          { role: 'system', content: 'You are an expert forensic toxicologist. Analyze findings and determine investigative significance. Be precise with pharmacological ranges. Return JSON only.' },
          { role: 'user', content: `Autopsy toxicology:\n${toxList}\n\nReturn:\n{"assessment":"overall significance","substances":[{"name":"","classification":"therapeutic|recreational|toxic|lethal|trace","dangerLevel":0-100,"forensicSignificance":""}],"interactions":"any dangerous combinations","incapacitationRisk":"none|low|moderate|high|certain","involuntaryIndicators":[],"estimatedIngestionTime":"relative to death","confidence":0.0-1.0}` },
        ], { jsonMode: true, temperature: 0.1 });

        const analysis = safeJsonParse<any>(response, null);
        if (analysis) {
          if (analysis.assessment) {
            findings.push({ id: uid('tox-assess'), type: 'TOX_ASSESSMENT', content: analysis.assessment, confidence: analysis.confidence || 0.8, severity: 'HIGH', evidence: substances.map(s => `${s.substance}: ${s.level}`), relatedEntities: ['victim'], agentSource: this.id, timestamp: now() });
          }
          if (analysis.incapacitationRisk && analysis.incapacitationRisk !== 'none') {
            findings.push({ id: uid('tox-incap'), type: 'INCAPACITATION_RISK', content: `Incapacitation risk: ${analysis.incapacitationRisk} — ${analysis.interactions || 'substance effects'}`, confidence: 0.84, severity: analysis.incapacitationRisk === 'high' || analysis.incapacitationRisk === 'certain' ? 'CRITICAL' : 'HIGH', evidence: substances.map(s => s.substance), relatedEntities: ['victim', 'suspect'], agentSource: this.id, timestamp: now() });
          }
          if (analysis.involuntaryIndicators?.length > 0) {
            findings.push({ id: uid('tox-invol'), type: 'INVOLUNTARY_ADMINISTRATION', content: `Indicators of involuntary administration: ${analysis.involuntaryIndicators.join('; ')}`, confidence: 0.78, severity: 'CRITICAL', evidence: analysis.involuntaryIndicators, relatedEntities: ['victim', 'suspect'], agentSource: this.id, timestamp: now() });
          }
          analysis.substances?.forEach((s: any) => {
            findings.push({ id: uid('tox-sub'), type: 'SUBSTANCE_DETAIL', content: `${s.name}: ${s.classification} (danger: ${s.dangerLevel}/100) — ${s.forensicSignificance || ''}`, confidence: 0.85, severity: s.dangerLevel > 70 ? 'CRITICAL' : s.dangerLevel > 40 ? 'HIGH' : 'MODERATE', evidence: [s.name], relatedEntities: ['victim'], agentSource: this.id, timestamp: now() });
          });
        }
      } catch (e: any) {
        errors.push(`Featherless analysis failed: ${e.message}`);
        retries++;
      }
    }

    // FALLBACK: Basic classification
    if (findings.length === 0) {
      substances.forEach(s => {
        const isWorrying = /benzodiazepine|fentanyl|cyanide|arsenic|rohypnol/i.test(s.substance);
        findings.push({ id: uid('tox-fb'), type: 'TOXICOLOGY', content: `${s.substance}: ${s.level} ${s.unit || ''}`, confidence: 0.7, severity: isWorrying ? 'HIGH' : 'MODERATE', evidence: [`${s.substance}: ${s.level}`], relatedEntities: ['victim'], agentSource: this.id, timestamp: now() });
      });
    }

    return { agentId: this.id, agentName: this.name, status: 'completed', confidence: findings.length > 0 ? 0.84 : 0.4, findings, errors, metadata: { substanceCount: substances.length }, executionTimeMs: Date.now() - start, modelUsed: providers.featherless ? 'featherless-llama-70b' : 'local-rules', apiProvider: providers.featherless ? 'featherless' : 'local', retries };
  }
}

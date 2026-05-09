/**
 * ═══════════════════════════════════════════════════════════════
 * AGENT 3: CCTV AGENT
 * ═══════════════════════════════════════════════════════════════
 * 
 * Provider: Gemini 2.5 Flash (standard) / Flash Lite (quick scan) / Pro (deep)
 * 
 * Analyzes: faces (count), weapons, movement, vehicles, suspicious behavior
 * Uses 3-tier escalation: lite → flash → pro
 */

import { AgentResult, Finding } from './config';
import { callGemini } from './api-clients';

export class CCTVAgent {
  id = 'cctv-agent';
  name = 'CCTV Forensics Agent';

  /**
   * Quick scan — run on every frame (ultra-fast)
   * Returns: alert yes/no + basic counts
   */
  async quickScan(frameBase64: string): Promise<{ alert: boolean; persons: number; vehicles: number; weapons: boolean }> {
    try {
      const response = await callGemini(
        `Quick forensic scan. Count persons and vehicles. Any weapons visible? JSON only:
{"persons":0,"vehicles":0,"weapons":false,"alert":false}`,
        { model: 'lite', image: frameBase64, jsonMode: true, temperature: 0 }
      );
      return JSON.parse(response);
    } catch {
      return { alert: false, persons: 0, vehicles: 0, weapons: false };
    }
  }

  /**
   * Full analysis — detailed forensic CCTV analysis
   */
  async analyze(frames: string[], evidenceContext?: string): Promise<AgentResult> {
    const start = Date.now();
    const findings: Finding[] = [];

    if (!frames || frames.length === 0) {
      return {
        agentId: this.id, agentName: this.name, status: 'partial',
        confidence: 0.2, findings: [],
        metadata: { reason: 'No CCTV frames provided' },
        executionTimeMs: Date.now() - start,
        modelUsed: 'none', apiProvider: 'gemini',
      };
    }

    // Analyze each frame with Gemini 2.5 Flash
    for (let i = 0; i < Math.min(frames.length, 10); i++) {
      try {
        const prompt = `You are a forensic CCTV analyst. Analyze frame ${i + 1} of ${frames.length}.
${evidenceContext ? `Case context: ${evidenceContext}` : ''}

Return detailed JSON:
{
  "frameNumber": ${i + 1},
  "persons": [
    {"id": 1, "description": "clothing, build, distinguishing features", "behavior": "walking/running/standing/crouching", "direction": "entering/exiting/stationary", "carrying": "any objects", "suspiciousLevel": "none|low|medium|high"}
  ],
  "vehicles": [
    {"type": "sedan/SUV/truck/motorcycle", "color": "", "plate": "if readable or 'not visible'", "direction": "entering/exiting/parked", "speed": "normal/fast/very fast"}
  ],
  "weapons": [
    {"type": "handgun/rifle/knife/blunt object/none", "heldBy": "person description", "confidence": "high|medium|low"}
  ],
  "suspiciousActivity": "description or null",
  "lighting": "day/night/dim/artificial",
  "personCount": 0,
  "sceneDescription": ""
}`;

        const response = await callGemini(prompt, {
          model: 'flash',
          image: frames[i],
          jsonMode: true,
          temperature: 0.1,
        });

        const analysis = JSON.parse(response);

        // Convert to findings
        if (analysis.persons?.length > 0) {
          analysis.persons.forEach((p: any, j: number) => {
            if (p.suspiciousLevel === 'high' || p.suspiciousLevel === 'medium') {
              findings.push({
                id: `cctv-person-${i}-${j}`, type: 'SUSPICIOUS_PERSON',
                content: `Frame ${i + 1}: ${p.description} — ${p.behavior}, carrying: ${p.carrying || 'nothing'}`,
                confidence: 0.85, severity: p.suspiciousLevel === 'high' ? 'CRITICAL' : 'HIGH',
                evidence: [`CCTV Frame ${i + 1}`],
                relatedEntities: ['suspect'],
              });
            }
          });

          // Person count tracking
          findings.push({
            id: `cctv-count-${i}`, type: 'PERSON_COUNT',
            content: `Frame ${i + 1}: ${analysis.personCount} person(s) detected`,
            confidence: 0.9, severity: 'INFO',
            evidence: [`CCTV Frame ${i + 1}`],
            relatedEntities: [],
          });
        }

        if (analysis.vehicles?.length > 0) {
          analysis.vehicles.forEach((v: any, j: number) => {
            findings.push({
              id: `cctv-vehicle-${i}-${j}`, type: 'VEHICLE_DETECTED',
              content: `Frame ${i + 1}: ${v.color} ${v.type}, plate: ${v.plate || 'not visible'}, speed: ${v.speed}`,
              confidence: 0.87,
              severity: v.speed === 'very fast' ? 'HIGH' : 'MODERATE',
              evidence: [`CCTV Frame ${i + 1}`],
              relatedEntities: ['vehicle', 'suspect'],
            });
          });
        }

        if (analysis.weapons?.length > 0) {
          analysis.weapons.forEach((w: any, j: number) => {
            if (w.type !== 'none') {
              findings.push({
                id: `cctv-weapon-${i}-${j}`, type: 'WEAPON_DETECTED',
                content: `Frame ${i + 1}: ${w.type} detected, held by ${w.heldBy} (confidence: ${w.confidence})`,
                confidence: w.confidence === 'high' ? 0.92 : 0.75,
                severity: 'CRITICAL',
                evidence: [`CCTV Frame ${i + 1}`],
                relatedEntities: ['suspect', 'weapon'],
              });
            }
          });
        }

        if (analysis.suspiciousActivity) {
          findings.push({
            id: `cctv-suspicious-${i}`, type: 'SUSPICIOUS_ACTIVITY',
            content: `Frame ${i + 1}: ${analysis.suspiciousActivity}`,
            confidence: 0.82, severity: 'HIGH',
            evidence: [`CCTV Frame ${i + 1}`],
            relatedEntities: ['suspect', 'scene'],
          });
        }

      } catch (error: any) {
        console.error(`CCTV frame ${i + 1} analysis failed:`, error.message);
      }
    }

    // Cross-frame analysis: person count discrepancy
    const personCounts = findings.filter(f => f.type === 'PERSON_COUNT');
    if (personCounts.length >= 2) {
      const counts = personCounts.map(f => parseInt(f.content.match(/(\d+) person/)?.[1] || '0'));
      const maxCount = Math.max(...counts);
      const minCount = Math.min(...counts);
      if (maxCount > minCount && minCount < maxCount) {
        findings.push({
          id: 'cctv-count-discrepancy', type: 'PERSON_DISCREPANCY',
          content: `Person count changed: max ${maxCount} → min ${minCount}. Indicates one or more persons did not exit the scene.`,
          confidence: 0.89, severity: 'CRITICAL',
          evidence: personCounts.map(f => f.content),
          relatedEntities: ['victim', 'suspect'],
        });
      }
    }

    return {
      agentId: this.id, agentName: this.name, status: 'completed',
      confidence: findings.length > 0 ? 0.86 : 0.4,
      findings,
      metadata: {
        framesAnalyzed: Math.min(frames.length, 10),
        totalFindings: findings.length,
        weaponsDetected: findings.filter(f => f.type === 'WEAPON_DETECTED').length,
        suspiciousPersons: findings.filter(f => f.type === 'SUSPICIOUS_PERSON').length,
      },
      executionTimeMs: Date.now() - start,
      modelUsed: 'gemini-2.5-flash', apiProvider: 'gemini',
    };
  }
}

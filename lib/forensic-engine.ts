// Forensic AI Engine — Core analysis functions
// This module contains the AI logic for forensic analysis

import { z } from 'zod';

// ============================================================
// HENSSGE NOMOGRAM — TIME OF DEATH ESTIMATION
// ============================================================

export const TodInputSchema = z.object({
  rectalTemp: z.number().min(10).max(37.5),
  ambientTemp: z.number().min(-20).max(50),
  bodyWeight: z.number().min(10).max(250),
  correctiveFactor: z.number().min(0.1).max(2.0),
  rigorMortis: z.enum(['absent', 'developing', 'full', 'resolving']),
  lividity: z.enum(['absent', 'developing', 'present_movable', 'fixed']),
  decomposition: z.enum(['absent', 'early', 'bloating', 'advanced']),
});

export type TodInput = z.infer<typeof TodInputSchema>;

export interface TodResult {
  estimatedPMI: number;
  lowerBound: number;
  upperBound: number;
  confidence: 'HIGH' | 'MODERATE' | 'LOW';
  methodology: string;
  coolingCurve: { time: number; temp: number }[];
  signsAssessment: { sign: string; state: string; range: string; note: string }[];
}

export function estimateTimeOfDeath(input: TodInput): TodResult {
  const T_INITIAL = 37.2;
  const { rectalTemp, ambientTemp, bodyWeight, correctiveFactor } = input;

  // Henssge double-exponential model
  const effectiveWeight = correctiveFactor * bodyWeight;
  const B = 1.2815 * Math.pow(effectiveWeight, -0.625) + 0.0284;
  const Q = (rectalTemp - ambientTemp) / (T_INITIAL - ambientTemp);

  let pmi = 0;
  if (Q > 0 && Q < 1) {
    // Newton's method to solve cooling equation
    let t = 10; // initial guess
    for (let i = 0; i < 50; i++) {
      const f = 1.25 * Math.exp(-B * t) - 0.25 * Math.exp(-5 * B * t) - Q;
      const fp = -1.25 * B * Math.exp(-B * t) + 1.25 * B * Math.exp(-5 * B * t);
      if (Math.abs(fp) < 1e-10) break;
      t = t - f / fp;
      if (Math.abs(f) < 0.001) break;
    }
    pmi = Math.max(0, t);
  }

  // Postmortem signs ranges
  const rigorRanges: Record<string, [number, number]> = {
    absent: [0, 3], developing: [2, 8], full: [8, 24], resolving: [24, 72],
  };
  const lividityRanges: Record<string, [number, number]> = {
    absent: [0, 1], developing: [0.5, 4], present_movable: [2, 12], fixed: [8, 200],
  };

  const rigorRange = rigorRanges[input.rigorMortis] || [0, 72];
  const lividRange = lividityRanges[input.lividity] || [0, 200];

  // Combine estimates
  const stdError = bodyWeight >= 50 && bodyWeight <= 100 ? 2.8 : 3.2;
  const lowerBound = Math.max(0, pmi - stdError);
  const upperBound = pmi + stdError;

  // Check agreement between methods
  const signsMiddle = (rigorRange[0] + rigorRange[1]) / 2;
  const spread = Math.abs(pmi - signsMiddle);
  const confidence = spread < pmi * 0.3 ? 'HIGH' : spread < pmi * 0.6 ? 'MODERATE' : 'LOW';

  // Generate cooling curve data
  const coolingCurve = Array.from({ length: 48 }, (_, i) => ({
    time: i,
    temp: ambientTemp + (T_INITIAL - ambientTemp) * (1.25 * Math.exp(-B * i) - 0.25 * Math.exp(-5 * B * i)),
  }));

  return {
    estimatedPMI: Math.round(pmi * 10) / 10,
    lowerBound: Math.round(lowerBound * 10) / 10,
    upperBound: Math.round(upperBound * 10) / 10,
    confidence,
    methodology: 'Henssge Nomogram (1988) with environmental correction',
    coolingCurve,
    signsAssessment: [
      { sign: 'Rigor Mortis', state: input.rigorMortis, range: `${rigorRange[0]}-${rigorRange[1]}h`, note: '' },
      { sign: 'Lividity', state: input.lividity, range: `${lividRange[0]}-${lividRange[1]}h`, note: '' },
      { sign: 'Decomposition', state: input.decomposition, range: '', note: '' },
    ],
  };
}

// ============================================================
// AUTOPSY REPORT NLP ANALYSIS
// ============================================================

export interface ForensicEntity {
  text: string;
  label: string;
  confidence: number;
}

export interface AutopsyAnalysis {
  entities: ForensicEntity[];
  causeOfDeath: string[];
  mannerOfDeath: string | null;
  injuries: string[];
  toxicology: string[];
  timeIndicators: string[];
  evidence: string[];
  riskScore: number;
  riskLevel: string;
  anomalies: { type: string; severity: string; description: string; recommendation: string }[];
  summary: string;
}

const FORENSIC_PATTERNS: Record<string, RegExp[]> = {
  CAUSE_OF_DEATH: [
    /cause\s+of\s+death[:\s]*([^\n.]{5,120})/gi,
    /fatal\s+([^\n.,]+(?:injury|trauma|hemorrhage|asphyxia|poisoning))/gi,
    /(asphyxia\s+due\s+to\s+[^\n.,]+)/gi,
  ],
  MANNER_OF_DEATH: [
    /manner\s+of\s+death[:\s]*(homicide|suicide|accidental?|natural|undetermined)/gi,
  ],
  INJURY: [
    /(blunt\s+force\s+trauma[^\n.,]{0,80})/gi,
    /(gunshot\s+wound[^\n.,]{0,60})/gi,
    /(stab\s+wound[^\n.,]{0,60})/gi,
    /(defensive\s+wounds?[^\n.,]{0,80})/gi,
    /(petechial\s+hemorrhages?[^\n.,]{0,60})/gi,
    /(ligature\s+mark[^\n.,]{0,80})/gi,
    /(subdural\s+hematoma[^\n.,]{0,60})/gi,
    /(contusion[s]?\s+(?:on|of|to)\s+[^\n.,]{0,60})/gi,
  ],
  TOXICOLOGY: [
    /(blood\s+alcohol[:\s]*\d+\.\d+\s*g\/dL[^\n.,]*)/gi,
    /(benzodiazepines?[:\s]*[^\n.,]{0,60})/gi,
    /(no\s+illicit\s+substances?\s+detected)/gi,
  ],
  TIME_INDICATOR: [
    /((?:approximately|estimated)\s+\d+[-–]\d+\s+hours?\s+(?:prior|before)[^\n.,]*)/gi,
    /(rigor\s+mortis\s+is\s+fully\s+developed[^\n.,]{0,40})/gi,
    /(lividity\s+is\s+fixed[^\n.,]{0,40})/gi,
  ],
  EVIDENCE: [
    /(skin\s+under\s+fingernails\s+collected[^\n.,]{0,60})/gi,
    /(foreign\s+fibers?\s+recovered[^\n.,]{0,60})/gi,
    /(DNA\s+(?:analysis|sample|collected)[^\n.,]{0,40})/gi,
  ],
};

const VIOLENCE_KEYWORDS: Record<string, number> = {
  homicide: 95, gunshot: 95, stab: 90, 'defensive wounds': 90,
  ligature: 85, strangulation: 90, 'blunt force trauma': 85,
  'subdural hematoma': 80, hemorrhage: 75, fracture: 70,
  asphyxia: 80, petechial: 75, contusion: 65, laceration: 70,
};

export function analyzeAutopsyReport(text: string): AutopsyAnalysis {
  const entities: ForensicEntity[] = [];
  const seen = new Set<string>();

  for (const [label, patterns] of Object.entries(FORENSIC_PATTERNS)) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const entityText = (match[1] || match[0]).trim();
        if (entityText.length < 3 || seen.has(entityText.toLowerCase())) continue;
        seen.add(entityText.toLowerCase());
        entities.push({
          text: entityText,
          label,
          confidence: Math.min(0.95, 0.75 + entityText.length * 0.002),
        });
      }
    }
  }

  const causeOfDeath = entities.filter(e => e.label === 'CAUSE_OF_DEATH').map(e => e.text);
  const mannerOfDeath = entities.find(e => e.label === 'MANNER_OF_DEATH')?.text || null;
  const injuries = entities.filter(e => e.label === 'INJURY').map(e => e.text);
  const toxicology = entities.filter(e => e.label === 'TOXICOLOGY').map(e => e.text);
  const timeIndicators = entities.filter(e => e.label === 'TIME_INDICATOR').map(e => e.text);
  const evidence = entities.filter(e => e.label === 'EVIDENCE').map(e => e.text);

  // Calculate risk score
  const textLower = text.toLowerCase();
  let maxViolence = 0;
  let violenceCount = 0;
  for (const [kw, score] of Object.entries(VIOLENCE_KEYWORDS)) {
    if (textLower.includes(kw)) {
      maxViolence = Math.max(maxViolence, score);
      violenceCount++;
    }
  }
  const riskScore = Math.min(100, Math.round(maxViolence * Math.min(1.3, 1 + violenceCount * 0.05)));
  const riskLevel = riskScore >= 75 ? 'HIGH' : riskScore >= 50 ? 'MODERATE' : 'LOW';

  // Detect anomalies
  const anomalies: AutopsyAnalysis['anomalies'] = [];
  if (textLower.includes('defensive') && mannerOfDeath && !mannerOfDeath.toLowerCase().includes('homicide')) {
    anomalies.push({
      type: 'manner_mismatch', severity: 'CRITICAL',
      description: 'Defensive wounds detected but manner not classified as homicide',
      recommendation: 'Review manner determination — defensive wounds suggest interpersonal violence',
    });
  }
  if (textLower.includes('benzodiazepine') || textLower.includes('diazepam')) {
    if (!textLower.includes('overdose')) {
      anomalies.push({
        type: 'sedation_indicator', severity: 'HIGH',
        description: 'Sedative substances detected in non-overdose death',
        recommendation: 'Consider possibility of incapacitation prior to injuries',
      });
    }
  }

  return {
    entities, causeOfDeath, mannerOfDeath, injuries, toxicology,
    timeIndicators, evidence, riskScore, riskLevel, anomalies,
    summary: `Identified ${entities.length} forensic entities. ${injuries.length} injuries documented. Risk level: ${riskLevel} (${riskScore}/100).`,
  };
}

// ============================================================
// DIGITAL EVIDENCE CORRELATION
// ============================================================

export interface DigitalEvidence {
  timestamp: string;
  source: string;
  eventType: string;
  lat?: number;
  lon?: number;
  details: string;
}

export interface CorrelationResult {
  correlations: { event1: string; event2: string; timeDiff: number; significance: string }[];
  gaps: { start: string; end: string; duration: number; severity: string }[];
  patterns: { type: string; description: string; significance: string }[];
}

export function correlateEvidence(evidence: DigitalEvidence[]): CorrelationResult {
  const sorted = [...evidence].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  const correlations: CorrelationResult['correlations'] = [];
  const gaps: CorrelationResult['gaps'] = [];
  const patterns: CorrelationResult['patterns'] = [];

  // Find temporal correlations
  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < Math.min(i + 5, sorted.length); j++) {
      const diff = (new Date(sorted[j].timestamp).getTime() - new Date(sorted[i].timestamp).getTime()) / 60000;
      if (diff > 0 && diff <= 15 && sorted[i].source !== sorted[j].source) {
        correlations.push({
          event1: `${sorted[i].source}: ${sorted[i].details.slice(0, 40)}`,
          event2: `${sorted[j].source}: ${sorted[j].details.slice(0, 40)}`,
          timeDiff: Math.round(diff * 10) / 10,
          significance: diff <= 5 ? 'HIGH' : 'MODERATE',
        });
      }
    }

    // Detect gaps
    const gapMin = (new Date(sorted[i + 1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime()) / 60000;
    if (gapMin > 30) {
      gaps.push({
        start: sorted[i].timestamp,
        end: sorted[i + 1].timestamp,
        duration: Math.round(gapMin),
        severity: gapMin > 120 ? 'HIGH' : gapMin > 60 ? 'MODERATE' : 'LOW',
      });
    }
  }

  // Detect patterns
  const details = sorted.map(e => e.details.toLowerCase());
  const hasMultipleArrive = details.some(d => d.includes('two') || d.includes('multiple'));
  const hasSingleLeave = details.some(d => d.includes('single') || d.includes('alone'));
  if (hasMultipleArrive && hasSingleLeave) {
    patterns.push({ type: 'person_count_discrepancy', description: 'Multiple arrived but fewer departed', significance: 'CRITICAL' });
  }
  if (details.some(d => d.includes('high speed') || d.includes('rapidly'))) {
    patterns.push({ type: 'rapid_departure', description: 'Vehicle/person departing at unusual speed', significance: 'HIGH' });
  }
  if (sorted.some(e => e.eventType?.includes('disconnect'))) {
    patterns.push({ type: 'communication_cutoff', description: 'Communication device disconnected', significance: 'HIGH' });
  }

  return { correlations, gaps, patterns };
}

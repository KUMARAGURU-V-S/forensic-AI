/**
 * ═══════════════════════════════════════════════════════════════
 * Cross-Case Intelligence & Advanced TOD Engine
 * ═══════════════════════════════════════════════════════════════
 */

// ═══ CROSS-CASE INTELLIGENCE MATCHING ═══

export interface CaseSignature {
  id: string;
  caseNumber: string;
  features: {
    mannerOfDeath: string;
    weaponType: string[];
    injuryPattern: string[];
    toxicology: string[];
    location: string;
    timeOfDay: string;
    victimProfile: string;
    moPattern: string[];
  };
}

export interface CaseMatch {
  caseId: string;
  caseNumber: string;
  similarity: number;
  matchingFeatures: string[];
  potentialLink: 'serial' | 'related' | 'similar_mo' | 'coincidental';
  explanation: string;
}

export class CrossCaseEngine {
  // Simulated historical case database
  private historicalCases: CaseSignature[] = [
    {
      id: 'hist-1', caseNumber: 'CASE-2023-0512',
      features: { mannerOfDeath: 'homicide', weaponType: ['ligature', 'blunt'], injuryPattern: ['strangulation', 'head_trauma'], toxicology: ['benzodiazepine'], location: 'industrial', timeOfDay: 'night', victimProfile: 'adult_male', moPattern: ['sedation_then_violence', 'single_attacker'] }
    },
    {
      id: 'hist-2', caseNumber: 'CASE-2023-0298',
      features: { mannerOfDeath: 'homicide', weaponType: ['ligature'], injuryPattern: ['strangulation'], toxicology: ['rohypnol'], location: 'residential', timeOfDay: 'night', victimProfile: 'adult_female', moPattern: ['sedation_then_violence', 'single_attacker'] }
    },
    {
      id: 'hist-3', caseNumber: 'CASE-2022-0891',
      features: { mannerOfDeath: 'homicide', weaponType: ['sharp'], injuryPattern: ['stab_wounds'], toxicology: [], location: 'outdoor', timeOfDay: 'evening', victimProfile: 'adult_male', moPattern: ['confrontation', 'multiple_attackers'] }
    },
    {
      id: 'hist-4', caseNumber: 'CASE-2024-0103',
      features: { mannerOfDeath: 'homicide', weaponType: ['blunt', 'ligature'], injuryPattern: ['head_trauma', 'strangulation', 'defensive_wounds'], toxicology: ['diazepam'], location: 'commercial', timeOfDay: 'night', victimProfile: 'adult_male', moPattern: ['sedation_then_violence', 'abandoned_location', 'single_attacker'] }
    },
  ];

  matchCase(currentCase: CaseSignature): CaseMatch[] {
    const matches: CaseMatch[] = [];

    for (const historic of this.historicalCases) {
      const matchingFeatures: string[] = [];
      let score = 0;
      let maxScore = 0;

      // Manner of death (weight: 2)
      maxScore += 2;
      if (historic.features.mannerOfDeath === currentCase.features.mannerOfDeath) {
        score += 2;
        matchingFeatures.push('manner_of_death');
      }

      // Weapon overlap (weight: 3)
      maxScore += 3;
      const weaponOverlap = currentCase.features.weaponType.filter(w => historic.features.weaponType.includes(w));
      if (weaponOverlap.length > 0) {
        score += Math.min(3, weaponOverlap.length * 1.5);
        matchingFeatures.push(`weapons: ${weaponOverlap.join(', ')}`);
      }

      // Injury pattern (weight: 3)
      maxScore += 3;
      const injuryOverlap = currentCase.features.injuryPattern.filter(i => historic.features.injuryPattern.includes(i));
      if (injuryOverlap.length > 0) {
        score += Math.min(3, injuryOverlap.length * 1.5);
        matchingFeatures.push(`injuries: ${injuryOverlap.join(', ')}`);
      }

      // Toxicology (weight: 2)
      maxScore += 2;
      const toxOverlap = currentCase.features.toxicology.filter(t => historic.features.toxicology.includes(t));
      if (toxOverlap.length > 0) {
        score += 2;
        matchingFeatures.push(`toxicology: ${toxOverlap.join(', ')}`);
      }

      // MO pattern (weight: 4 — most important)
      maxScore += 4;
      const moOverlap = currentCase.features.moPattern.filter(m => historic.features.moPattern.includes(m));
      if (moOverlap.length > 0) {
        score += Math.min(4, moOverlap.length * 2);
        matchingFeatures.push(`MO: ${moOverlap.join(', ')}`);
      }

      // Time of day (weight: 1)
      maxScore += 1;
      if (historic.features.timeOfDay === currentCase.features.timeOfDay) {
        score += 1;
        matchingFeatures.push('time_of_day');
      }

      // Victim profile (weight: 1)
      maxScore += 1;
      if (historic.features.victimProfile === currentCase.features.victimProfile) {
        score += 1;
        matchingFeatures.push('victim_profile');
      }

      const similarity = score / maxScore;

      if (similarity > 0.4) {
        let potentialLink: CaseMatch['potentialLink'] = 'coincidental';
        if (similarity > 0.8) potentialLink = 'serial';
        else if (similarity > 0.65) potentialLink = 'related';
        else if (similarity > 0.5) potentialLink = 'similar_mo';

        matches.push({
          caseId: historic.id,
          caseNumber: historic.caseNumber,
          similarity: Math.round(similarity * 100) / 100,
          matchingFeatures,
          potentialLink,
          explanation: this.generateMatchExplanation(similarity, matchingFeatures, potentialLink)
        });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  private generateMatchExplanation(similarity: number, features: string[], link: string): string {
    if (link === 'serial') {
      return `⚠️ SERIAL PATTERN DETECTED (${(similarity * 100).toFixed(0)}% match). Matching features: ${features.join('; ')}. Recommend immediate cross-referencing with cold case unit.`;
    }
    if (link === 'related') {
      return `Strong similarity (${(similarity * 100).toFixed(0)}%). Cases share: ${features.join('; ')}. May indicate same perpetrator or organized pattern.`;
    }
    return `Moderate similarity (${(similarity * 100).toFixed(0)}%). Shared characteristics: ${features.join('; ')}.`;
  }
}

// ═══ DUAL-MODE TIME-OF-DEATH ENGINE ═══

export interface DualTodResult {
  earlyPhase: {
    method: string;
    pmiHours: number;
    lowerBound: number;
    upperBound: number;
    confidence: string;
    indicators: { name: string; value: string; contribution: string }[];
  };
  latePhase: {
    method: string;
    pmiHours: number | null;
    indicators: { name: string; value: string; contribution: string }[];
    applicable: boolean;
  };
  combined: {
    bestEstimate: number;
    range: string;
    confidence: string;
    methodology: string;
  };
  coolingCurve: { time: number; temp: number }[];
}

export class DualModeTodEngine {
  private T_INITIAL = 37.2;

  estimate(params: {
    rectalTemp: number;
    ambientTemp: number;
    bodyWeight: number;
    correctiveFactor: number;
    rigorMortis: string;
    lividity: string;
    decomposition: string;
    vitreousPotassium?: number; // mEq/L
    bodyCondition?: string;
  }): DualTodResult {
    
    // ═══ EARLY PHASE (0-72h): Henssge + Physical Signs ═══
    const effectiveWeight = params.correctiveFactor * params.bodyWeight;
    const B = 1.2815 * Math.pow(effectiveWeight, -0.625) + 0.0284;
    const Q = (params.rectalTemp - params.ambientTemp) / (this.T_INITIAL - params.ambientTemp);

    let henssePMI = 0;
    if (Q > 0 && Q < 1) {
      let t = 10;
      for (let i = 0; i < 100; i++) {
        const f = 1.25 * Math.exp(-B * t) - 0.25 * Math.exp(-5 * B * t) - Q;
        const fp = -1.25 * B * Math.exp(-B * t) + 1.25 * B * Math.exp(-5 * B * t);
        if (Math.abs(fp) < 1e-12) break;
        t = t - f / fp;
        if (Math.abs(f) < 0.0001) break;
      }
      henssePMI = Math.max(0, t);
    }

    // Vitreous potassium (if available)
    let potassiumPMI: number | null = null;
    if (params.vitreousPotassium) {
      // Sturner formula: PMI (hours) = 7.14 * [K+] - 39.1
      potassiumPMI = 7.14 * params.vitreousPotassium - 39.1;
    }

    // Rigor/lividity ranges
    const rigorRanges: Record<string, [number, number]> = {
      absent: [0, 3], developing: [2, 8], full: [8, 24], resolving: [24, 72]
    };
    const lividityRanges: Record<string, [number, number]> = {
      absent: [0, 1], developing: [0.5, 4], present_movable: [2, 12], fixed: [8, 200]
    };

    const rigorRange = rigorRanges[params.rigorMortis] || [0, 72];
    const lividRange = lividityRanges[params.lividity] || [0, 200];

    const stdError = params.bodyWeight >= 50 && params.bodyWeight <= 100 ? 2.8 : 3.2;

    const earlyPhase = {
      method: 'Henssge Nomogram (1988) + Physical Indicators',
      pmiHours: Math.round(henssePMI * 10) / 10,
      lowerBound: Math.round(Math.max(0, henssePMI - stdError) * 10) / 10,
      upperBound: Math.round((henssePMI + stdError) * 10) / 10,
      confidence: Q > 0.2 && Q < 0.8 ? 'HIGH' : 'MODERATE',
      indicators: [
        { name: 'Body Temperature', value: `${params.rectalTemp}°C`, contribution: `Primary (Q=${Q.toFixed(3)})` },
        { name: 'Rigor Mortis', value: params.rigorMortis, contribution: `${rigorRange[0]}-${rigorRange[1]}h range` },
        { name: 'Lividity', value: params.lividity, contribution: `${lividRange[0]}-${Math.min(lividRange[1], 72)}h range` },
        ...(potassiumPMI ? [{ name: 'Vitreous K+', value: `${params.vitreousPotassium} mEq/L`, contribution: `~${potassiumPMI.toFixed(1)}h (Sturner)` }] : []),
      ]
    };

    // ═══ LATE PHASE (>72h): Metabolomic/Decomposition ML ═══
    const decompScores: Record<string, number> = {
      absent: 0, early: 48, bloating: 96, advanced: 200
    };
    const decompPMI = decompScores[params.decomposition] || 0;

    const latePhase = {
      method: 'Metabolomic Regression + Decomposition Staging',
      pmiHours: decompPMI > 0 ? decompPMI : null,
      applicable: params.decomposition !== 'absent',
      indicators: [
        { name: 'Decomposition Stage', value: params.decomposition, contribution: decompPMI > 0 ? `~${decompPMI}h estimate` : 'Not applicable' },
        { name: 'Biochemical Markers', value: 'Simulated', contribution: 'ML regression model' },
      ]
    };

    // ═══ COMBINED ESTIMATE ═══
    let bestEstimate = henssePMI;
    let methodology = 'Henssge primary';

    if (potassiumPMI && Math.abs(potassiumPMI - henssePMI) < 6) {
      bestEstimate = (henssePMI * 0.7 + potassiumPMI * 0.3);
      methodology = 'Henssge (70%) + Vitreous K+ (30%)';
    }
    if (latePhase.applicable && decompPMI > 72) {
      bestEstimate = decompPMI;
      methodology = 'Decomposition staging (late-phase dominant)';
    }

    bestEstimate = Math.round(bestEstimate * 10) / 10;

    // Cooling curve
    const coolingCurve = Array.from({ length: 48 }, (_, i) => ({
      time: i,
      temp: params.ambientTemp + (this.T_INITIAL - params.ambientTemp) * (1.25 * Math.exp(-B * i) - 0.25 * Math.exp(-5 * B * i))
    }));

    return {
      earlyPhase,
      latePhase,
      combined: {
        bestEstimate,
        range: `${Math.max(0, bestEstimate - stdError).toFixed(1)} — ${(bestEstimate + stdError).toFixed(1)} hours`,
        confidence: earlyPhase.confidence,
        methodology
      },
      coolingCurve
    };
  }
}

// ═══ SMART EVIDENCE PRIORITIZATION ═══

export interface PrioritizedEvidence {
  id: string;
  content: string;
  type: string;
  priority: number; // 1-10
  reasoning: string;
  actionRequired: string;
  timeUrgency: 'immediate' | 'high' | 'medium' | 'low';
}

export function prioritizeEvidence(findings: any[]): PrioritizedEvidence[] {
  const prioritized: PrioritizedEvidence[] = [];

  findings.forEach((f, i) => {
    let priority = 5;
    let reasoning = '';
    let action = '';
    let urgency: PrioritizedEvidence['timeUrgency'] = 'medium';

    if (f.content?.toLowerCase().includes('dna') || f.content?.toLowerCase().includes('fingernail')) {
      priority = 10;
      reasoning = 'DNA evidence directly identifies suspect';
      action = 'Submit for immediate DNA analysis and CODIS search';
      urgency = 'immediate';
    } else if (f.type === 'PERSON_DISCREPANCY' || f.content?.toLowerCase().includes('defensive')) {
      priority = 9;
      reasoning = 'Directly indicates interpersonal violence and suspect presence';
      action = 'Cross-reference CCTV for facial identification';
      urgency = 'immediate';
    } else if (f.content?.toLowerCase().includes('vehicle') || f.content?.toLowerCase().includes('sedan')) {
      priority = 8;
      reasoning = 'Vehicle identification can lead directly to suspect';
      action = 'Run plate recognition on CCTV footage';
      urgency = 'high';
    } else if (f.content?.toLowerCase().includes('fiber') || f.content?.toLowerCase().includes('foreign')) {
      priority = 7;
      reasoning = 'Trace evidence links suspect to specific items';
      action = 'Lab analysis for material identification';
      urgency = 'high';
    } else if (f.type === 'TOXICOLOGY') {
      priority = 6;
      reasoning = 'Toxicology may indicate premeditation (sedation)';
      action = 'Check victim prescription records and purchase history';
      urgency = 'medium';
    } else if (f.type === 'TIMELINE_GAP') {
      priority = 5;
      reasoning = 'Gaps may contain unrecovered evidence';
      action = 'Search for additional CCTV coverage in gap periods';
      urgency = 'medium';
    } else {
      priority = 3;
      reasoning = 'Supporting evidence for case building';
      action = 'Document and preserve';
      urgency = 'low';
    }

    prioritized.push({
      id: `pri-${i}`,
      content: f.content?.slice(0, 100) || f.type || 'Unknown',
      type: f.type || 'GENERAL',
      priority,
      reasoning,
      actionRequired: action,
      timeUrgency: urgency
    });
  });

  return prioritized.sort((a, b) => b.priority - a.priority);
}

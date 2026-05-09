"""
Forensic Engine — Core analysis functions.
Ported from forensix-ai-nextjs lib/forensic-engine.ts

Contains:
- Henssge Nomogram (Time of Death)
- Autopsy Report NLP Analysis
- Digital Evidence Correlation
"""
import re
import math
from typing import List, Dict, Any, Optional, Tuple


# ═══════════════════════════════════════════════════════════════
# HENSSGE NOMOGRAM — TIME OF DEATH ESTIMATION
# ═══════════════════════════════════════════════════════════════

def estimate_time_of_death(rectal_temp: float, ambient_temp: float, body_weight: float,
                           corrective_factor: float = 0.9, rigor_mortis: str = "full",
                           lividity: str = "fixed", decomposition: str = "absent") -> Dict[str, Any]:
    """Henssge double-exponential model for PMI estimation."""
    T_INITIAL = 37.2
    effective_weight = corrective_factor * body_weight
    B = 1.2815 * (effective_weight ** -0.625) + 0.0284
    Q = (rectal_temp - ambient_temp) / (T_INITIAL - ambient_temp) if (T_INITIAL - ambient_temp) != 0 else 0

    pmi = 0.0
    if 0 < Q < 1:
        t = 10.0
        for _ in range(50):
            f = 1.25 * math.exp(-B * t) - 0.25 * math.exp(-5 * B * t) - Q
            fp = -1.25 * B * math.exp(-B * t) + 1.25 * B * math.exp(-5 * B * t)
            if abs(fp) < 1e-10:
                break
            t = t - f / fp
            if abs(f) < 0.001:
                break
        pmi = max(0, t)

    rigor_ranges = {"absent": (0, 3), "developing": (2, 8), "full": (8, 24), "resolving": (24, 72)}
    lividity_ranges = {"absent": (0, 1), "developing": (0.5, 4), "present_movable": (2, 12), "fixed": (8, 200)}

    rigor_range = rigor_ranges.get(rigor_mortis, (0, 72))
    livid_range = lividity_ranges.get(lividity, (0, 200))

    std_error = 2.8 if 50 <= body_weight <= 100 else 3.2
    lower_bound = max(0, pmi - std_error)
    upper_bound = pmi + std_error

    signs_middle = (rigor_range[0] + rigor_range[1]) / 2
    spread = abs(pmi - signs_middle)
    confidence = "HIGH" if spread < pmi * 0.3 else ("MODERATE" if spread < pmi * 0.6 else "LOW")

    cooling_curve = []
    for i in range(48):
        temp = ambient_temp + (T_INITIAL - ambient_temp) * (1.25 * math.exp(-B * i) - 0.25 * math.exp(-5 * B * i))
        cooling_curve.append({"time": i, "temp": round(temp, 2)})

    return {
        "estimatedPMI": round(pmi, 1),
        "lowerBound": round(lower_bound, 1),
        "upperBound": round(upper_bound, 1),
        "confidence": confidence,
        "methodology": "Henssge Nomogram (1988) with environmental correction",
        "coolingCurve": cooling_curve,
        "signsAssessment": [
            {"sign": "Rigor Mortis", "state": rigor_mortis, "range": f"{rigor_range[0]}-{rigor_range[1]}h"},
            {"sign": "Lividity", "state": lividity, "range": f"{livid_range[0]}-{livid_range[1]}h"},
            {"sign": "Decomposition", "state": decomposition, "range": ""},
        ],
    }


# ═══════════════════════════════════════════════════════════════
# AUTOPSY REPORT NLP ANALYSIS
# ═══════════════════════════════════════════════════════════════

FORENSIC_PATTERNS = {
    "CAUSE_OF_DEATH": [
        r"cause\s+of\s+death[:\s]*([^\n.]{5,120})",
        r"fatal\s+([^\n.,]+(?:injury|trauma|hemorrhage|asphyxia|poisoning))",
        r"(asphyxia\s+due\s+to\s+[^\n.,]+)",
    ],
    "MANNER_OF_DEATH": [
        r"manner\s+of\s+death[:\s]*(homicide|suicide|accidental?|natural|undetermined)",
    ],
    "INJURY": [
        r"(blunt\s+force\s+trauma[^\n.,]{0,80})",
        r"(gunshot\s+wound[^\n.,]{0,60})",
        r"(stab\s+wound[^\n.,]{0,60})",
        r"(defensive\s+wounds?[^\n.,]{0,80})",
        r"(petechial\s+hemorrhages?[^\n.,]{0,60})",
        r"(ligature\s+mark[^\n.,]{0,80})",
        r"(subdural\s+hematoma[^\n.,]{0,60})",
        r"(contusion[s]?\s+(?:on|of|to)\s+[^\n.,]{0,60})",
    ],
    "TOXICOLOGY": [
        r"(blood\s+alcohol[:\s]*\d+\.\d+\s*g\/dL[^\n.,]*)",
        r"(benzodiazepines?[:\s]*[^\n.,]{0,60})",
        r"(no\s+illicit\s+substances?\s+detected)",
    ],
    "TIME_INDICATOR": [
        r"((?:approximately|estimated)\s+\d+[-\u2013]\d+\s+hours?\s+(?:prior|before)[^\n.,]*)",
        r"(rigor\s+mortis\s+is\s+fully\s+developed[^\n.,]{0,40})",
        r"(lividity\s+is\s+fixed[^\n.,]{0,40})",
    ],
    "EVIDENCE": [
        r"(skin\s+under\s+fingernails\s+collected[^\n.,]{0,60})",
        r"(foreign\s+fibers?\s+recovered[^\n.,]{0,60})",
        r"(DNA\s+(?:analysis|sample|collected)[^\n.,]{0,40})",
    ],
}

VIOLENCE_KEYWORDS = {
    "homicide": 95, "gunshot": 95, "stab": 90, "defensive wounds": 90,
    "ligature": 85, "strangulation": 90, "blunt force trauma": 85,
    "subdural hematoma": 80, "hemorrhage": 75, "fracture": 70,
    "asphyxia": 80, "petechial": 75, "contusion": 65, "laceration": 70,
}


def analyze_autopsy_report(text: str) -> Dict[str, Any]:
    """Full NLP analysis of autopsy report text."""
    entities = []
    seen = set()

    for label, patterns in FORENSIC_PATTERNS.items():
        for pattern in patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                entity_text = (match.group(1) if match.lastindex else match.group(0)).strip()
                if len(entity_text) < 3 or entity_text.lower() in seen:
                    continue
                seen.add(entity_text.lower())
                entities.append({
                    "text": entity_text,
                    "label": label,
                    "confidence": min(0.95, 0.75 + len(entity_text) * 0.002),
                })

    cause_of_death = [e["text"] for e in entities if e["label"] == "CAUSE_OF_DEATH"]
    manner_of_death = next((e["text"] for e in entities if e["label"] == "MANNER_OF_DEATH"), None)
    injuries = [e["text"] for e in entities if e["label"] == "INJURY"]
    toxicology = [e["text"] for e in entities if e["label"] == "TOXICOLOGY"]
    time_indicators = [e["text"] for e in entities if e["label"] == "TIME_INDICATOR"]
    evidence = [e["text"] for e in entities if e["label"] == "EVIDENCE"]

    # Calculate risk score
    text_lower = text.lower()
    max_violence = 0
    violence_count = 0
    for kw, score in VIOLENCE_KEYWORDS.items():
        if kw in text_lower:
            max_violence = max(max_violence, score)
            violence_count += 1
    risk_score = min(100, round(max_violence * min(1.3, 1 + violence_count * 0.05)))
    risk_level = "CRITICAL" if risk_score >= 75 else ("HIGH" if risk_score >= 50 else ("MODERATE" if risk_score >= 30 else "LOW"))

    # Anomalies
    anomalies = []
    if "defensive" in text_lower and manner_of_death and "homicide" not in manner_of_death.lower():
        anomalies.append({
            "type": "manner_mismatch", "severity": "CRITICAL",
            "description": "Defensive wounds detected but manner not classified as homicide",
            "recommendation": "Review manner determination — defensive wounds suggest interpersonal violence",
        })
    if "benzodiazepine" in text_lower or "diazepam" in text_lower:
        if "overdose" not in text_lower:
            anomalies.append({
                "type": "sedation_indicator", "severity": "HIGH",
                "description": "Sedative substances detected in non-overdose death",
                "recommendation": "Consider possibility of incapacitation prior to injuries",
            })

    return {
        "entities": entities,
        "causeOfDeath": cause_of_death,
        "mannerOfDeath": manner_of_death,
        "injuries": injuries,
        "toxicology": toxicology,
        "timeIndicators": time_indicators,
        "evidence": evidence,
        "riskScore": risk_score,
        "riskLevel": risk_level,
        "anomalies": anomalies,
        "summary": f"Identified {len(entities)} forensic entities. {len(injuries)} injuries documented. Risk level: {risk_level} ({risk_score}/100).",
    }


# ═══════════════════════════════════════════════════════════════
# DIGITAL EVIDENCE CORRELATION
# ═══════════════════════════════════════════════════════════════

def correlate_evidence(evidence: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Find temporal correlations, gaps, and patterns in digital evidence."""
    from datetime import datetime

    def parse_ts(ts):
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            return None

    sorted_ev = sorted(
        [e for e in evidence if parse_ts(e.get("timestamp", ""))],
        key=lambda e: parse_ts(e["timestamp"])
    )

    correlations = []
    gaps = []
    patterns = []

    for i in range(len(sorted_ev) - 1):
        for j in range(i + 1, min(i + 5, len(sorted_ev))):
            t1 = parse_ts(sorted_ev[i]["timestamp"])
            t2 = parse_ts(sorted_ev[j]["timestamp"])
            diff = (t2 - t1).total_seconds() / 60
            if 0 < diff <= 15 and sorted_ev[i].get("source") != sorted_ev[j].get("source"):
                correlations.append({
                    "event1": f"{sorted_ev[i].get('source', '')}: {sorted_ev[i].get('details', '')[:40]}",
                    "event2": f"{sorted_ev[j].get('source', '')}: {sorted_ev[j].get('details', '')[:40]}",
                    "timeDiff": round(diff, 1),
                    "significance": "HIGH" if diff <= 5 else "MODERATE",
                })

        # Detect gaps
        t1 = parse_ts(sorted_ev[i]["timestamp"])
        t2 = parse_ts(sorted_ev[i + 1]["timestamp"])
        gap_min = (t2 - t1).total_seconds() / 60
        if gap_min > 30:
            gaps.append({
                "start": sorted_ev[i]["timestamp"],
                "end": sorted_ev[i + 1]["timestamp"],
                "duration": round(gap_min),
                "severity": "HIGH" if gap_min > 120 else ("MODERATE" if gap_min > 60 else "LOW"),
            })

    # Detect patterns
    details = [e.get("details", "").lower() for e in sorted_ev]
    multiple_arrive = any("two" in d or "multiple" in d for d in details)
    single_leave = any("single" in d or "alone" in d for d in details)
    if multiple_arrive and single_leave:
        patterns.append({"type": "person_count_discrepancy", "description": "Multiple arrived but fewer departed", "significance": "CRITICAL"})
    if any("high speed" in d or "rapidly" in d for d in details):
        patterns.append({"type": "rapid_departure", "description": "Vehicle/person departing at unusual speed", "significance": "HIGH"})

    return {"correlations": correlations, "gaps": gaps, "patterns": patterns}

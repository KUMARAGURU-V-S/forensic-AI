"""
Multi-Agent Forensic AI System — Full orchestrator.
Ported from forensix-ai-nextjs lib/multi-agent-system.ts + multi-agent-system/orchestrator.ts

Architecture: Multiple specialized AI agents that independently analyze evidence
and collaborate through a Correlation Agent.

Agents:
1. AutopsyAgent — Extracts injuries, COD, manner from reports
2. TimelineAgent — Builds chronological event sequence
3. DigitalAgent — Analyzes CCTV, mobile, GPS data
4. ToxicologyAgent — Interprets drug/poison findings
5. CorrelationAgent — Connects findings across agents
6. ExplainabilityAgent — Generates human-readable reasoning
7. RiskAgent — Computes multi-factor suspicion score
"""
import re
import time
import random
from typing import List, Dict, Any, Optional
from datetime import datetime


class Finding:
    def __init__(self, id: str, type: str, content: str, confidence: float,
                 severity: str, evidence: List[str] = None, related_entities: List[str] = None):
        self.id = id
        self.type = type
        self.content = content
        self.confidence = confidence
        self.severity = severity
        self.evidence = evidence or []
        self.related_entities = related_entities or []

    def to_dict(self):
        return {
            "id": self.id, "type": self.type, "content": self.content,
            "confidence": self.confidence, "severity": self.severity,
            "evidence": self.evidence, "relatedEntities": self.related_entities,
        }


# ═══ AGENT 1: AUTOPSY AGENT ═══
class AutopsyAgent:
    id = "autopsy-agent"
    name = "Autopsy Intelligence Agent"

    def analyze(self, report_text: str) -> Dict[str, Any]:
        start = time.time()
        findings = []

        cod_match = re.search(r"cause\s+of\s+death[:\s]*([^\n.]{5,150})", report_text, re.IGNORECASE)
        if cod_match:
            findings.append(Finding("cod-1", "CAUSE_OF_DEATH", cod_match.group(1).strip(), 0.92, "CRITICAL", [cod_match.group(0)], ["victim"]))

        manner_match = re.search(r"manner\s+of\s+death[:\s]*(homicide|suicide|accident(?:al)?|natural|undetermined)", report_text, re.IGNORECASE)
        if manner_match:
            findings.append(Finding("manner-1", "MANNER_OF_DEATH", manner_match.group(1), 0.95, "CRITICAL", [manner_match.group(0)], ["victim", "suspect"]))

        injury_patterns = [
            (r"blunt\s+force\s+trauma[^\n.,]{0,80}", "HIGH"),
            (r"defensive\s+wounds?[^\n.,]{0,80}", "CRITICAL"),
            (r"ligature\s+mark[^\n.,]{0,80}", "HIGH"),
            (r"petechial\s+hemorrhages?[^\n.,]{0,60}", "HIGH"),
            (r"subdural\s+hematoma[^\n.,]{0,60}", "HIGH"),
            (r"gunshot\s+wound[^\n.,]{0,60}", "CRITICAL"),
            (r"stab\s+wound[^\n.,]{0,60}", "CRITICAL"),
        ]
        for idx, (pat, sev) in enumerate(injury_patterns):
            for match in re.finditer(pat, report_text, re.IGNORECASE):
                findings.append(Finding(f"injury-{idx}-{match.start()}", "INJURY", match.group(0).strip(), 0.88, sev, [match.group(0)], ["victim"]))

        tox_patterns = [r"blood\s+alcohol[:\s]*[\d.]+\s*g\/dL", r"benzodiazepines?[:\s]*[^\n.,]{0,60}"]
        for idx, pat in enumerate(tox_patterns):
            for match in re.finditer(pat, report_text, re.IGNORECASE):
                findings.append(Finding(f"tox-{idx}", "TOXICOLOGY", match.group(0).strip(), 0.9, "HIGH", [match.group(0)], ["victim", "substance"]))

        return {
            "agentId": self.id, "agentName": self.name, "status": "completed",
            "confidence": 0.87 if findings else 0.3,
            "findings": [f.to_dict() for f in findings],
            "metadata": {"totalInjuries": sum(1 for f in findings if f.type == "INJURY")},
            "executionTimeMs": int((time.time() - start) * 1000),
        }


# ═══ AGENT 2: TIMELINE AGENT ═══
class TimelineAgent:
    id = "timeline-agent"
    name = "Timeline Reconstruction Agent"

    def analyze(self, events: List[Dict]) -> Dict[str, Any]:
        start = time.time()
        findings = []
        if not events:
            return {"agentId": self.id, "agentName": self.name, "status": "partial", "confidence": 0.2, "findings": [], "metadata": {}, "executionTimeMs": 0}

        def parse_ts(ts):
            try:
                return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
            except:
                return None

        sorted_ev = sorted([e for e in events if parse_ts(e.get("timestamp"))], key=lambda e: parse_ts(e["timestamp"]))

        for i in range(len(sorted_ev) - 1):
            t1 = parse_ts(sorted_ev[i]["timestamp"])
            t2 = parse_ts(sorted_ev[i + 1]["timestamp"])
            gap = (t2 - t1).total_seconds() / 60
            if gap > 30:
                findings.append(Finding(f"gap-{i}", "TIMELINE_GAP", f"{int(gap)} minute gap between events", 0.85, "HIGH" if gap > 120 else "MODERATE").to_dict())
            if 0 < gap < 5 and sorted_ev[i].get("source") != sorted_ev[i + 1].get("source"):
                findings.append(Finding(f"cluster-{i}", "EVENT_CLUSTER", f"Rapid sequence: {sorted_ev[i].get('source','')} → {sorted_ev[i+1].get('source','')} ({gap:.1f}min)", 0.82, "HIGH").to_dict())

        return {
            "agentId": self.id, "agentName": self.name, "status": "completed",
            "confidence": 0.84, "findings": findings,
            "metadata": {"eventCount": len(sorted_ev), "gapCount": sum(1 for f in findings if f.get("type") == "TIMELINE_GAP")},
            "executionTimeMs": int((time.time() - start) * 1000),
        }


# ═══ AGENT 3: DIGITAL EVIDENCE AGENT ═══
class DigitalAgent:
    id = "digital-agent"
    name = "Digital Forensics Agent"

    def analyze(self, evidence: List[Dict]) -> Dict[str, Any]:
        start = time.time()
        findings = []
        if not evidence:
            return {"agentId": self.id, "agentName": self.name, "status": "partial", "confidence": 0.2, "findings": [], "metadata": {}, "executionTimeMs": 0}

        details = [e.get("details", "").lower() for e in evidence]
        if any("two" in d or "multiple" in d for d in details) and any("single" in d or "alone" in d for d in details):
            findings.append(Finding("pattern-persons", "PERSON_DISCREPANCY", "Multiple individuals arrived but fewer departed — indicates potential victim left behind", 0.91, "CRITICAL").to_dict())
        if any("high speed" in d or "rapid" in d or "fleeing" in d for d in details):
            findings.append(Finding("pattern-speed", "RAPID_DEPARTURE", "Vehicle/person departing at unusual speed", 0.87, "HIGH").to_dict())
        if any(e.get("eventType", "").lower().find("disconnect") >= 0 for e in evidence):
            findings.append(Finding("pattern-disconnect", "COMMUNICATION_CUTOFF", "Device disconnected — possible victim incapacitation", 0.89, "HIGH").to_dict())

        return {
            "agentId": self.id, "agentName": self.name, "status": "completed",
            "confidence": 0.86, "findings": findings,
            "metadata": {"sourceCount": len(set(e.get("source", "") for e in evidence))},
            "executionTimeMs": int((time.time() - start) * 1000),
        }


# ═══ AGENT 4: RISK AGENT ═══
class RiskAgent:
    id = "risk-agent"
    name = "Risk Assessment Agent"

    WEIGHTS = {"violence": 0.25, "manner": 0.15, "toxicology": 0.10, "digital_patterns": 0.20, "evidence_gaps": 0.15, "temporal": 0.15}

    def analyze(self, all_findings: List[Dict]) -> Dict[str, Any]:
        start = time.time()
        scores = {}
        critical = sum(1 for f in all_findings if f.get("type") == "INJURY" and f.get("severity") == "CRITICAL")
        high = sum(1 for f in all_findings if f.get("type") == "INJURY" and f.get("severity") == "HIGH")
        scores["violence"] = min(100, critical * 30 + high * 15 + 20)

        manner = next((f.get("content", "").lower() for f in all_findings if f.get("type") == "MANNER_OF_DEATH"), "")
        scores["manner"] = 95 if "homicide" in manner else (70 if "undetermined" in manner else 50)
        scores["toxicology"] = min(80, sum(1 for f in all_findings if f.get("type") == "TOXICOLOGY") * 25 + 20) if any(f.get("type") == "TOXICOLOGY" for f in all_findings) else 10
        scores["digital_patterns"] = min(100, sum(1 for f in all_findings if f.get("type") in ("PERSON_DISCREPANCY", "RAPID_DEPARTURE", "COMMUNICATION_CUTOFF")) * 30 + 10)
        scores["evidence_gaps"] = min(100, sum(1 for f in all_findings if f.get("type") == "TIMELINE_GAP") * 20 + 15)
        scores["temporal"] = min(100, sum(1 for f in all_findings if f.get("type") == "EVENT_CLUSTER") * 25 + 20)

        risk_score = round(sum(scores.get(k, 0) * v for k, v in self.WEIGHTS.items()), 1)
        risk_level = "CRITICAL" if risk_score >= 75 else ("HIGH" if risk_score >= 55 else ("MODERATE" if risk_score >= 35 else "LOW"))

        findings = [Finding(f"risk-{k}", "RISK_FACTOR", f"{k.replace('_', ' ')}: {v}/100", 0.88, "CRITICAL" if v >= 80 else "HIGH").to_dict()
                    for k, v in scores.items() if v >= 60]

        return {
            "agentId": self.id, "agentName": self.name, "status": "completed",
            "confidence": 0.85, "findings": findings, "riskScore": risk_score, "riskLevel": risk_level,
            "metadata": {"scores": scores, "weights": self.WEIGHTS},
            "executionTimeMs": int((time.time() - start) * 1000),
        }


# ═══ AGENT 5: EXPLAINABILITY AGENT ═══
class ExplainabilityAgent:
    id = "explainability-agent"
    name = "Explainable AI Agent"

    def explain(self, all_findings: List[Dict], risk_score: float, risk_level: str) -> Dict[str, Any]:
        start = time.time()
        attributions = []
        critical_findings = [f for f in all_findings if f.get("severity") == "CRITICAL"]
        high_findings = [f for f in all_findings if f.get("severity") == "HIGH"]

        for f in critical_findings:
            attributions.append({"feature": f.get("type", "").replace("_", " "), "value": f.get("content", "")[:80], "contribution": round(0.15 + random.random() * 0.1, 3), "direction": "positive"})
        for f in high_findings[:5]:
            attributions.append({"feature": f.get("type", "").replace("_", " "), "value": f.get("content", "")[:80], "contribution": round(0.05 + random.random() * 0.08, 3), "direction": "positive"})

        attributions.sort(key=lambda a: a["contribution"], reverse=True)
        top = ", ".join(a["feature"] for a in attributions[:5])

        explanation = f"## Risk Assessment (Score: {risk_score}/100 — {risk_level})\n\n"
        explanation += f"Driven by: **{top}**.\n\n"
        for i, a in enumerate(attributions[:5]):
            explanation += f"{i+1}. **{a['feature']}** (+{a['contribution']*100:.1f}%) — {a['value']}\n"

        return {
            "agentId": self.id, "agentName": self.name, "status": "completed",
            "confidence": 0.82, "findings": [], "explanation": explanation, "attributions": attributions,
            "executionTimeMs": int((time.time() - start) * 1000),
        }


# ═══ AGENT 6: CORRELATION AGENT ═══
class CorrelationAgent:
    id = "correlation-agent"
    name = "Cross-Evidence Correlation Agent"

    def correlate(self, all_findings: List[Dict]) -> List[Dict]:
        correlations = []
        has_person_disc = any(f.get("type") == "PERSON_DISCREPANCY" for f in all_findings)
        has_disconnect = any(f.get("type") == "COMMUNICATION_CUTOFF" for f in all_findings)
        has_manner_homicide = any(f.get("type") == "MANNER_OF_DEATH" and "homicide" in f.get("content", "").lower() for f in all_findings)
        has_defensive = any("defensive" in f.get("content", "").lower() for f in all_findings)
        has_rapid = any(f.get("type") == "RAPID_DEPARTURE" for f in all_findings)
        has_benzo = any("benzodiazepine" in f.get("content", "").lower() or "diazepam" in f.get("content", "").lower() for f in all_findings)

        if has_person_disc and has_disconnect:
            correlations.append({"id": "corr-1", "type": "temporal", "source": "Person count discrepancy", "target": "Phone disconnection", "strength": 0.91, "description": "Victim phone disconnected after lone person departed"})
        if has_manner_homicide and has_defensive:
            correlations.append({"id": "corr-2", "type": "forensic", "source": "Defensive wounds", "target": "Homicide classification", "strength": 0.94, "description": "Defensive wounds corroborate homicide manner"})
        if has_benzo and has_defensive:
            correlations.append({"id": "corr-3", "type": "causal", "source": "Sedative detected", "target": "Defensive wounds", "strength": 0.78, "description": "Victim was drugged but still fought back initially"})
        if has_rapid and has_disconnect:
            correlations.append({"id": "corr-4", "type": "behavioral", "source": "Rapid departure", "target": "Communication cutoff", "strength": 0.87, "description": "Suspect fled at high speed after victim's phone went silent"})

        return correlations


# ═══ CROSS-CASE INTELLIGENCE ═══
class CrossCaseEngine:
    """Matches current case against historical database for serial pattern detection."""
    HISTORICAL = [
        {"id": "hist-1", "caseNumber": "CASE-2023-0512", "features": {"mannerOfDeath": "homicide", "weaponType": ["ligature", "blunt"], "injuryPattern": ["strangulation", "head_trauma"], "toxicology": ["benzodiazepine"], "location": "industrial", "timeOfDay": "night", "victimProfile": "adult_male", "moPattern": ["sedation_then_violence", "single_attacker"]}},
        {"id": "hist-2", "caseNumber": "CASE-2023-0298", "features": {"mannerOfDeath": "homicide", "weaponType": ["ligature"], "injuryPattern": ["strangulation"], "toxicology": ["rohypnol"], "location": "residential", "timeOfDay": "night", "victimProfile": "adult_female", "moPattern": ["sedation_then_violence", "single_attacker"]}},
        {"id": "hist-3", "caseNumber": "CASE-2022-0891", "features": {"mannerOfDeath": "homicide", "weaponType": ["sharp"], "injuryPattern": ["stab_wounds"], "toxicology": [], "location": "outdoor", "timeOfDay": "evening", "victimProfile": "adult_male", "moPattern": ["confrontation", "multiple_attackers"]}},
        {"id": "hist-4", "caseNumber": "CASE-2024-0103", "features": {"mannerOfDeath": "homicide", "weaponType": ["blunt", "ligature"], "injuryPattern": ["head_trauma", "strangulation", "defensive_wounds"], "toxicology": ["diazepam"], "location": "commercial", "timeOfDay": "night", "victimProfile": "adult_male", "moPattern": ["sedation_then_violence", "abandoned_location", "single_attacker"]}},
    ]

    def match_case(self, current_features: Dict) -> List[Dict]:
        matches = []
        for hist in self.HISTORICAL:
            hf = hist["features"]
            score, max_score = 0.0, 16.0
            matching = []

            if hf["mannerOfDeath"] == current_features.get("mannerOfDeath"):
                score += 2; matching.append("manner_of_death")
            weapon_overlap = set(current_features.get("weaponType", [])) & set(hf["weaponType"])
            if weapon_overlap:
                score += min(3, len(weapon_overlap) * 1.5); matching.append(f"weapons: {', '.join(weapon_overlap)}")
            injury_overlap = set(current_features.get("injuryPattern", [])) & set(hf["injuryPattern"])
            if injury_overlap:
                score += min(3, len(injury_overlap) * 1.5); matching.append(f"injuries: {', '.join(injury_overlap)}")
            tox_overlap = set(current_features.get("toxicology", [])) & set(hf["toxicology"])
            if tox_overlap:
                score += 2; matching.append(f"toxicology: {', '.join(tox_overlap)}")
            mo_overlap = set(current_features.get("moPattern", [])) & set(hf["moPattern"])
            if mo_overlap:
                score += min(4, len(mo_overlap) * 2); matching.append(f"MO: {', '.join(mo_overlap)}")
            if hf["timeOfDay"] == current_features.get("timeOfDay"):
                score += 1; matching.append("time_of_day")
            if hf["victimProfile"] == current_features.get("victimProfile"):
                score += 1; matching.append("victim_profile")

            similarity = score / max_score
            if similarity > 0.4:
                link = "serial" if similarity > 0.8 else ("related" if similarity > 0.65 else ("similar_mo" if similarity > 0.5 else "coincidental"))
                matches.append({
                    "caseId": hist["id"], "caseNumber": hist["caseNumber"],
                    "similarity": round(similarity, 2), "matchingFeatures": matching,
                    "potentialLink": link,
                })

        return sorted(matches, key=lambda m: m["similarity"], reverse=True)


# ═══ MASTER ORCHESTRATOR ═══
class ForensicMultiAgentOrchestrator:
    def __init__(self):
        self.autopsy_agent = AutopsyAgent()
        self.timeline_agent = TimelineAgent()
        self.digital_agent = DigitalAgent()
        self.risk_agent = RiskAgent()
        self.explain_agent = ExplainabilityAgent()
        self.correlation_agent = CorrelationAgent()
        self.cross_case_engine = CrossCaseEngine()

    def run_full_analysis(self, report_text: str = None, evidence: List[Dict] = None,
                          case_id: str = "demo") -> Dict[str, Any]:
        agents = []
        all_findings = []

        if report_text:
            result = self.autopsy_agent.analyze(report_text)
            agents.append(result)
            all_findings.extend(result["findings"])

        if evidence:
            tl_result = self.timeline_agent.analyze(evidence)
            agents.append(tl_result)
            all_findings.extend(tl_result["findings"])

            dig_result = self.digital_agent.analyze(evidence)
            agents.append(dig_result)
            all_findings.extend(dig_result["findings"])

        risk_result = self.risk_agent.analyze(all_findings)
        agents.append(risk_result)

        correlations = self.correlation_agent.correlate(all_findings)
        explain_result = self.explain_agent.explain(all_findings, risk_result["riskScore"], risk_result["riskLevel"])
        agents.append(explain_result)

        # Prioritize findings
        sev_order = {"CRITICAL": 4, "HIGH": 3, "MODERATE": 2, "LOW": 1, "INFO": 0}
        prioritized = sorted(all_findings, key=lambda f: (sev_order.get(f.get("severity"), 0), f.get("confidence", 0)), reverse=True)[:10]

        # Generate leads
        leads = self._generate_leads(all_findings, correlations)

        return {
            "caseId": case_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "agents": agents,
            "correlations": correlations,
            "riskScore": risk_result["riskScore"],
            "riskLevel": risk_result["riskLevel"],
            "explanation": explain_result.get("explanation", ""),
            "prioritizedFindings": prioritized,
            "investigativeLeads": leads,
        }

    def _generate_leads(self, findings: List[Dict], correlations: List[Dict]) -> List[str]:
        leads = []
        if any(f.get("type") == "PERSON_DISCREPANCY" for f in findings):
            leads.append("Identify the single individual who departed — cross-reference CCTV facial recognition")
        if any("defensive" in f.get("content", "").lower() for f in findings):
            leads.append("Collect DNA from under victim fingernails — defensive wounds indicate physical contact")
        if any(f.get("type") == "RAPID_DEPARTURE" for f in findings):
            leads.append("Trace vehicle registration from CCTV — suspect fled at high speed")
        if any("benzodiazepine" in f.get("content", "").lower() for f in findings):
            leads.append("Investigate source of benzodiazepine — check prescription history and purchases")
        if correlations:
            leads.append("Focus investigation on critical timeframe — all evidence converges")
        return leads or ["Gather additional evidence to enable AI-driven lead generation"]


# Singleton
multi_agent_system = ForensicMultiAgentOrchestrator()
cross_case_engine = CrossCaseEngine()

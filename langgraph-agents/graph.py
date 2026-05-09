"""
═══════════════════════════════════════════════════════════════════════════
ForensiX AI — LangGraph Multi-Agent System
═══════════════════════════════════════════════════════════════════════════

8 Investigation Stages orchestrated by LangGraph StateGraph:
1. Autopsy Agent      — Gemini 2.5 Pro (extracts injuries, COD, toxicology)
2. Timeline Agent     — Local deterministic (gap detection, clustering)
3. CCTV Agent         — Gemini 2.5 Flash (person/vehicle/weapon detection)
4. Toxicology Agent   — Featherless LLM (drug interactions, significance)
5. Correlation Agent  — Featherless LLM + embeddings (cross-evidence links)
6. Risk Agent         — 100% deterministic (zero AI in scoring)
7. Explainability Agent — Featherless LLM (SHAP-style explanations)
8. Lead Generator     — Deterministic post-analysis actions

Architecture: Custom StateGraph with parallel fan-out + conditional routing + HITL
═══════════════════════════════════════════════════════════════════════════
"""

import os
import json
import operator
import numpy as np
from typing import Annotated, Literal, TypedDict, Any
from dataclasses import dataclass, field
from dotenv import load_dotenv

from langgraph.graph import StateGraph, START, END
from langgraph.types import Send, interrupt
from langgraph.checkpoint.memory import MemorySaver

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

load_dotenv()


# ═══════════════════════════════════════════════════════════════
# STATE SCHEMA
# ═══════════════════════════════════════════════════════════════

class ForensicState(TypedDict):
    """Shared state across all agents. Reducers handle parallel updates."""
    case_id: str
    report_text: str
    evidence: list[dict]
    cctv_frames: list[str]  # base64 images
    toxicology_data: list[dict]

    # Agent outputs (accumulate via operator.add)
    findings: Annotated[list[dict], operator.add]
    correlations: Annotated[list[dict], operator.add]
    errors: Annotated[list[str], operator.add]
    completed_agents: Annotated[list[str], operator.add]

    # Risk (set by Risk Agent — last write wins)
    risk_score: float
    risk_level: str
    risk_factors: dict

    # Explanation
    explanation: str
    investigative_leads: list[str]

    # Control flow
    phase: str
    human_decision: str


# ═══════════════════════════════════════════════════════════════
# LLM PROVIDERS
# ═══════════════════════════════════════════════════════════════

def get_gemini(model: str = None, temperature: float = 0.1):
    """Gemini for vision + deep reasoning."""
    return ChatGoogleGenerativeAI(
        model=model or os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        google_api_key=os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"),
        temperature=temperature,
        max_output_tokens=4096,
    )


def get_featherless(temperature: float = 0.2):
    """Featherless/any OpenAI-compatible for text reasoning."""
    return ChatOpenAI(
        model=os.getenv("FEATHERLESS_MODEL") or os.getenv("LLM_MODEL", "meta-llama/Meta-Llama-3.1-70B-Instruct"),
        api_key=os.getenv("FEATHERLESS_API_KEY") or os.getenv("LLM_API_KEY"),
        base_url=os.getenv("FEATHERLESS_BASE_URL") or os.getenv("LLM_BASE_URL", "https://api.featherless.ai/v1"),
        temperature=temperature,
        max_tokens=2048,
    )


# ═══════════════════════════════════════════════════════════════
# AGENT 1: AUTOPSY AGENT (Gemini 2.5 Pro)
# ═══════════════════════════════════════════════════════════════

def autopsy_agent(state: ForensicState) -> dict:
    """Extract injuries, COD, manner, toxicology from autopsy report."""
    report = state.get("report_text", "")
    if not report or len(report) < 50:
        return {"errors": ["Autopsy: No report text provided"], "completed_agents": ["autopsy"]}

    findings = []
    try:
        llm = get_gemini(temperature=0.05)
        prompt = f"""You are an expert forensic pathologist. Extract ALL findings from this autopsy report.
Return ONLY valid JSON:
{{
  "cause_of_death": "exact text",
  "manner_of_death": "homicide|suicide|accident|natural|undetermined",
  "injuries": [{{"location":"","type":"","severity":"critical|high|moderate|low","description":""}}],
  "toxicology": [{{"substance":"","level":"","significance":"therapeutic|suspicious|toxic|lethal"}}],
  "defensive_wounds": false,
  "petechiae": false,
  "physical_evidence": [],
  "time_indicators": [],
  "body_temp": null,
  "body_weight": null
}}

REPORT:
{report[:8000]}"""

        response = llm.invoke([HumanMessage(content=prompt)])
        data = _safe_json(response.content)

        if data:
            if data.get("cause_of_death"):
                findings.append({"type": "CAUSE_OF_DEATH", "content": data["cause_of_death"], "severity": "CRITICAL", "confidence": 0.94, "agent": "autopsy"})
            if data.get("manner_of_death"):
                findings.append({"type": "MANNER_OF_DEATH", "content": data["manner_of_death"], "severity": "CRITICAL", "confidence": 0.95, "agent": "autopsy"})
            for inj in (data.get("injuries") or []):
                findings.append({"type": "INJURY", "content": f"{inj.get('type','')} — {inj.get('location','')}: {inj.get('description','')}", "severity": inj.get("severity", "moderate").upper(), "confidence": 0.91, "agent": "autopsy"})
            for tox in (data.get("toxicology") or []):
                findings.append({"type": "TOXICOLOGY", "content": f"{tox['substance']}: {tox['level']} ({tox.get('significance','unknown')})", "severity": "HIGH" if tox.get("significance") in ("toxic","lethal","suspicious") else "MODERATE", "confidence": 0.93, "agent": "autopsy"})
            if data.get("defensive_wounds"):
                findings.append({"type": "DEFENSIVE_WOUNDS", "content": "Defensive wounds present — victim resisted attacker", "severity": "CRITICAL", "confidence": 0.92, "agent": "autopsy"})
            if data.get("petechiae"):
                findings.append({"type": "ASPHYXIA_INDICATOR", "content": "Petechial hemorrhages — indicates asphyxia", "severity": "HIGH", "confidence": 0.90, "agent": "autopsy"})
            for ev in (data.get("physical_evidence") or []):
                findings.append({"type": "PHYSICAL_EVIDENCE", "content": ev, "severity": "HIGH", "confidence": 0.88, "agent": "autopsy"})

            # Pass toxicology data to ToxicologyAgent
            tox_data = [{"substance": t["substance"], "level": t["level"]} for t in (data.get("toxicology") or [])]
            return {"findings": findings, "toxicology_data": tox_data, "completed_agents": ["autopsy"]}

    except Exception as e:
        # Fallback: regex extraction
        findings = _regex_autopsy_fallback(report)
        return {"findings": findings, "errors": [f"Autopsy Gemini failed ({str(e)[:80]}), used fallback"], "completed_agents": ["autopsy"]}

    return {"findings": findings, "completed_agents": ["autopsy"]}


# ═══════════════════════════════════════════════════════════════
# AGENT 2: TIMELINE AGENT (Local — 100% deterministic)
# ═══════════════════════════════════════════════════════════════

def timeline_agent(state: ForensicState) -> dict:
    """Build chronological timeline, detect gaps and clusters. Pure math."""
    evidence = state.get("evidence", [])
    findings = []

    if len(evidence) < 2:
        return {"errors": ["Timeline: Need 2+ evidence items"], "completed_agents": ["timeline"]}

    from datetime import datetime
    sorted_ev = sorted(
        [e for e in evidence if e.get("timestamp")],
        key=lambda x: datetime.fromisoformat(x["timestamp"].replace("Z", "+00:00")) if "T" in x["timestamp"] else datetime.strptime(x["timestamp"], "%Y-%m-%d %H:%M")
    )

    # Gap detection
    for i in range(len(sorted_ev) - 1):
        t1 = _parse_time(sorted_ev[i]["timestamp"])
        t2 = _parse_time(sorted_ev[i + 1]["timestamp"])
        if t1 and t2:
            gap_min = (t2 - t1).total_seconds() / 60
            if gap_min > 30:
                sev = "CRITICAL" if gap_min > 480 else "HIGH" if gap_min > 120 else "MODERATE"
                findings.append({"type": "TIMELINE_GAP", "content": f"{int(gap_min)}min gap: \"{sorted_ev[i].get('details','')[:40]}\" → \"{sorted_ev[i+1].get('details','')[:40]}\"", "severity": sev, "confidence": 0.95, "agent": "timeline"})

    # Cluster detection
    for i in range(len(sorted_ev) - 1):
        t1 = _parse_time(sorted_ev[i]["timestamp"])
        t2 = _parse_time(sorted_ev[i + 1]["timestamp"])
        if t1 and t2:
            diff = (t2 - t1).total_seconds() / 60
            if 0 < diff <= 5 and sorted_ev[i].get("source") != sorted_ev[i + 1].get("source"):
                findings.append({"type": "EVENT_CLUSTER", "content": f"{diff:.1f}min: {sorted_ev[i].get('source','')} → {sorted_ev[i+1].get('source','')}", "severity": "HIGH", "confidence": 0.88, "agent": "timeline"})

    # Span
    if len(sorted_ev) >= 2:
        t_first = _parse_time(sorted_ev[0]["timestamp"])
        t_last = _parse_time(sorted_ev[-1]["timestamp"])
        if t_first and t_last:
            span_h = (t_last - t_first).total_seconds() / 3600
            findings.append({"type": "TIMELINE_SPAN", "content": f"{len(sorted_ev)} events over {span_h:.1f}h", "severity": "INFO", "confidence": 1.0, "agent": "timeline"})

    return {"findings": findings, "completed_agents": ["timeline"]}


# ═══════════════════════════════════════════════════════════════
# AGENT 3: CCTV AGENT (Gemini 2.5 Flash — multimodal)
# ═══════════════════════════════════════════════════════════════

def cctv_agent(state: ForensicState) -> dict:
    """Analyze CCTV frames for persons, vehicles, weapons, behavior."""
    frames = state.get("cctv_frames", [])
    findings = []

    if not frames:
        return {"errors": ["CCTV: No frames provided"], "completed_agents": ["cctv"]}

    try:
        llm = get_gemini(temperature=0.05)

        for i, frame_b64 in enumerate(frames[:8]):
            prompt = f"""Forensic CCTV analysis. Frame {i+1}/{min(len(frames),8)}.
Return ONLY valid JSON:
{{"persons":[{{"description":"","behavior":"","suspicious":"none|low|medium|high"}}],"vehicles":[{{"type":"","color":"","plate":"","speed":"normal|fast|very_fast"}}],"weapons":[{{"type":"none|handgun|knife|blunt_object","confidence":"high|medium|low"}}],"person_count":0,"suspicious_activity":null}}"""

            from langchain_core.messages import HumanMessage as HM
            msg = HM(content=[
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{frame_b64}"}},
                {"type": "text", "text": prompt},
            ])

            response = llm.invoke([msg])
            data = _safe_json(response.content)

            if data:
                for p in (data.get("persons") or []):
                    if p.get("suspicious") in ("high", "medium"):
                        findings.append({"type": "SUSPICIOUS_PERSON", "content": f"Frame {i+1}: {p.get('description','')} — {p.get('behavior','')}", "severity": "CRITICAL" if p["suspicious"] == "high" else "HIGH", "confidence": 0.85, "agent": "cctv"})

                for v in (data.get("vehicles") or []):
                    findings.append({"type": "VEHICLE_DETECTED", "content": f"Frame {i+1}: {v.get('color','')} {v.get('type','')}, plate: {v.get('plate','N/A')}, speed: {v.get('speed','')}", "severity": "HIGH" if v.get("speed") == "very_fast" else "MODERATE", "confidence": 0.87, "agent": "cctv"})

                for w in (data.get("weapons") or []):
                    if w.get("type") != "none":
                        findings.append({"type": "WEAPON_DETECTED", "content": f"Frame {i+1}: {w['type']} (confidence: {w.get('confidence','')})", "severity": "CRITICAL", "confidence": 0.9, "agent": "cctv"})

                if data.get("suspicious_activity"):
                    findings.append({"type": "SUSPICIOUS_ACTIVITY", "content": f"Frame {i+1}: {data['suspicious_activity']}", "severity": "HIGH", "confidence": 0.82, "agent": "cctv"})

                if data.get("person_count") is not None:
                    findings.append({"type": "PERSON_COUNT", "content": f"Frame {i+1}: {data['person_count']} person(s)", "severity": "INFO", "confidence": 0.9, "agent": "cctv"})

    except Exception as e:
        return {"errors": [f"CCTV Agent failed: {str(e)[:100]}"], "completed_agents": ["cctv"]}

    # Cross-frame person discrepancy
    counts = [int(f["content"].split(":")[1].strip().split(" ")[0]) for f in findings if f["type"] == "PERSON_COUNT"]
    if len(counts) >= 2 and max(counts) > min(c for c in counts if c > 0):
        findings.append({"type": "PERSON_DISCREPANCY", "content": f"Person count changed: {max(counts)} → {min(c for c in counts if c > 0)}. Someone did not exit.", "severity": "CRITICAL", "confidence": 0.91, "agent": "cctv"})

    return {"findings": findings, "completed_agents": ["cctv"]}


# ═══════════════════════════════════════════════════════════════
# AGENT 4: TOXICOLOGY AGENT (Featherless LLM)
# ═══════════════════════════════════════════════════════════════

def toxicology_agent(state: ForensicState) -> dict:
    """Deep pharmacological analysis of detected substances."""
    tox_data = state.get("toxicology_data", [])
    findings = []

    if not tox_data:
        return {"completed_agents": ["toxicology"]}

    try:
        llm = get_featherless(temperature=0.1)
        tox_list = "\n".join(f"• {t['substance']}: {t['level']}" for t in tox_data)

        prompt = f"""Forensic toxicology analysis. Substances found in autopsy:
{tox_list}

Return JSON:
{{"assessment":"overall significance","incapacitation_risk":"none|low|moderate|high","involuntary_indicators":[],"interactions":"any dangerous combinations","confidence":0.8}}"""

        response = llm.invoke([SystemMessage(content="Expert forensic toxicologist. Be precise."), HumanMessage(content=prompt)])
        data = _safe_json(response.content)

        if data:
            if data.get("assessment"):
                findings.append({"type": "TOX_ASSESSMENT", "content": data["assessment"], "severity": "HIGH", "confidence": data.get("confidence", 0.8), "agent": "toxicology"})
            if data.get("incapacitation_risk") and data["incapacitation_risk"] != "none":
                findings.append({"type": "INCAPACITATION_RISK", "content": f"Incapacitation risk: {data['incapacitation_risk']}", "severity": "CRITICAL" if data["incapacitation_risk"] in ("high","certain") else "HIGH", "confidence": 0.84, "agent": "toxicology"})
            if data.get("involuntary_indicators"):
                findings.append({"type": "INVOLUNTARY_ADMINISTRATION", "content": f"Involuntary indicators: {'; '.join(data['involuntary_indicators'])}", "severity": "CRITICAL", "confidence": 0.78, "agent": "toxicology"})

    except Exception as e:
        return {"errors": [f"Toxicology LLM failed: {str(e)[:80]}"], "completed_agents": ["toxicology"]}

    return {"findings": findings, "completed_agents": ["toxicology"]}


# ═══════════════════════════════════════════════════════════════
# AGENT 5: CORRELATION AGENT (Featherless + Local)
# ═══════════════════════════════════════════════════════════════

def correlation_agent(state: ForensicState) -> dict:
    """Find hidden connections across all evidence."""
    all_findings = state.get("findings", [])
    evidence = state.get("evidence", [])
    correlations = []

    # Local pattern correlations (deterministic)
    has = lambda t: next((f for f in all_findings if f.get("type") == t), None)
    has_content = lambda kw: next((f for f in all_findings if kw in f.get("content", "").lower()), None)

    if has("PERSON_DISCREPANCY") and has_content("disconnect"):
        correlations.append({"type": "temporal", "source": "Person discrepancy", "target": "Phone disconnection", "strength": 0.93, "description": "Victim phone silenced when suspect departed alone"})
    if has("DEFENSIVE_WOUNDS") and has("MANNER_OF_DEATH") and "homicide" in (has("MANNER_OF_DEATH") or {}).get("content", "").lower():
        correlations.append({"type": "forensic", "source": "Defensive wounds", "target": "Homicide", "strength": 0.95, "description": "Defensive wounds corroborate homicide — victim resisted"})
    if has_content("benzodiazepine") and has("DEFENSIVE_WOUNDS"):
        correlations.append({"type": "causal", "source": "Sedative", "target": "Defensive wounds", "strength": 0.82, "description": "Partial sedation + resistance = victim drugged then attacked"})
    if has_content("high speed") or has_content("very_fast"):
        rapid = has_content("high speed") or has_content("very_fast")
        if has_content("disconnect"):
            correlations.append({"type": "behavioral", "source": "Rapid departure", "target": "Comm cutoff", "strength": 0.89, "description": "Suspect fled immediately after victim incapacitated"})

    # LLM reasoning for non-obvious connections
    try:
        if len(all_findings) > 5:
            llm = get_featherless(temperature=0.2)
            summary = "\n".join(f"[{f['type']}] {f['content'][:80]}" for f in all_findings if f.get("severity") in ("CRITICAL", "HIGH"))[:15]

            response = llm.invoke([
                SystemMessage(content="Forensic correlation analyst. Find non-obvious connections. Return JSON only."),
                HumanMessage(content=f"Evidence:\n{summary}\n\nReturn: {{\"connections\":[{{\"from\":\"\",\"to\":\"\",\"type\":\"temporal|causal|behavioral\",\"strength\":0.8,\"insight\":\"\"}}],\"narrative\":\"what happened (2 sentences)\"}}")
            ])
            data = _safe_json(response.content)
            if data and data.get("connections"):
                for c in data["connections"][:5]:
                    correlations.append({"type": c.get("type", "causal"), "source": c.get("from", ""), "target": c.get("to", ""), "strength": c.get("strength", 0.8), "description": c.get("insight", "")})
    except Exception as e:
        pass  # LLM correlation is optional

    return {"correlations": correlations, "completed_agents": ["correlation"]}


# ═══════════════════════════════════════════════════════════════
# AGENT 6: EXPLAINABILITY AGENT (Featherless)
# ═══════════════════════════════════════════════════════════════

def explainability_agent(state: ForensicState) -> dict:
    """Generate SHAP-style explanation for the risk score."""
    score = state.get("risk_score", 0)
    level = state.get("risk_level", "UNKNOWN")
    factors = state.get("risk_factors", {})
    correlations = state.get("correlations", [])

    try:
        llm = get_featherless(temperature=0.2)
        factor_text = "\n".join(f"• {k}: {v}/100" for k, v in factors.items())
        corr_text = "\n".join(f"• {c['description']}" for c in correlations[:5])

        response = llm.invoke([
            SystemMessage(content="Forensic AI explainability specialist. Use court-appropriate language: 'consistent with', 'suggests', 'indicates'. Never state certainty."),
            HumanMessage(content=f"Risk Score: {score}/100 ({level})\n\nFactors:\n{factor_text}\n\nCorrelations:\n{corr_text}\n\nGenerate structured explanation with: (1) score meaning, (2) top factors, (3) correlations, (4) limitations, (5) recommended actions.")
        ])
        return {"explanation": response.content, "completed_agents": ["explainability"]}
    except Exception as e:
        fallback = f"## Risk: {score}/100 ({level})\n\nFactors: {json.dumps(factors)}\n\n*Configure LLM for detailed explanation.*"
        return {"explanation": fallback, "errors": [f"Explain LLM failed: {str(e)[:60]}"], "completed_agents": ["explainability"]}


# ═══════════════════════════════════════════════════════════════
# AGENT 7: RISK AGENT (100% DETERMINISTIC — zero AI)
# ═══════════════════════════════════════════════════════════════

def risk_agent(state: ForensicState) -> dict:
    """Deterministic risk scoring. Same input = same output ALWAYS."""
    all_findings = state.get("findings", [])

    WEIGHTS = {"violence": 0.25, "manner": 0.15, "toxicology": 0.10, "digital": 0.20, "gaps": 0.15, "temporal": 0.15}
    factors = {}

    # Violence
    crit_inj = sum(1 for f in all_findings if f.get("type") == "INJURY" and f.get("severity") == "CRITICAL")
    high_inj = sum(1 for f in all_findings if f.get("type") == "INJURY" and f.get("severity") == "HIGH")
    defensive = any(f.get("type") == "DEFENSIVE_WOUNDS" for f in all_findings)
    weapon = any(f.get("type") == "WEAPON_DETECTED" for f in all_findings)
    factors["violence"] = min(100, crit_inj * 25 + high_inj * 12 + (20 if defensive else 0) + (25 if weapon else 0) + 10)

    # Manner
    manner = next((f["content"].lower() for f in all_findings if f.get("type") == "MANNER_OF_DEATH"), "")
    factors["manner"] = 95 if "homicide" in manner else 70 if "undetermined" in manner else 55 if "suicide" in manner else 30 if "accident" in manner else 50

    # Toxicology
    incap = any(f.get("type") in ("INCAPACITATION_RISK", "INVOLUNTARY_ADMINISTRATION") for f in all_findings)
    tox_count = sum(1 for f in all_findings if "TOX" in f.get("type", ""))
    factors["toxicology"] = min(100, tox_count * 12 + (40 if incap else 0))

    # Digital
    disc = sum(1 for f in all_findings if f.get("type") == "PERSON_DISCREPANCY")
    rapid = sum(1 for f in all_findings if "speed" in f.get("content", "").lower() or "rapidly" in f.get("content", "").lower())
    factors["digital"] = min(100, disc * 35 + rapid * 20 + 5)

    # Gaps
    gap_critical = sum(1 for f in all_findings if f.get("type") == "TIMELINE_GAP" and f.get("severity") in ("CRITICAL", "HIGH"))
    factors["gaps"] = min(100, gap_critical * 25 + 10)

    # Temporal
    clusters = sum(1 for f in all_findings if f.get("type") == "EVENT_CLUSTER")
    factors["temporal"] = min(100, clusters * 20 + 10)

    # Weighted sum
    score = round(sum(factors[k] * WEIGHTS[k] for k in WEIGHTS), 1)
    level = "CRITICAL" if score >= 80 else "HIGH" if score >= 60 else "MODERATE" if score >= 40 else "LOW"

    # Anomalies
    anomaly_findings = []
    if defensive and "homicide" not in manner and manner:
        anomaly_findings.append({"type": "ANOMALY", "content": "Defensive wounds + non-homicide manner = CONTRADICTION", "severity": "CRITICAL", "confidence": 0.95, "agent": "risk"})

    return {"risk_score": score, "risk_level": level, "risk_factors": factors, "findings": anomaly_findings, "completed_agents": ["risk"]}


# ═══════════════════════════════════════════════════════════════
# AGENT 8: LEAD GENERATION (Post-analysis)
# ═══════════════════════════════════════════════════════════════

def lead_generator(state: ForensicState) -> dict:
    """Generate investigative leads from all findings."""
    findings = state.get("findings", [])
    correlations = state.get("correlations", [])
    leads = []

    if any(f.get("type") == "PERSON_DISCREPANCY" for f in findings):
        leads.append("🔴 Identify departing individual from CCTV — facial recognition needed")
    if any(f.get("type") == "DEFENSIVE_WOUNDS" for f in findings):
        leads.append("🔴 Submit fingernail DNA for CODIS search — direct suspect ID")
    if any(f.get("type") == "VEHICLE_DETECTED" for f in findings):
        leads.append("🟡 Run license plate through ANPR database")
    if any("benzodiazepine" in f.get("content", "").lower() for f in findings):
        leads.append("🟡 Check victim prescription records for sedative source")
    if any(f.get("type") == "WEAPON_DETECTED" for f in findings):
        leads.append("🔴 Match CCTV weapon to injury patterns")
    if correlations:
        leads.append("🔴 Focus on critical timeframe where all evidence converges")

    return {"investigative_leads": leads, "completed_agents": ["leads"]}


# ═══════════════════════════════════════════════════════════════
# HUMAN-IN-THE-LOOP: Review high-risk decisions
# ═══════════════════════════════════════════════════════════════

def human_review_node(state: ForensicState) -> dict:
    """Pause for human approval on high-risk cases."""
    score = state.get("risk_score", 0)
    if score >= 75:
        decision = interrupt({
            "message": f"⚠️ HIGH RISK CASE (Score: {score}/100). Approve escalation to senior team?",
            "risk_score": score,
            "risk_level": state.get("risk_level"),
            "top_findings": [f["content"][:80] for f in state.get("findings", []) if f.get("severity") == "CRITICAL"][:5],
        })
        return {"human_decision": decision}
    return {"human_decision": "auto_approved"}


# ═══════════════════════════════════════════════════════════════
# ROUTING LOGIC
# ═══════════════════════════════════════════════════════════════

def route_after_risk(state: ForensicState) -> str:
    """After risk scoring, check if human review needed."""
    if state.get("risk_score", 0) >= 75:
        return "human_review"
    return "explainability"


# ═══════════════════════════════════════════════════════════════
# PARALLEL FAN-OUT (Phase 1)
# ═══════════════════════════════════════════════════════════════

def phase1_fanout(state: ForensicState) -> list[Send]:
    """Run Autopsy + Timeline + CCTV in parallel for every investigation."""
    return [
        Send("autopsy", state),
        Send("timeline", state),
        Send("cctv", state),
    ]


# ═══════════════════════════════════════════════════════════════
# BUILD THE GRAPH
# ═══════════════════════════════════════════════════════════════

def build_forensic_graph():
    """Construct the LangGraph StateGraph with all agents."""
    builder = StateGraph(ForensicState)

    # Add all agent nodes
    builder.add_node("autopsy", autopsy_agent)
    builder.add_node("timeline", timeline_agent)
    builder.add_node("cctv", cctv_agent)
    builder.add_node("toxicology", toxicology_agent)
    builder.add_node("correlation", correlation_agent)
    builder.add_node("risk", risk_agent)
    builder.add_node("human_review", human_review_node)
    builder.add_node("explainability", explainability_agent)
    builder.add_node("leads", lead_generator)
    builder.add_node("phase1_join", lambda state: {"phase": "phase1_done"})

    # START → Parallel fan-out (Autopsy + Timeline + CCTV)
    builder.add_conditional_edges(START, phase1_fanout)

    # All Phase 1 agents → join node
    builder.add_edge("autopsy", "phase1_join")
    builder.add_edge("timeline", "phase1_join")
    builder.add_edge("cctv", "phase1_join")

    # Join → Toxicology → Correlation
    builder.add_edge("phase1_join", "toxicology")
    builder.add_edge("toxicology", "correlation")

    # Correlation → Risk
    builder.add_edge("correlation", "risk")

    # Risk → conditional: human review (if high) or explainability
    builder.add_conditional_edges("risk", route_after_risk, {
        "human_review": "human_review",
        "explainability": "explainability",
    })

    # Human review → Explainability
    builder.add_edge("human_review", "explainability")

    # Explainability → Leads → END
    builder.add_edge("explainability", "leads")
    builder.add_edge("leads", END)

    # Compile with checkpointer for HITL
    graph = builder.compile(checkpointer=MemorySaver())
    return graph


# ═══════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════

def _safe_json(text: str) -> dict | None:
    """Robustly parse JSON from LLM output."""
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to extract from markdown code blocks
        import re
        match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except:
                pass
        # Try to find JSON object
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            try:
                return json.loads(match.group(0))
            except:
                pass
    return None


def _parse_time(ts: str):
    """Parse various timestamp formats."""
    from datetime import datetime
    formats = ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"]
    for fmt in formats:
        try:
            return datetime.strptime(ts.replace("Z", "").split("+")[0].split(".")[0], fmt)
        except:
            continue
    return None


def _regex_autopsy_fallback(text: str) -> list[dict]:
    """Regex fallback when Gemini is unavailable."""
    import re
    findings = []
    patterns = [
        (r"cause\s+of\s+death[:\s]*([^\n.]{5,120})", "CAUSE_OF_DEATH", "CRITICAL"),
        (r"manner\s+of\s+death[:\s]*(homicide|suicide|accident\w*|natural|undetermined)", "MANNER_OF_DEATH", "CRITICAL"),
        (r"(blunt\s+force\s+trauma[^\n.,]{0,60})", "INJURY", "HIGH"),
        (r"(defensive\s+wounds?[^\n.,]{0,60})", "DEFENSIVE_WOUNDS", "CRITICAL"),
        (r"(ligature\s+mark[^\n.,]{0,60})", "INJURY", "HIGH"),
        (r"(petechial\s+hemorrhages?[^\n.,]{0,40})", "ASPHYXIA_INDICATOR", "HIGH"),
        (r"(subdural\s+hematoma[^\n.,]{0,40})", "INJURY", "HIGH"),
        (r"(blood\s+alcohol[:\s]*[\d.]+\s*g/dL)", "TOXICOLOGY", "MODERATE"),
        (r"(benzodiazepines?[:\s]*[^\n.,]{0,40})", "TOXICOLOGY", "HIGH"),
    ]
    seen = set()
    for pattern, ftype, severity in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            content = (match.group(1) if match.lastindex else match.group(0)).strip()
            if content.lower() not in seen and len(content) > 3:
                seen.add(content.lower())
                findings.append({"type": ftype, "content": content, "severity": severity, "confidence": 0.75, "agent": "autopsy-fallback"})
    return findings


# ═══════════════════════════════════════════════════════════════
# SINGLETON GRAPH INSTANCE
# ═══════════════════════════════════════════════════════════════

graph = build_forensic_graph()

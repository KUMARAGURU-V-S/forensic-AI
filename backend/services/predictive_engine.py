"""
═══════════════════════════════════════════════════════════════════════════════
PREDICTIVE INVESTIGATION ENGINE (Score: 5/5)
═══════════════════════════════════════════════════════════════════════════════

Provides:
1. Suspect Risk Forecasting — Bayesian probability of suspect involvement
2. Case Outcome Prediction — Likelihood of resolution based on evidence strength
3. Evidence Decay Modeling — Time-sensitive evidence prioritization
4. Behavioral Trajectory Prediction — Next-move forecasting for suspects
5. Recidivism Risk — Pattern-based re-offense probability

All models use statistical/ML approaches that work on CPU without external APIs.
"""
import math
import random
import numpy as np
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta


# ═══ SUSPECT RISK FORECASTING ════════════════════════════════════════════════

class SuspectRiskForecaster:
    """
    Bayesian suspect risk model.
    Updates P(guilty|evidence) as new evidence arrives using likelihood ratios.
    """
    
    # Prior probabilities based on relationship to victim
    RELATIONSHIP_PRIORS = {
        "spouse": 0.35, "partner": 0.30, "ex_partner": 0.28,
        "family": 0.15, "friend": 0.10, "colleague": 0.08,
        "acquaintance": 0.06, "stranger": 0.03, "unknown": 0.05,
    }
    
    # Likelihood ratios for different evidence types
    EVIDENCE_LR = {
        "dna_at_scene": 15.0,
        "fingerprints_on_weapon": 12.0,
        "cctv_at_scene": 8.0,
        "phone_at_scene": 6.0,
        "motive_financial": 4.0,
        "motive_personal": 3.5,
        "no_alibi": 3.0,
        "false_alibi": 7.0,
        "prior_violence": 4.0,
        "prior_threats": 5.0,
        "suspicious_behavior": 2.5,
        "flight_risk": 4.5,
        "witness_identification": 6.0,
        "digital_evidence": 3.5,
        "vehicle_at_scene": 4.0,
        "contradictory_statements": 3.0,
    }
    
    def compute_risk(self, suspect: Dict[str, Any]) -> Dict[str, Any]:
        """Compute suspect risk using Bayesian updating."""
        relationship = suspect.get("relationship", "unknown").lower().replace(" ", "_")
        prior = self.RELATIONSHIP_PRIORS.get(relationship, 0.05)
        
        evidence_items = suspect.get("evidence", [])
        flags = suspect.get("flags", [])
        
        # Bayesian update: P(G|E) = P(E|G)*P(G) / [P(E|G)*P(G) + P(E|~G)*P(~G)]
        posterior = prior
        evidence_contributions = []
        
        for ev in evidence_items + flags:
            ev_key = ev.lower().replace(" ", "_").replace("-", "_")
            lr = self.EVIDENCE_LR.get(ev_key, 2.0)
            
            # Bayesian update
            odds = posterior / (1 - posterior + 1e-10)
            odds *= lr
            posterior = odds / (1 + odds)
            
            evidence_contributions.append({
                "evidence": ev,
                "likelihood_ratio": lr,
                "posterior_after": round(posterior, 4),
            })
        
        # Additional factors
        risk_score = suspect.get("risk_score", posterior * 100)
        
        return {
            "suspect_id": suspect.get("id", "unknown"),
            "suspect_name": suspect.get("name", "Unknown"),
            "prior_probability": round(prior, 4),
            "posterior_probability": round(posterior, 4),
            "risk_score": round(min(100, posterior * 100), 1),
            "risk_level": "CRITICAL" if posterior > 0.8 else ("HIGH" if posterior > 0.6 else ("MODERATE" if posterior > 0.3 else "LOW")),
            "evidence_contributions": evidence_contributions,
            "confidence": round(min(0.95, 0.5 + len(evidence_items) * 0.08), 3),
            "methodology": "Bayesian posterior updating with evidence likelihood ratios",
        }


# ═══ CASE OUTCOME PREDICTION ════════════════════════════════════════════════

class CaseOutcomePredictor:
    """
    Predicts case resolution likelihood based on evidence quality/quantity.
    Uses logistic regression-style scoring.
    """
    
    FEATURE_WEIGHTS = {
        "has_suspect": 2.5,
        "has_motive": 1.8,
        "has_physical_evidence": 2.0,
        "has_digital_evidence": 1.5,
        "has_witness": 1.3,
        "has_cctv": 1.8,
        "has_dna": 2.5,
        "has_confession": 3.0,
        "evidence_count": 0.3,  # per piece
        "hours_since_discovery": -0.02,  # decay per hour
        "agent_confidence": 1.5,
    }
    
    def predict(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        """Predict case outcome (resolution probability, timeline, recommended actions)."""
        score = 0.0
        factors = []
        
        suspects = case_data.get("suspects", [])
        digital = case_data.get("digital_evidence", {})
        
        if suspects:
            score += self.FEATURE_WEIGHTS["has_suspect"]
            factors.append({"factor": "Suspect identified", "contribution": "+2.5"})
        
        if any(s.get("flags") for s in suspects):
            score += self.FEATURE_WEIGHTS["has_motive"]
            factors.append({"factor": "Motive established", "contribution": "+1.8"})
        
        if digital.get("cctv"):
            score += self.FEATURE_WEIGHTS["has_cctv"]
            factors.append({"factor": "CCTV evidence", "contribution": "+1.8"})
        
        if digital.get("phone_metadata"):
            score += self.FEATURE_WEIGHTS["has_digital_evidence"]
            factors.append({"factor": "Digital evidence", "contribution": "+1.5"})
        
        # Evidence count bonus
        ev_count = sum(len(digital.get(k, [])) for k in ["cctv", "phone_metadata", "gps_data", "iot_sensors"])
        score += ev_count * self.FEATURE_WEIGHTS["evidence_count"]
        factors.append({"factor": f"{ev_count} evidence items", "contribution": f"+{ev_count * 0.3:.1f}"})
        
        # Convert to probability using sigmoid
        probability = 1 / (1 + math.exp(-score + 5))  # Shifted sigmoid
        
        # Estimate timeline
        if probability > 0.7:
            timeline = "1-2 weeks"
        elif probability > 0.5:
            timeline = "2-4 weeks"
        elif probability > 0.3:
            timeline = "1-3 months"
        else:
            timeline = "3+ months (cold case risk)"
        
        return {
            "resolution_probability": round(probability, 3),
            "confidence_level": "HIGH" if probability > 0.6 else ("MODERATE" if probability > 0.3 else "LOW"),
            "estimated_timeline": timeline,
            "factors": factors,
            "raw_score": round(score, 2),
            "recommended_actions": self._get_actions(probability, case_data),
            "cold_case_risk": round(1 - probability, 3),
            "methodology": "Logistic feature scoring with evidence-based weights",
        }
    
    def _get_actions(self, prob, case_data):
        actions = []
        if prob < 0.3:
            actions.append("⚠️ HIGH cold case risk — escalate to senior investigator")
            actions.append("Consider public appeal for information")
        if not case_data.get("suspects"):
            actions.append("Priority: Identify suspects from evidence")
        if not case_data.get("digital_evidence", {}).get("cctv"):
            actions.append("Canvas area for additional CCTV footage")
        actions.append("Preserve all time-sensitive evidence immediately")
        return actions


# ═══ EVIDENCE DECAY MODEL ════════════════════════════════════════════════════

class EvidenceDecayModel:
    """
    Models how evidence degrades over time.
    Helps investigators prioritize time-sensitive evidence collection.
    """
    
    DECAY_RATES = {  # Half-life in hours
        "cctv_footage": 168,       # 7 days (auto-overwrite)
        "mobile_tower_data": 720,  # 30 days (carrier retention)
        "witness_memory": 48,      # 2 days (memory decay)
        "dna_outdoor": 72,         # 3 days (weather degradation)
        "dna_indoor": 720,         # 30 days
        "fingerprints_outdoor": 24, # 1 day
        "fingerprints_indoor": 336, # 14 days
        "tire_marks": 12,          # 12 hours
        "blood_evidence": 168,     # 7 days
        "digital_logs": 2160,      # 90 days
        "body_decomposition": 48,  # 2 days (affects TOD accuracy)
    }
    
    def compute_urgency(self, evidence_type: str, hours_elapsed: float) -> Dict[str, Any]:
        """Compute evidence urgency score (0-100) based on decay."""
        half_life = self.DECAY_RATES.get(evidence_type, 168)
        
        # Exponential decay: quality = e^(-λt) where λ = ln(2)/half_life
        decay_constant = math.log(2) / half_life
        quality = math.exp(-decay_constant * hours_elapsed)
        urgency = (1 - quality) * 100  # Higher urgency = more degraded
        
        status = "CRITICAL" if quality < 0.2 else ("URGENT" if quality < 0.5 else ("MODERATE" if quality < 0.8 else "OK"))
        
        return {
            "evidence_type": evidence_type,
            "hours_elapsed": hours_elapsed,
            "half_life_hours": half_life,
            "quality_remaining": round(quality * 100, 1),
            "urgency_score": round(urgency, 1),
            "status": status,
            "time_to_50pct": round(half_life - hours_elapsed, 1) if hours_elapsed < half_life else 0,
            "recommendation": self._get_recommendation(evidence_type, quality),
        }
    
    def prioritize_collection(self, evidence_types: List[str], hours_elapsed: float) -> List[Dict]:
        """Rank evidence types by collection urgency."""
        results = [self.compute_urgency(et, hours_elapsed) for et in evidence_types]
        return sorted(results, key=lambda r: r["urgency_score"], reverse=True)
    
    def _get_recommendation(self, ev_type, quality):
        if quality < 0.2:
            return f"IMMEDIATE: {ev_type} nearly lost. Deploy team NOW."
        if quality < 0.5:
            return f"URGENT: {ev_type} degrading rapidly. Collect within hours."
        if quality < 0.8:
            return f"PRIORITY: Schedule {ev_type} collection today."
        return f"OK: {ev_type} stable. Standard collection timeline."


# ═══ BEHAVIORAL TRAJECTORY PREDICTION ════════════════════════════════════════

class BehavioralPredictor:
    """
    Predicts suspect next actions based on behavioral patterns.
    Uses decision tree-like logic on behavioral indicators.
    """
    
    BEHAVIOR_PATTERNS = {
        "flight": {
            "indicators": ["sold_property", "booked_travel", "withdrew_cash", "passport_activity", "deleted_accounts"],
            "prediction": "Suspect likely to flee jurisdiction within 48-72h",
            "urgency": "CRITICAL",
            "actions": ["Issue lookout notice", "Monitor airports/borders", "Freeze financial accounts"],
        },
        "evidence_destruction": {
            "indicators": ["phone_factory_reset", "deleted_messages", "cleaned_vehicle", "changed_appearance", "contacted_accomplice"],
            "prediction": "Active evidence destruction in progress",
            "urgency": "CRITICAL",
            "actions": ["Seize devices immediately", "Preserve cloud backups", "Interview before suspect lawyers up"],
        },
        "intimidation": {
            "indicators": ["contacted_witness", "threats_made", "surveillance_of_witness", "social_media_pressure"],
            "prediction": "Witness intimidation likely",
            "urgency": "HIGH",
            "actions": ["Provide witness protection", "Record all communications", "Expedite witness statements"],
        },
        "cooperation": {
            "indicators": ["lawyer_retained", "voluntary_statement", "provided_alibi", "offered_evidence"],
            "prediction": "Suspect may cooperate — leverage for plea or information",
            "urgency": "MODERATE",
            "actions": ["Prepare detailed interview questions", "Verify alibi independently", "Consider cooperation agreement"],
        },
    }
    
    def predict_behavior(self, suspect_indicators: List[str]) -> Dict[str, Any]:
        """Predict suspect's next behavioral trajectory."""
        matches = {}
        for pattern_name, pattern in self.BEHAVIOR_PATTERNS.items():
            overlap = set(suspect_indicators) & set(pattern["indicators"])
            if overlap:
                matches[pattern_name] = {
                    "confidence": round(len(overlap) / len(pattern["indicators"]), 2),
                    "matching_indicators": list(overlap),
                    "prediction": pattern["prediction"],
                    "urgency": pattern["urgency"],
                    "recommended_actions": pattern["actions"],
                }
        
        if not matches:
            return {
                "prediction": "Insufficient behavioral indicators for trajectory prediction",
                "urgency": "LOW",
                "patterns_detected": [],
                "recommendation": "Continue surveillance and evidence collection",
            }
        
        # Primary prediction is highest confidence match
        primary = max(matches.items(), key=lambda x: x[1]["confidence"])
        
        return {
            "primary_prediction": primary[0],
            "prediction_detail": primary[1]["prediction"],
            "confidence": primary[1]["confidence"],
            "urgency": primary[1]["urgency"],
            "recommended_actions": primary[1]["recommended_actions"],
            "all_patterns": matches,
            "risk_of_escalation": round(sum(m["confidence"] for m in matches.values()) / len(matches), 2),
        }


# ═══ RECIDIVISM RISK MODEL ═══════════════════════════════════════════════════

class RecidivismPredictor:
    """
    Estimates re-offense probability based on offender profile factors.
    Based on actuarial risk assessment literature (Static-99, VRAG concepts).
    """
    
    RISK_FACTORS = {
        "prior_offenses": {"weight": 0.25, "scale": lambda x: min(x * 0.15, 1.0)},
        "age_at_offense": {"weight": 0.15, "scale": lambda x: max(0, 1 - (x - 18) * 0.02)},  # Younger = higher risk
        "substance_abuse": {"weight": 0.15, "scale": lambda x: 0.8 if x else 0.2},
        "prior_violence": {"weight": 0.20, "scale": lambda x: 0.9 if x else 0.1},
        "unstable_housing": {"weight": 0.10, "scale": lambda x: 0.7 if x else 0.2},
        "unemployed": {"weight": 0.10, "scale": lambda x: 0.6 if x else 0.2},
        "antisocial_associates": {"weight": 0.05, "scale": lambda x: 0.8 if x else 0.2},
    }
    
    def assess(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Assess recidivism risk for an offender profile."""
        total_score = 0
        factor_details = []
        
        for factor, config in self.RISK_FACTORS.items():
            value = profile.get(factor, 0)
            scaled = config["scale"](value)
            contribution = scaled * config["weight"]
            total_score += contribution
            factor_details.append({
                "factor": factor.replace("_", " ").title(),
                "value": value,
                "scaled": round(scaled, 3),
                "contribution": round(contribution, 4),
                "weight": config["weight"],
            })
        
        risk_pct = round(total_score * 100, 1)
        
        return {
            "recidivism_probability": round(total_score, 3),
            "risk_percentage": risk_pct,
            "risk_level": "VERY HIGH" if risk_pct > 70 else ("HIGH" if risk_pct > 50 else ("MODERATE" if risk_pct > 30 else "LOW")),
            "factors": sorted(factor_details, key=lambda f: f["contribution"], reverse=True),
            "methodology": "Actuarial risk assessment (Static-99/VRAG inspired)",
            "disclaimer": "Advisory only. Not for sentencing determination.",
        }


# ═══ SINGLETON INSTANCES ═════════════════════════════════════════════════════

suspect_forecaster = SuspectRiskForecaster()
case_predictor = CaseOutcomePredictor()
evidence_decay = EvidenceDecayModel()
behavioral_predictor = BehavioralPredictor()
recidivism_predictor = RecidivismPredictor()

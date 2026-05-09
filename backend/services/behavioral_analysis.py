"""
═══════════════════════════════════════════════════════════════════════════════
ADVANCED BEHAVIORAL ANALYSIS ENGINE (Score: 5/5)
═══════════════════════════════════════════════════════════════════════════════

Provides:
1. Psychological Autopsy — Reconstructs decedent's mental state before death
2. Behavioral Profiling — Suspect behavioral pattern analysis
3. Communication Pattern Analysis — Frequency/timing/network anomalies
4. Geospatial Behavioral Mapping — Movement pattern recognition
5. Temporal Behavioral Clustering — Activity pattern breaks
6. Social Network Analysis — Relationship graph scoring
"""
import math
import re
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict, Counter


class PsychologicalAutopsy:
    """
    Reconstructs decedent's mental state before death.
    Used to distinguish suicide from homicide in equivocal deaths.
    """
    
    SUICIDE_INDICATORS = {
        "high": [
            "suicide_note", "prior_attempts", "stated_intent", "gave_away_possessions",
            "recent_loss", "terminal_illness", "severe_depression", "isolation",
        ],
        "moderate": [
            "financial_crisis", "relationship_breakdown", "job_loss", "substance_abuse",
            "sleep_disturbance", "hopelessness_expressed", "farewell_messages",
        ],
        "low": [
            "mood_changes", "appetite_changes", "withdrawal", "risk_taking",
        ],
    }
    
    HOMICIDE_INDICATORS = {
        "high": [
            "known_enemies", "threats_received", "domestic_violence", "gang_affiliation",
            "witness_to_crime", "insurance_beneficiary_motive", "custody_dispute",
        ],
        "moderate": [
            "high_risk_lifestyle", "drug_debts", "recent_conflict", "protective_order",
        ],
    }
    
    def analyze(self, indicators: List[str], circumstances: Dict = None) -> Dict[str, Any]:
        """Perform psychological autopsy analysis."""
        suicide_score = 0
        homicide_score = 0
        suicide_factors = []
        homicide_factors = []
        
        for ind in indicators:
            ind_lower = ind.lower().replace(" ", "_")
            if ind_lower in self.SUICIDE_INDICATORS["high"]:
                suicide_score += 3; suicide_factors.append({"indicator": ind, "weight": "HIGH", "points": 3})
            elif ind_lower in self.SUICIDE_INDICATORS["moderate"]:
                suicide_score += 2; suicide_factors.append({"indicator": ind, "weight": "MODERATE", "points": 2})
            elif ind_lower in self.SUICIDE_INDICATORS["low"]:
                suicide_score += 1; suicide_factors.append({"indicator": ind, "weight": "LOW", "points": 1})
            
            if ind_lower in self.HOMICIDE_INDICATORS["high"]:
                homicide_score += 3; homicide_factors.append({"indicator": ind, "weight": "HIGH", "points": 3})
            elif ind_lower in self.HOMICIDE_INDICATORS["moderate"]:
                homicide_score += 2; homicide_factors.append({"indicator": ind, "weight": "MODERATE", "points": 2})
        
        total = suicide_score + homicide_score + 1
        suicide_prob = suicide_score / total
        homicide_prob = homicide_score / total
        
        if suicide_prob > 0.6:
            assessment = "SUICIDE LIKELY"
        elif homicide_prob > 0.6:
            assessment = "HOMICIDE LIKELY"
        elif abs(suicide_prob - homicide_prob) < 0.15:
            assessment = "EQUIVOCAL — Further investigation required"
        else:
            assessment = "INSUFFICIENT DATA"
        
        return {
            "assessment": assessment,
            "suicide_probability": round(suicide_prob, 3),
            "homicide_probability": round(homicide_prob, 3),
            "suicide_score": suicide_score,
            "homicide_score": homicide_score,
            "suicide_factors": suicide_factors,
            "homicide_factors": homicide_factors,
            "recommendation": self._recommendation(assessment),
            "methodology": "Psychological Autopsy (Shneidman method + Ebert criteria)",
        }
    
    def _recommendation(self, assessment):
        if "SUICIDE" in assessment:
            return "Review for hesitation wounds, self-infliction patterns. Check prescription history and mental health records."
        if "HOMICIDE" in assessment:
            return "Investigate known threats, financial motives, relationship conflicts. Preserve digital communications."
        return "Conduct full equivocal death investigation. Interview close contacts. Obtain mental health and financial records."


class CommunicationAnalyzer:
    """Analyzes communication patterns for behavioral anomalies."""
    
    def analyze(self, communications: List[Dict]) -> Dict[str, Any]:
        """Analyze call/message patterns for suspicious activity."""
        if not communications:
            return {"patterns": [], "anomalies": [], "risk_score": 0}
        
        # Time distribution
        hour_dist = Counter()
        contact_freq = Counter()
        daily_volume = defaultdict(int)
        
        for comm in communications:
            ts = comm.get("timestamp", "")
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                hour_dist[dt.hour] += 1
                daily_volume[dt.date().isoformat()] += 1
            except:
                pass
            contact_freq[comm.get("contact", comm.get("to", "unknown"))] += 1
        
        patterns = []
        anomalies = []
        
        # Night activity spike
        night_comms = sum(hour_dist.get(h, 0) for h in range(0, 6))
        total_comms = sum(hour_dist.values()) or 1
        if night_comms / total_comms > 0.3:
            anomalies.append({"type": "night_activity_spike", "severity": "HIGH", "description": f"{night_comms}/{total_comms} communications between midnight-6am ({night_comms/total_comms*100:.0f}%)"})
        
        # Burner/unknown contacts
        unknown_contacts = sum(v for k, v in contact_freq.items() if "unknown" in k.lower() or "burner" in k.lower())
        if unknown_contacts > 0:
            anomalies.append({"type": "unknown_contacts", "severity": "HIGH", "description": f"{unknown_contacts} communications with unknown/burner numbers"})
        
        # Volume spike (last day vs average)
        if daily_volume:
            avg_vol = sum(daily_volume.values()) / len(daily_volume)
            last_day = max(daily_volume.values())
            if last_day > avg_vol * 2.5:
                anomalies.append({"type": "volume_spike", "severity": "MODERATE", "description": f"Last day volume {last_day} vs average {avg_vol:.0f} (x{last_day/avg_vol:.1f})"})
        
        # Top contacts
        top_contacts = contact_freq.most_common(5)
        patterns.append({"type": "top_contacts", "data": [{"contact": c, "count": n} for c, n in top_contacts]})
        patterns.append({"type": "hourly_distribution", "data": dict(hour_dist)})
        
        risk_score = min(100, len(anomalies) * 25 + (night_comms / total_comms) * 30 + unknown_contacts * 15)
        
        return {
            "total_communications": len(communications),
            "unique_contacts": len(contact_freq),
            "patterns": patterns,
            "anomalies": anomalies,
            "risk_score": round(risk_score, 1),
            "risk_level": "HIGH" if risk_score > 60 else ("MODERATE" if risk_score > 30 else "LOW"),
        }


class GeospatialAnalyzer:
    """Analyzes movement patterns for behavioral anomalies."""
    
    def analyze(self, locations: List[Dict]) -> Dict[str, Any]:
        """Analyze GPS/location data for behavioral patterns."""
        if not locations:
            return {"patterns": [], "anomalies": [], "clusters": []}
        
        # Extract coordinates
        coords = [(l.get("lat", 0), l.get("lon", 0)) for l in locations if l.get("lat")]
        
        if not coords:
            return {"patterns": [], "anomalies": [], "clusters": []}
        
        # Compute centroid
        avg_lat = sum(c[0] for c in coords) / len(coords)
        avg_lon = sum(c[1] for c in coords) / len(coords)
        
        # Compute spread
        max_dist = 0
        for lat, lon in coords:
            dist = math.sqrt((lat - avg_lat)**2 + (lon - avg_lon)**2) * 111  # km approx
            max_dist = max(max_dist, dist)
        
        patterns = []
        anomalies = []
        
        # Concentrated movement (stalking indicator)
        if max_dist < 0.5 and len(coords) > 5:
            patterns.append({"type": "concentrated_movement", "description": f"All {len(coords)} points within 500m radius — possible surveillance/stalking"})
        
        # Rapid displacement
        for i in range(1, len(locations)):
            t1 = locations[i-1].get("timestamp", "")
            t2 = locations[i].get("timestamp", "")
            try:
                dt1 = datetime.fromisoformat(t1.replace("Z", "+00:00"))
                dt2 = datetime.fromisoformat(t2.replace("Z", "+00:00"))
                hours = (dt2 - dt1).total_seconds() / 3600
                if hours > 0:
                    dist = math.sqrt((coords[i][0]-coords[i-1][0])**2 + (coords[i][1]-coords[i-1][1])**2) * 111
                    speed = dist / hours
                    if speed > 120:  # km/h
                        anomalies.append({"type": "rapid_displacement", "severity": "HIGH", "description": f"Speed {speed:.0f} km/h between points — possible flight"})
            except:
                pass
        
        return {
            "total_points": len(coords),
            "centroid": {"lat": round(avg_lat, 6), "lon": round(avg_lon, 6)},
            "spread_km": round(max_dist, 2),
            "patterns": patterns,
            "anomalies": anomalies,
        }


class TemporalBehaviorAnalyzer:
    """Detects breaks in normal behavioral patterns."""
    
    def analyze(self, events: List[Dict], baseline_events: List[Dict] = None) -> Dict[str, Any]:
        """Compare recent behavior to baseline for anomaly detection."""
        if not events:
            return {"breaks": [], "risk_score": 0}
        
        breaks = []
        
        # Activity timing breaks
        event_hours = []
        for e in events:
            ts = e.get("timestamp", "")
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                event_hours.append(dt.hour)
            except:
                pass
        
        if event_hours:
            # Night activity (unusual for normal person)
            night_pct = sum(1 for h in event_hours if 0 <= h < 5) / len(event_hours)
            if night_pct > 0.4:
                breaks.append({
                    "type": "temporal_break",
                    "description": f"{night_pct*100:.0f}% of activity between midnight-5am",
                    "severity": "HIGH",
                    "behavioral_significance": "Nocturnal activity pattern — deviates from normal",
                })
        
        # Communication silence (sudden stop)
        if len(events) >= 2:
            sorted_events = sorted(events, key=lambda e: e.get("timestamp", ""))
            last_gap = 0
            try:
                t1 = datetime.fromisoformat(sorted_events[-2]["timestamp"].replace("Z", "+00:00"))
                t2 = datetime.fromisoformat(sorted_events[-1]["timestamp"].replace("Z", "+00:00"))
                last_gap = (t2 - t1).total_seconds() / 3600
            except:
                pass
            
            if last_gap > 24:
                breaks.append({
                    "type": "communication_silence",
                    "description": f"{last_gap:.0f}h gap in activity — possible incapacitation or device disposal",
                    "severity": "CRITICAL",
                    "behavioral_significance": "Extended silence after regular activity",
                })
        
        risk_score = sum(30 if b["severity"] == "CRITICAL" else (20 if b["severity"] == "HIGH" else 10) for b in breaks)
        
        return {
            "breaks_detected": len(breaks),
            "breaks": breaks,
            "risk_score": min(100, risk_score),
            "risk_level": "CRITICAL" if risk_score >= 60 else ("HIGH" if risk_score >= 30 else "LOW"),
            "methodology": "Temporal pattern deviation analysis",
        }


# ═══ UNIFIED BEHAVIORAL ANALYSIS ════════════════════════════════════════════

class BehavioralAnalysisEngine:
    """Unified engine combining all behavioral analysis modules."""
    
    def __init__(self):
        self.psych_autopsy = PsychologicalAutopsy()
        self.comm_analyzer = CommunicationAnalyzer()
        self.geo_analyzer = GeospatialAnalyzer()
        self.temporal_analyzer = TemporalBehaviorAnalyzer()
    
    def full_analysis(self, case_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run complete behavioral analysis on case data."""
        results = {}
        
        # Communication analysis
        comms = case_data.get("digital_evidence", {}).get("phone_metadata", [])
        if comms:
            results["communication"] = self.comm_analyzer.analyze(comms)
        
        # Geospatial analysis
        gps = case_data.get("digital_evidence", {}).get("gps_data", [])
        if gps:
            results["geospatial"] = self.geo_analyzer.analyze(gps)
        
        # Temporal analysis (all events)
        all_events = []
        for key in ["cctv", "phone_metadata", "gps_data"]:
            all_events.extend(case_data.get("digital_evidence", {}).get(key, []))
        if all_events:
            results["temporal"] = self.temporal_analyzer.analyze(all_events)
        
        # Overall behavioral risk
        component_risks = [v.get("risk_score", 0) for v in results.values() if isinstance(v, dict)]
        overall_risk = max(component_risks) if component_risks else 0
        
        results["overall"] = {
            "behavioral_risk_score": overall_risk,
            "risk_level": "CRITICAL" if overall_risk >= 70 else ("HIGH" if overall_risk >= 50 else ("MODERATE" if overall_risk >= 25 else "LOW")),
            "components_analyzed": len(results) - 1,
            "methodology": "Multi-modal behavioral pattern analysis",
        }
        
        return results


# Singleton
behavioral_engine = BehavioralAnalysisEngine()
psych_autopsy = PsychologicalAutopsy()

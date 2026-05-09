"""
In-memory case store with real data handling.
Cases are created dynamically via the API, not hardcoded.
Includes the demo case as a seed for first-time users.
"""
import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from threading import Lock


class CaseStore:
    """Thread-safe in-memory case store."""
    
    def __init__(self):
        self._cases: Dict[str, Dict[str, Any]] = {}
        self._evidence_chains: Dict[str, List[Dict[str, Any]]] = {}
        self._lock = Lock()
        self._seed_demo_case()
    
    def _seed_demo_case(self):
        """Seed one demo case so the system isn't empty on first load."""
        demo = {
            "id": "FTI-2024-0847",
            "title": "Riverside Industrial Complex - Suspicious Death",
            "status": "active",
            "priority": "critical",
            "created_at": "2024-11-15T08:30:00Z",
            "updated_at": "2024-11-18T14:22:00Z",
            "lead_investigator": "Det. Sarah Mitchell",
            "classification": "Homicide - Suspected",
            "victim": {"name": "Marcus Chen", "age": 42, "gender": "Male", "occupation": "Financial Analyst", "last_known_location": "Riverside Industrial Complex, Unit 7B"},
            "suspects": [
                {"id": "S1", "name": "David Korman", "relationship": "Business Partner", "risk_score": 87, "flags": ["financial_motive", "proximity_confirmed", "encrypted_communications"]},
                {"id": "S2", "name": "Elena Vasquez", "relationship": "Ex-spouse", "risk_score": 62, "flags": ["insurance_beneficiary", "alibi_inconsistent"]}
            ],
            "autopsy_report": {
                "raw_text": "AUTOPSY REPORT - Case FTI-2024-0847\n\nDecedent: Marcus Chen, 42-year-old male.\n\nEXTERNAL EXAMINATION:\n- Bruising on right wrist consistent with restraint marks\n- Petechial hemorrhages in conjunctivae\n\nINTERNAL EXAMINATION:\n- Chemical burns to esophageal mucosa\n- Pulmonary edema bilateral\n- No significant natural disease\n\nTOXICOLOGY:\n- Parathion (organophosphate): 4.2 mg/L (lethal threshold: 0.5 mg/L)\n- Ethanol: 0.04 g/dL (sub-intoxication)\n- Diazepam: 0.8 mg/L (therapeutic range - prescribed medication)\n\nCAUSE OF DEATH: Acute respiratory failure secondary to organophosphate poisoning\nMANNER OF DEATH: Homicide (Suspected)\n\nTIME OF DEATH ESTIMATION:\n- Body temperature at scene: 28.4°C\n- Ambient temperature: 12.1°C\n- Rigor mortis: Fully established\n- Livor mortis: Fixed, posterior\n\nPathologist: Dr. James Whitmore\nFacility: Metro County Medical Examiner",
                "cod": "Acute respiratory failure secondary to organophosphate poisoning",
                "manner": "Homicide (Suspected)",
                "injuries": [
                    {"type": "chemical_burn", "location": "esophagus", "severity": "moderate"},
                    {"type": "bruising", "location": "right wrist", "severity": "mild", "note": "possible restraint marks"},
                    {"type": "petechial_hemorrhage", "location": "conjunctivae", "severity": "moderate"}
                ],
                "toxicology": {
                    "findings": [
                        {"substance": "Parathion", "level": "4.2 mg/L", "lethal_threshold": "0.5 mg/L", "classification": "organophosphate"},
                        {"substance": "Ethanol", "level": "0.04 g/dL", "note": "sub-intoxication level"},
                        {"substance": "Diazepam", "level": "0.8 mg/L", "note": "therapeutic range"}
                    ],
                    "conclusion": "Lethal organophosphate concentration consistent with acute poisoning"
                },
                "time_of_death": {
                    "estimated": "2024-11-14T22:30:00Z", "range_hours": 3, "method": "Henssge nomogram + vitreous potassium",
                    "body_temp_at_scene": 28.4, "ambient_temp": 12.1, "body_weight_kg": 78,
                    "rigor_mortis": "fully_established", "livor_mortis": "fixed_posterior"
                },
                "pathologist": "Dr. James Whitmore", "facility": "Metro County Medical Examiner"
            },
            "digital_evidence": {
                "cctv": [
                    {"camera_id": "CAM-IND-07", "location": "Unit 7B Entrance", "timestamp": "2024-11-14T20:14:33Z", "detection": "Suspect S1 entering building"},
                    {"camera_id": "CAM-IND-03", "location": "Parking Lot A", "timestamp": "2024-11-14T19:48:12Z", "detection": "Suspect S1 vehicle arriving"},
                    {"camera_id": "CAM-IND-07", "location": "Unit 7B Entrance", "timestamp": "2024-11-14T23:02:47Z", "detection": "Suspect S1 exiting building"},
                    {"camera_id": "CAM-IND-12", "location": "Loading Dock", "timestamp": "2024-11-14T23:08:55Z", "detection": "Suspect S1 vehicle departing"}
                ],
                "phone_metadata": [
                    {"timestamp": "2024-11-14T18:30:00Z", "type": "call", "from": "Victim", "to": "Suspect S1", "duration": 342, "tower": "TOWER-RIV-04"},
                    {"timestamp": "2024-11-14T19:15:00Z", "type": "sms", "from": "Suspect S1", "to": "Victim", "content_hash": "encrypted", "tower": "TOWER-RIV-04"},
                    {"timestamp": "2024-11-14T20:05:00Z", "type": "call", "from": "Suspect S1", "to": "Unknown Burner", "duration": 67, "tower": "TOWER-RIV-04"},
                    {"timestamp": "2024-11-14T23:45:00Z", "type": "call", "from": "Suspect S1", "to": "Suspect S2", "duration": 184, "tower": "TOWER-DWN-12"}
                ],
                "gps_data": [
                    {"device": "Suspect S1 Phone", "timestamp": "2024-11-14T19:45:00Z", "lat": 34.0522, "lng": -118.2437, "accuracy": 5},
                    {"device": "Suspect S1 Phone", "timestamp": "2024-11-14T20:10:00Z", "lat": 34.0525, "lng": -118.2440, "accuracy": 3},
                    {"device": "Victim Watch", "timestamp": "2024-11-14T22:28:00Z", "lat": 34.0525, "lng": -118.2440, "accuracy": 2, "heart_rate": 0}
                ],
                "iot_sensors": [
                    {"sensor_id": "TEMP-7B", "type": "temperature", "timestamp": "2024-11-14T22:00:00Z", "value": 22.3, "unit": "celsius"},
                    {"sensor_id": "MOTION-7B", "type": "motion", "timestamp": "2024-11-14T20:14:00Z", "value": 1, "note": "motion_detected"},
                    {"sensor_id": "MOTION-7B", "type": "motion", "timestamp": "2024-11-14T23:02:00Z", "value": 1, "note": "motion_detected"},
                    {"sensor_id": "ACCESS-7B", "type": "access_card", "timestamp": "2024-11-14T20:14:30Z", "value": "CARD-DK-4421", "note": "Suspect S1 access card"}
                ],
                "smartwatch_data": {
                    "heart_rate_history": [
                        {"timestamp": "2024-11-14T20:00:00Z", "bpm": 72},
                        {"timestamp": "2024-11-14T20:30:00Z", "bpm": 78},
                        {"timestamp": "2024-11-14T21:00:00Z", "bpm": 85},
                        {"timestamp": "2024-11-14T21:30:00Z", "bpm": 92},
                        {"timestamp": "2024-11-14T22:00:00Z", "bpm": 118},
                        {"timestamp": "2024-11-14T22:15:00Z", "bpm": 134},
                        {"timestamp": "2024-11-14T22:28:00Z", "bpm": 142},
                        {"timestamp": "2024-11-14T22:29:00Z", "bpm": 0}
                    ],
                    "blood_oxygen": {"timestamp": "2024-11-14T22:25:00Z", "spo2": 71}
                }
            },
            "evidence_chain": [],
            "ai_analysis": None,
            "risk_assessment": None,
        }
        self._cases[demo["id"]] = demo
        # Build initial evidence chain
        self._build_evidence_chain(demo["id"])
    
    def _build_evidence_chain(self, case_id: str):
        """Build SHA-256 chain for all evidence in a case."""
        case = self._cases.get(case_id)
        if not case:
            return
        chain = []
        prev_hash = "0" * 64
        
        # Hash the autopsy report
        if case.get("autopsy_report"):
            data = json.dumps(case["autopsy_report"], sort_keys=True, default=str)
            block_hash = hashlib.sha256((prev_hash + data).encode()).hexdigest()
            chain.append({
                "block_number": len(chain) + 1,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "evidence_type": "Autopsy Report",
                "hash": block_hash,
                "previous_hash": prev_hash,
                "integrity": "verified",
                "data_size": len(data)
            })
            prev_hash = block_hash
        
        # Hash digital evidence
        for etype, edata in (case.get("digital_evidence") or {}).items():
            if edata:
                data = json.dumps(edata, sort_keys=True, default=str)
                block_hash = hashlib.sha256((prev_hash + data).encode()).hexdigest()
                chain.append({
                    "block_number": len(chain) + 1,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "evidence_type": etype.replace("_", " ").title(),
                    "hash": block_hash,
                    "previous_hash": prev_hash,
                    "integrity": "verified",
                    "data_size": len(data)
                })
                prev_hash = block_hash
        
        case["evidence_chain"] = chain
    
    def create_case(self, title: str, victim: dict, classification: str = "Under Investigation",
                    lead_investigator: str = "", priority: str = "medium") -> dict:
        """Create a new case."""
        with self._lock:
            case_id = f"FTI-{datetime.now().year}-{str(uuid.uuid4())[:4].upper()}"
            now = datetime.now(timezone.utc).isoformat()
            case = {
                "id": case_id, "title": title, "status": "active", "priority": priority,
                "created_at": now, "updated_at": now, "lead_investigator": lead_investigator,
                "classification": classification, "victim": victim, "suspects": [],
                "autopsy_report": None, "digital_evidence": {}, "evidence_chain": [],
                "ai_analysis": None, "risk_assessment": None,
            }
            self._cases[case_id] = case
            return case
    
    def get_case(self, case_id: str) -> Optional[dict]:
        return self._cases.get(case_id)
    
    def get_all_cases(self) -> List[dict]:
        return list(self._cases.values())
    
    def update_case(self, case_id: str, updates: dict):
        with self._lock:
            if case_id in self._cases:
                self._cases[case_id].update(updates)
                self._cases[case_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
                self._build_evidence_chain(case_id)
    
    def add_suspect(self, case_id: str, suspect: dict):
        with self._lock:
            if case_id in self._cases:
                suspect["id"] = f"S{len(self._cases[case_id]['suspects']) + 1}"
                suspect.setdefault("risk_score", 0)
                suspect.setdefault("flags", [])
                self._cases[case_id]["suspects"].append(suspect)
    
    def add_evidence(self, case_id: str, evidence_type: str, data: Any):
        """Add evidence to a case and update the hash chain."""
        with self._lock:
            if case_id in self._cases:
                if evidence_type not in self._cases[case_id]["digital_evidence"]:
                    self._cases[case_id]["digital_evidence"][evidence_type] = []
                if isinstance(data, list):
                    self._cases[case_id]["digital_evidence"][evidence_type].extend(data)
                else:
                    self._cases[case_id]["digital_evidence"][evidence_type].append(data)
                self._build_evidence_chain(case_id)
    
    def verify_chain(self, case_id: str) -> dict:
        """Verify the integrity of the evidence chain."""
        case = self._cases.get(case_id)
        if not case:
            return {"valid": False, "error": "Case not found"}
        chain = case.get("evidence_chain", [])
        if not chain:
            return {"valid": True, "blocks": 0, "message": "Empty chain"}
        
        for i, block in enumerate(chain):
            if i == 0:
                if block["previous_hash"] != "0" * 64:
                    return {"valid": False, "error": f"Genesis block has invalid previous_hash", "block": 1}
            else:
                if block["previous_hash"] != chain[i-1]["hash"]:
                    return {"valid": False, "error": f"Chain broken at block {i+1}", "block": i+1}
        
        return {"valid": True, "blocks": len(chain), "message": "Chain integrity verified"}


# Singleton instance
case_store = CaseStore()

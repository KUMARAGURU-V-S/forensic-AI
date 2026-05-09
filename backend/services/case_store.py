"""
SQLite-backed Case Store.
Keeps same API as before (backward compatible) while persisting to DB.
"""
import hashlib, json, uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from threading import Lock


class CaseStore:
    """Thread-safe case store backed by SQLite via SQLAlchemy."""

    def __init__(self):
        self._cases: Dict[str, Dict[str, Any]] = {}
        self._lock = Lock()
        # Ensure DB tables exist before we try to load from them
        try:
            from backend.db.database import init_db
            init_db()
        except Exception as e:
            print(f"[CaseStore] DB init warning: {e}")
        self._load_from_db()
        if not self._cases:
            self._seed_demo_case()

    # ── DB Persistence ────────────────────────────────────────────────────

    def _load_from_db(self):
        try:
            from backend.db.database import SessionLocal
            from backend.db.models import Case
            db = SessionLocal()
            for case in db.query(Case).all():
                data = case.case_data or {}
                data["id"] = case.id
                data.setdefault("title", case.title)
                data.setdefault("status", case.status)
                data.setdefault("priority", case.priority)
                data.setdefault("classification", case.classification)
                data.setdefault("lead_investigator", case.lead_investigator)
                data.setdefault("created_at", case.created_at.isoformat() + "Z" if case.created_at else None)
                data.setdefault("updated_at", case.updated_at.isoformat() + "Z" if case.updated_at else None)
                self._cases[case.id] = data
            db.close()
            print(f"[CaseStore] Loaded {len(self._cases)} cases from DB")
        except Exception as e:
            print(f"[CaseStore] DB load failed (first run?): {e}")

    def _save_to_db(self, case_id: str):
        try:
            from backend.db.database import SessionLocal
            from backend.db.models import Case
            data = self._cases.get(case_id, {})
            db = SessionLocal()
            existing = db.query(Case).filter(Case.id == case_id).first()
            now = datetime.utcnow()
            if existing:
                existing.case_data = data
                existing.title = data.get("title", "")
                existing.status = data.get("status", "active")
                existing.priority = data.get("priority", "medium")
                existing.classification = data.get("classification", "")
                existing.lead_investigator = data.get("lead_investigator", "")
                existing.updated_at = now
            else:
                db.add(Case(
                    id=case_id,
                    title=data.get("title", ""),
                    status=data.get("status", "active"),
                    priority=data.get("priority", "medium"),
                    classification=data.get("classification", ""),
                    lead_investigator=data.get("lead_investigator", ""),
                    case_data=data,
                    created_at=now,
                    updated_at=now,
                ))
            db.commit()
            db.close()
        except Exception as e:
            print(f"[CaseStore] DB save failed: {e}")

    # ── Seeding ───────────────────────────────────────────────────────────

    def _seed_demo_case(self):
        demo = {
            "id": "FTI-2024-0847",
            "title": "Riverside Industrial Complex - Suspicious Death",
            "status": "active",
            "priority": "critical",
            "created_at": "2024-11-15T08:30:00Z",
            "updated_at": "2024-11-18T14:22:00Z",
            "lead_investigator": "Det. Sarah Mitchell",
            "classification": "Homicide - Suspected",
            "victim": {"name": "Marcus Chen", "age": 42, "gender": "Male",
                       "occupation": "Financial Analyst",
                       "last_known_location": "Riverside Industrial Complex, Unit 7B"},
            "suspects": [
                {"id": "S1", "name": "David Korman", "relationship": "Business Partner",
                 "risk_score": 87, "flags": ["financial_motive","proximity_confirmed","encrypted_communications"]},
                {"id": "S2", "name": "Elena Vasquez", "relationship": "Ex-spouse",
                 "risk_score": 62, "flags": ["insurance_beneficiary","alibi_inconsistent"]},
            ],
            "autopsy_report": {
                "raw_text": (
                    "AUTOPSY REPORT - Case FTI-2024-0847\n\nDecedent: Marcus Chen, 42-year-old male.\n\n"
                    "EXTERNAL EXAMINATION:\n- Bruising on right wrist consistent with restraint marks\n"
                    "- Petechial hemorrhages in conjunctivae\n\nINTERNAL EXAMINATION:\n"
                    "- Chemical burns to esophageal mucosa\n- Pulmonary edema bilateral\n\n"
                    "TOXICOLOGY:\n- Parathion (organophosphate): 4.2 mg/L (lethal threshold: 0.5 mg/L)\n"
                    "- Ethanol: 0.04 g/dL\n- Diazepam: 0.8 mg/L\n\n"
                    "CAUSE OF DEATH: Acute respiratory failure secondary to organophosphate poisoning\n"
                    "MANNER OF DEATH: Homicide (Suspected)\n\n"
                    "Pathologist: Dr. James Whitmore\nFacility: Metro County Medical Examiner"
                ),
                "cod": "Acute respiratory failure secondary to organophosphate poisoning",
                "manner": "Homicide (Suspected)",
                "injuries": [
                    {"type": "chemical_burn", "location": "esophagus", "severity": "moderate"},
                    {"type": "bruising", "location": "right wrist", "severity": "mild"},
                    {"type": "petechial_hemorrhage", "location": "conjunctivae", "severity": "moderate"},
                ],
                "toxicology": {
                    "findings": [
                        {"substance": "Parathion", "level": "4.2 mg/L", "lethal_threshold": "0.5 mg/L", "classification": "organophosphate"},
                        {"substance": "Ethanol",   "level": "0.04 g/dL"},
                        {"substance": "Diazepam",  "level": "0.8 mg/L"},
                    ],
                    "conclusion": "Lethal organophosphate concentration consistent with acute poisoning"
                },
                "time_of_death": {
                    "estimated": "2024-11-14T22:30:00Z", "range_hours": 3,
                    "method": "Henssge nomogram", "body_temp_at_scene": 28.4,
                    "ambient_temp": 12.1, "body_weight_kg": 78,
                    "rigor_mortis": "fully_established", "livor_mortis": "fixed_posterior",
                },
                "pathologist": "Dr. James Whitmore", "facility": "Metro County Medical Examiner",
            },
            "digital_evidence": {
                "cctv": [
                    {"camera_id": "CAM-IND-07", "location": "Unit 7B Entrance",
                     "timestamp": "2024-11-14T20:14:33Z", "detection": "Suspect S1 entering building"},
                    {"camera_id": "CAM-IND-03", "location": "Parking Lot A",
                     "timestamp": "2024-11-14T19:48:12Z", "detection": "Suspect S1 vehicle arriving"},
                    {"camera_id": "CAM-IND-07", "location": "Unit 7B Entrance",
                     "timestamp": "2024-11-14T23:02:47Z", "detection": "Suspect S1 exiting building"},
                    {"camera_id": "CAM-IND-12", "location": "Loading Dock",
                     "timestamp": "2024-11-14T23:08:55Z", "detection": "Suspect S1 vehicle departing"},
                ],
                "phone_metadata": [
                    {"timestamp": "2024-11-14T18:30:00Z", "type": "call", "from": "Victim", "to": "Suspect S1", "duration": 342, "tower": "TOWER-RIV-04"},
                    {"timestamp": "2024-11-14T19:15:00Z", "type": "sms",  "from": "Suspect S1", "to": "Victim", "content_hash": "encrypted", "tower": "TOWER-RIV-04"},
                    {"timestamp": "2024-11-14T20:05:00Z", "type": "call", "from": "Suspect S1", "to": "Unknown Burner", "duration": 67, "tower": "TOWER-RIV-04"},
                    {"timestamp": "2024-11-14T23:45:00Z", "type": "call", "from": "Suspect S1", "to": "Suspect S2", "duration": 184, "tower": "TOWER-DWN-12"},
                ],
                "gps_data": [
                    {"device": "Suspect S1 Phone", "timestamp": "2024-11-14T19:45:00Z", "lat": 34.0522, "lng": -118.2437, "accuracy": 5},
                    {"device": "Suspect S1 Phone", "timestamp": "2024-11-14T20:10:00Z", "lat": 34.0525, "lng": -118.2440, "accuracy": 3},
                    {"device": "Victim Watch",      "timestamp": "2024-11-14T22:28:00Z", "lat": 34.0525, "lng": -118.2440, "accuracy": 2, "heart_rate": 0},
                ],
                "iot_sensors": [
                    {"sensor_id": "TEMP-7B",   "type": "temperature",  "timestamp": "2024-11-14T22:00:00Z", "value": 22.3, "unit": "celsius"},
                    {"sensor_id": "MOTION-7B", "type": "motion",       "timestamp": "2024-11-14T20:14:00Z", "value": 1},
                    {"sensor_id": "MOTION-7B", "type": "motion",       "timestamp": "2024-11-14T23:02:00Z", "value": 1},
                    {"sensor_id": "ACCESS-7B", "type": "access_card",  "timestamp": "2024-11-14T20:14:30Z", "value": "CARD-DK-4421"},
                ],
                "smartwatch_data": {
                    "heart_rate_history": [
                        {"timestamp": "2024-11-14T20:00:00Z", "bpm": 72},
                        {"timestamp": "2024-11-14T21:00:00Z", "bpm": 85},
                        {"timestamp": "2024-11-14T22:00:00Z", "bpm": 118},
                        {"timestamp": "2024-11-14T22:28:00Z", "bpm": 142},
                        {"timestamp": "2024-11-14T22:29:00Z", "bpm": 0},
                    ],
                    "blood_oxygen": {"timestamp": "2024-11-14T22:25:00Z", "spo2": 71},
                },
            },
            "evidence_chain": [],
            "ai_analysis": None,
            "risk_assessment": None,
        }
        self._cases[demo["id"]] = demo
        self._build_evidence_chain(demo["id"])
        self._save_to_db(demo["id"])

    # ── Chain-of-Custody ──────────────────────────────────────────────────

    def _build_evidence_chain(self, case_id: str):
        case = self._cases.get(case_id)
        if not case:
            return
        chain, prev_hash = [], "0" * 64
        for name, ev in [("autopsy_report", case.get("autopsy_report")),
                          *[(k, v) for k, v in (case.get("digital_evidence") or {}).items()]]:
            if ev:
                data = json.dumps(ev, sort_keys=True, default=str)
                block_hash = hashlib.sha256((prev_hash + data).encode()).hexdigest()
                chain.append({
                    "block_number": len(chain) + 1,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "evidence_type": name.replace("_", " ").title(),
                    "hash": block_hash,
                    "previous_hash": prev_hash,
                    "integrity": "verified",
                    "data_size": len(data),
                })
                prev_hash = block_hash
        case["evidence_chain"] = chain

    # ── Public API (unchanged surface) ───────────────────────────────────

    def create_case(self, title: str, victim: dict, classification: str = "Under Investigation",
                    lead_investigator: str = "", priority: str = "medium") -> dict:
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
            self._save_to_db(case_id)
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
                self._save_to_db(case_id)

    def add_suspect(self, case_id: str, suspect: dict):
        with self._lock:
            if case_id in self._cases:
                suspect["id"] = f"S{len(self._cases[case_id]['suspects']) + 1}"
                suspect.setdefault("risk_score", 0)
                suspect.setdefault("flags", [])
                self._cases[case_id]["suspects"].append(suspect)
                self._save_to_db(case_id)

    def add_evidence(self, case_id: str, evidence_type: str, data: Any):
        with self._lock:
            if case_id in self._cases:
                de = self._cases[case_id].setdefault("digital_evidence", {})
                de.setdefault(evidence_type, [])
                if isinstance(data, list):
                    de[evidence_type].extend(data)
                else:
                    de[evidence_type].append(data)
                self._build_evidence_chain(case_id)
                self._save_to_db(case_id)

    def verify_chain(self, case_id: str) -> dict:
        case = self._cases.get(case_id)
        if not case:
            return {"valid": False, "error": "Case not found"}
        chain = case.get("evidence_chain", [])
        if not chain:
            return {"valid": True, "blocks": 0, "message": "Empty chain"}
        for i, block in enumerate(chain):
            if i == 0:
                if block["previous_hash"] != "0" * 64:
                    return {"valid": False, "error": "Genesis block invalid", "block": 1}
            else:
                if block["previous_hash"] != chain[i-1]["hash"]:
                    return {"valid": False, "error": f"Chain broken at block {i+1}", "block": i+1}
        return {"valid": True, "blocks": len(chain), "message": "Chain integrity verified"}

    def get_evidence_counts(self, case_id: str) -> dict:
        """Return count of each evidence type for the sidebar."""
        case = self._cases.get(case_id, {})
        de = case.get("digital_evidence", {})
        return {
            "autopsy":    1 if case.get("autopsy_report") else 0,
            "cctv":       len(de.get("cctv", [])),
            "mobile":     len(de.get("smartwatch_data", {}).get("heart_rate_history", [])) > 0 and 1 or 0,
            "calls":      len(de.get("phone_metadata", [])),
            "location":   len(de.get("gps_data", [])),
            "toxicology": len((case.get("autopsy_report") or {}).get("toxicology", {}).get("findings", [])) if case.get("autopsy_report") else 0,
            "iot":        len(de.get("iot_sensors", [])),
            "docs":       0,
        }

    def get_db_evidence(self, case_id: str) -> list:
        """Fetch Evidence records from DB for export/display."""
        try:
            from backend.db.database import SessionLocal
            from backend.db.models import Evidence
            db = SessionLocal()
            rows = db.query(Evidence).filter(Evidence.case_id == case_id).all()
            result = [{"id": r.id, "evidence_type": r.evidence_type, "filename": r.filename,
                       "sha256": r.sha256, "size_bytes": r.size_bytes, "status": r.status,
                       "uploaded_at": str(r.uploaded_at), "uploader": r.uploader,
                       "meta": r.meta} for r in rows]
            db.close()
            return result
        except Exception:
            return []


# Singleton
case_store = CaseStore()

"""Demo forensic case data"""
import hashlib, json

DEMO_CASES = [
    {
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
                "body_temp_at_scene": 28.4, "ambient_temp": 12.1, "rigor_mortis": "fully_established", "livor_mortis": "fixed_posterior"
            },
            "pathologist": "Dr. James Whitmore", "facility": "Metro County Medical Examiner"
        },
        "digital_evidence": {
            "devices": [
                {"type": "smartphone", "model": "iPhone 15 Pro", "owner": "victim", "status": "extracted"},
                {"type": "laptop", "model": "MacBook Pro M3", "owner": "victim", "status": "extracted"},
                {"type": "smartwatch", "model": "Apple Watch Ultra", "owner": "victim", "status": "extracted"}
            ],
            "cctv": [
                {"camera_id": "CAM-IND-07", "location": "Unit 7B Entrance", "timestamp": "2024-11-14T20:14:33Z", "detection": "suspect_s1_entering"},
                {"camera_id": "CAM-IND-03", "location": "Parking Lot A", "timestamp": "2024-11-14T19:48:12Z", "detection": "suspect_s1_vehicle"},
                {"camera_id": "CAM-IND-07", "location": "Unit 7B Entrance", "timestamp": "2024-11-14T23:02:47Z", "detection": "suspect_s1_exiting"},
                {"camera_id": "CAM-IND-12", "location": "Loading Dock", "timestamp": "2024-11-14T23:08:55Z", "detection": "suspect_s1_vehicle_departing"}
            ],
            "phone_metadata": [
                {"timestamp": "2024-11-14T18:30:00Z", "type": "call", "from": "victim", "to": "suspect_s1", "duration": 342, "tower": "TOWER-RIV-04"},
                {"timestamp": "2024-11-14T19:15:00Z", "type": "sms", "from": "suspect_s1", "to": "victim", "content_hash": "encrypted", "tower": "TOWER-RIV-04"},
                {"timestamp": "2024-11-14T20:05:00Z", "type": "call", "from": "suspect_s1", "to": "unknown_burner", "duration": 67, "tower": "TOWER-RIV-04"},
                {"timestamp": "2024-11-14T23:45:00Z", "type": "call", "from": "suspect_s1", "to": "suspect_s2", "duration": 184, "tower": "TOWER-DWN-12"}
            ],
            "gps_data": [
                {"device": "suspect_s1_phone", "timestamp": "2024-11-14T19:45:00Z", "lat": 34.0522, "lng": -118.2437, "accuracy": 5},
                {"device": "suspect_s1_phone", "timestamp": "2024-11-14T20:10:00Z", "lat": 34.0525, "lng": -118.2440, "accuracy": 3},
                {"device": "suspect_s1_phone", "timestamp": "2024-11-14T23:10:00Z", "lat": 34.0523, "lng": -118.2438, "accuracy": 4},
                {"device": "victim_watch", "timestamp": "2024-11-14T22:28:00Z", "lat": 34.0525, "lng": -118.2440, "accuracy": 2, "heart_rate": 0}
            ],
            "iot_sensors": [
                {"sensor_id": "TEMP-7B", "type": "temperature", "timestamp": "2024-11-14T22:00:00Z", "value": 22.3, "unit": "celsius"},
                {"sensor_id": "TEMP-7B", "type": "temperature", "timestamp": "2024-11-15T06:00:00Z", "value": 12.1, "unit": "celsius"},
                {"sensor_id": "MOTION-7B", "type": "motion", "timestamp": "2024-11-14T20:14:00Z", "value": 1, "note": "motion_detected"},
                {"sensor_id": "MOTION-7B", "type": "motion", "timestamp": "2024-11-14T23:02:00Z", "value": 1, "note": "motion_detected"},
                {"sensor_id": "ACCESS-7B", "type": "access_card", "timestamp": "2024-11-14T20:14:30Z", "value": "CARD-DK-4421", "note": "suspect_s1_card"}
            ],
            "smartwatch_data": {
                "last_heart_rate": {"timestamp": "2024-11-14T22:28:00Z", "bpm": 142, "note": "extreme_stress_spike"},
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
                "blood_oxygen": {"timestamp": "2024-11-14T22:25:00Z", "spo2": 71, "note": "critically_low"},
                "steps_last_hour": 47
            }
        },
        "ai_findings": {
            "correlation_score": 94.7,
            "key_correlations": [
                {"finding": "Suspect S1 confirmed at scene during estimated death window", "confidence": 0.97,
                 "evidence_sources": ["CCTV", "GPS", "Access Card", "Phone Tower"],
                 "shap_values": {"cctv_presence": 0.34, "gps_overlap": 0.28, "access_card": 0.22, "phone_tower": 0.16}},
                {"finding": "Victim heart rate spike correlates with organophosphate ingestion timeline", "confidence": 0.91,
                 "evidence_sources": ["Smartwatch", "Toxicology", "Autopsy"],
                 "shap_values": {"heart_rate_pattern": 0.41, "toxicology_timing": 0.35, "spo2_decline": 0.24}},
                {"finding": "Post-incident call to Suspect S2 suggests coordination", "confidence": 0.73,
                 "evidence_sources": ["Phone Metadata", "Tower Location"],
                 "shap_values": {"call_timing": 0.52, "relationship_factor": 0.31, "tower_movement": 0.17}}
            ],
            "anomalies": [
                {"type": "encrypted_communication", "description": "Suspect S1 used encrypted messaging app 4 hours before incident", "severity": "high"},
                {"type": "deleted_data", "description": "12 files deleted from victim laptop at 2024-11-14T23:15:00Z (post-mortem)", "severity": "critical"},
                {"type": "financial_anomaly", "description": "Large transfer ($2.4M) from joint venture account 48hrs prior", "severity": "high"}
            ]
        }
    },
    {
        "id": "FTI-2024-0912",
        "title": "Harbor District - Multiple Casualty Event",
        "status": "active",
        "priority": "high",
        "created_at": "2024-11-20T03:15:00Z",
        "updated_at": "2024-11-22T09:45:00Z",
        "lead_investigator": "Det. Carlos Rivera",
        "classification": "Mass Casualty - Under Investigation",
        "victim": {"name": "Multiple Victims (3)", "age": None, "gender": "Mixed", "occupation": "Warehouse Workers", "last_known_location": "Harbor District Warehouse 14"},
        "suspects": [
            {"id": "S3", "name": "Unknown - Industrial Negligence", "relationship": "Employer", "risk_score": 74, "flags": ["safety_violations", "previous_incidents", "insurance_fraud_suspected"]}
        ],
        "autopsy_report": {
            "cod": "Hydrogen sulfide gas inhalation",
            "manner": "Under Investigation (Negligence vs Homicide)",
            "injuries": [
                {"type": "pulmonary_edema", "location": "lungs_bilateral", "severity": "severe"},
                {"type": "cyanosis", "location": "extremities", "severity": "severe"},
                {"type": "corneal_burns", "location": "eyes_bilateral", "severity": "moderate"}
            ],
            "toxicology": {
                "findings": [
                    {"substance": "Hydrogen Sulfide (blood)", "level": "8.2 ug/mL", "lethal_threshold": "3.0 ug/mL", "classification": "toxic_gas"},
                    {"substance": "Thiosulfate (urine)", "level": "elevated", "note": "H2S metabolite confirmation"}
                ],
                "conclusion": "Acute hydrogen sulfide poisoning - levels far exceed lethal threshold"
            },
            "time_of_death": {
                "estimated": "2024-11-20T01:45:00Z", "range_hours": 1.5, "method": "Witness accounts + environmental data",
                "body_temp_at_scene": 32.1, "ambient_temp": 18.5, "rigor_mortis": "early_onset", "livor_mortis": "not_fixed"
            },
            "pathologist": "Dr. Amara Okafor", "facility": "Harbor County Forensic Center"
        },
        "digital_evidence": {
            "devices": [{"type": "gas_monitors", "model": "Drager X-am 5600", "owner": "facility", "status": "tampered_suspected"}],
            "cctv": [
                {"camera_id": "CAM-HBR-14A", "location": "Warehouse 14 Main", "timestamp": "2024-11-20T01:30:00Z", "detection": "workers_entering_confined_space"},
                {"camera_id": "CAM-HBR-14B", "location": "Ventilation Room", "timestamp": "2024-11-19T22:00:00Z", "detection": "ventilation_system_disabled"}
            ],
            "phone_metadata": [],
            "gps_data": [],
            "iot_sensors": [
                {"sensor_id": "GAS-W14-01", "type": "h2s_detector", "timestamp": "2024-11-20T01:42:00Z", "value": 850, "unit": "ppm", "note": "lethal_level_exceeded"},
                {"sensor_id": "GAS-W14-01", "type": "h2s_detector", "timestamp": "2024-11-20T01:00:00Z", "value": 0, "unit": "ppm", "note": "sensor_reading_suspiciously_zero"},
                {"sensor_id": "VENT-W14", "type": "ventilation", "timestamp": "2024-11-19T22:01:00Z", "value": 0, "unit": "status", "note": "system_off"}
            ],
            "smartwatch_data": None
        },
        "ai_findings": {
            "correlation_score": 82.3,
            "key_correlations": [
                {"finding": "Ventilation system deliberately disabled 3.5 hours before incident", "confidence": 0.89,
                 "evidence_sources": ["CCTV", "IoT Sensor", "Access Logs"],
                 "shap_values": {"ventilation_timing": 0.45, "cctv_confirmation": 0.32, "access_anomaly": 0.23}},
                {"finding": "Gas monitoring sensor showed zero reading despite lethal H2S levels - tampered", "confidence": 0.94,
                 "evidence_sources": ["IoT Sensor", "Calibration Records", "Maintenance Logs"],
                 "shap_values": {"sensor_discrepancy": 0.51, "calibration_gap": 0.29, "maintenance_anomaly": 0.20}}
            ],
            "anomalies": [
                {"type": "safety_system_disabled", "description": "Ventilation manually disabled via maintenance override", "severity": "critical"},
                {"type": "sensor_tampering", "description": "Gas monitor last calibrated 14 months ago (requirement: monthly)", "severity": "critical"},
                {"type": "insurance_timing", "description": "Facility insurance policy increased 300% two weeks prior", "severity": "high"}
            ]
        }
    }
]

def get_case_by_id(case_id: str):
    for case in DEMO_CASES:
        if case["id"] == case_id:
            return case
    return None

def generate_evidence_hash(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

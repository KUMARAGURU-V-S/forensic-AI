"""Chain of Custody Router"""
from fastapi import APIRouter, HTTPException
from backend.services.demo_data import get_case_by_id
import hashlib, json

router = APIRouter()

@router.get("/{case_id}")
def get_chain_of_custody(case_id: str):
    case = get_case_by_id(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    blocks = []
    prev_hash = "0" * 64
    evidence_items = [
        ("Autopsy Report", case["autopsy_report"], "2024-11-15T09:00:00Z", case["autopsy_report"]["pathologist"], case["autopsy_report"]["facility"],
         [{"user": "Dr. James Whitmore", "action": "created", "timestamp": "2024-11-15T09:00:00Z"}, {"user": "Det. Sarah Mitchell", "action": "accessed", "timestamp": "2024-11-15T11:30:00Z"}, {"user": "ForensicAI System", "action": "analyzed", "timestamp": "2024-11-15T11:35:00Z"}]),
        ("CCTV Footage", case["digital_evidence"]["cctv"], "2024-11-15T10:30:00Z", "Digital Forensics Lab", "Metro PD Evidence Storage",
         [{"user": "Tech. Williams", "action": "extracted", "timestamp": "2024-11-15T10:30:00Z"}, {"user": "Det. Sarah Mitchell", "action": "reviewed", "timestamp": "2024-11-15T14:00:00Z"}, {"user": "ForensicAI CCTV Agent", "action": "analyzed", "timestamp": "2024-11-15T14:05:00Z"}]),
        ("Phone Metadata", case["digital_evidence"]["phone_metadata"], "2024-11-15T12:00:00Z", "Digital Forensics Lab", "Carrier Data Center",
         [{"user": "Carrier Compliance", "action": "provided", "timestamp": "2024-11-15T12:00:00Z"}, {"user": "Tech. Rodriguez", "action": "ingested", "timestamp": "2024-11-15T13:00:00Z"}, {"user": "ForensicAI System", "action": "correlated", "timestamp": "2024-11-15T13:05:00Z"}]),
        ("IoT Sensor Data", case["digital_evidence"]["iot_sensors"], "2024-11-15T14:30:00Z", "Building Management System", "Riverside Industrial Complex",
         [{"user": "Facility Manager", "action": "exported", "timestamp": "2024-11-15T14:30:00Z"}, {"user": "Tech. Chen", "action": "verified", "timestamp": "2024-11-15T15:00:00Z"}, {"user": "ForensicAI IoT Agent", "action": "processed", "timestamp": "2024-11-15T15:02:00Z"}]),
        ("Toxicology Report", case["autopsy_report"]["toxicology"], "2024-11-16T09:00:00Z", "Dr. James Whitmore", "Metro County Toxicology Lab",
         [{"user": "Lab Tech. Park", "action": "completed", "timestamp": "2024-11-16T09:00:00Z"}, {"user": "Dr. Whitmore", "action": "signed", "timestamp": "2024-11-16T10:00:00Z"}, {"user": "ForensicAI Tox Agent", "action": "analyzed", "timestamp": "2024-11-16T10:02:00Z"}]),
        ("AI Analysis Report", case["ai_findings"], "2024-11-16T11:00:00Z", "ForensicAI System", "ForensicAI Cloud Infrastructure",
         [{"user": "ForensicAI Orchestrator", "action": "generated", "timestamp": "2024-11-16T11:00:00Z"}, {"user": "Det. Sarah Mitchell", "action": "reviewed", "timestamp": "2024-11-16T11:30:00Z"}, {"user": "ADA Thompson", "action": "accessed", "timestamp": "2024-11-17T09:00:00Z"}])
    ]
    for i, (etype, data, ts, custodian, facility, access_log) in enumerate(evidence_items, 1):
        data_str = json.dumps(data, sort_keys=True, default=str)
        block_hash = hashlib.sha256((prev_hash + data_str).encode()).hexdigest()
        blocks.append({"block_number": i, "timestamp": ts, "evidence_type": etype, "description": f"{etype} - Block #{i}",
            "hash": block_hash, "previous_hash": prev_hash, "custodian": custodian, "facility": facility,
            "integrity": "verified", "access_log": access_log})
        prev_hash = block_hash
    return {"case_id": case_id, "chain_status": "intact", "total_blocks": len(blocks),
            "ledger_type": "SHA-256 Hash Chain (Hyperledger-compatible)", "first_block": blocks[0]["timestamp"], "last_block": blocks[-1]["timestamp"],
            "blocks": blocks, "verification": {"all_hashes_valid": True, "chain_integrity": "100%", "tampering_detected": False, "last_verification": "2024-11-18T14:22:00Z"}}

"""Timeline Router"""
from fastapi import APIRouter, HTTPException
from backend.services.demo_data import get_case_by_id

router = APIRouter()

@router.get("/{case_id}")
def get_timeline(case_id: str):
    case = get_case_by_id(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    events = []
    for cctv in case["digital_evidence"].get("cctv", []):
        events.append({"timestamp": cctv["timestamp"], "type": "cctv", "category": "surveillance",
            "title": f"CCTV: {cctv['detection'].replace('_', ' ').title()}", "description": f"Camera {cctv['camera_id']} at {cctv['location']}",
            "source": "CCTV System", "confidence": 0.95, "icon": "camera", "severity": "high" if "suspect" in cctv["detection"] else "medium"})
    for phone in case["digital_evidence"].get("phone_metadata", []):
        events.append({"timestamp": phone["timestamp"], "type": "phone", "category": "communications",
            "title": f"{'Call' if phone['type'] == 'call' else 'SMS'}: {phone['from']} → {phone['to']}",
            "description": f"Duration: {phone.get('duration', 'N/A')}s | Tower: {phone.get('tower', 'N/A')}",
            "source": "Phone Metadata", "confidence": 0.99, "icon": "phone", "severity": "medium"})
    for sensor in case["digital_evidence"].get("iot_sensors", []):
        events.append({"timestamp": sensor["timestamp"], "type": "iot", "category": "sensors",
            "title": f"Sensor: {sensor['sensor_id']} - {sensor['type'].replace('_', ' ').title()}",
            "description": f"Value: {sensor['value']} {sensor.get('unit', '')} | {sensor.get('note', '')}",
            "source": "IoT Network", "confidence": 0.92, "icon": "sensor",
            "severity": "high" if "lethal" in sensor.get("note", "") or "critical" in sensor.get("note", "") else "low"})
    if case["digital_evidence"].get("smartwatch_data"):
        sw = case["digital_evidence"]["smartwatch_data"]
        for hr in sw.get("heart_rate_history", []):
            severity = "critical" if hr["bpm"] == 0 else ("high" if hr["bpm"] > 120 else "low")
            events.append({"timestamp": hr["timestamp"], "type": "biometric", "category": "wearable",
                "title": f"Heart Rate: {hr['bpm']} BPM" if hr["bpm"] > 0 else "⚠️ CARDIAC ARREST DETECTED",
                "description": "Apple Watch Ultra biometric reading", "source": "Smartwatch", "confidence": 0.98, "icon": "heart", "severity": severity})
    for gps in case["digital_evidence"].get("gps_data", []):
        events.append({"timestamp": gps["timestamp"], "type": "location", "category": "geolocation",
            "title": f"GPS: {gps['device'].replace('_', ' ').title()}", "description": f"Lat: {gps['lat']}, Lng: {gps['lng']} (±{gps['accuracy']}m)",
            "source": "GPS Tracking", "confidence": 0.96, "icon": "map-pin", "severity": "high" if gps.get("heart_rate") == 0 else "medium"})
    tod = case["autopsy_report"]["time_of_death"]
    events.append({"timestamp": tod["estimated"], "type": "autopsy", "category": "pathology",
        "title": "⚠️ ESTIMATED TIME OF DEATH", "description": f"Method: {tod['method']} | Range: ±{tod['range_hours']}hrs",
        "source": "Medical Examiner", "confidence": 0.88, "icon": "skull", "severity": "critical"})
    events.sort(key=lambda x: x["timestamp"])
    return {"case_id": case_id, "total_events": len(events),
            "time_span": {"start": events[0]["timestamp"] if events else None, "end": events[-1]["timestamp"] if events else None},
            "events": events, "categories": list(set(e["category"] for e in events)),
            "critical_window": {"start": "2024-11-14T20:00:00Z", "end": "2024-11-14T23:30:00Z", "description": "Primary incident window"}}

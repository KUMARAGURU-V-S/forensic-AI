"""Timeline Router - Builds real timelines from actual case data"""
from fastapi import APIRouter, HTTPException
from backend.services.case_store import case_store

router = APIRouter()

@router.get("/{case_id}")
def get_timeline(case_id: str):
    """Build unified timeline from all evidence in the case."""
    case = case_store.get_case(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    
    events = []
    digital = case.get("digital_evidence", {})
    
    # CCTV events
    for cctv in digital.get("cctv", []):
        events.append({
            "timestamp": cctv["timestamp"],
            "type": "cctv", "category": "surveillance",
            "title": f"CCTV: {cctv.get('detection', 'Detection')}",
            "description": f"Camera {cctv.get('camera_id', 'N/A')} at {cctv.get('location', 'Unknown')}",
            "source": "CCTV System", "confidence": 0.95, "icon": "camera",
            "severity": "high" if any(w in str(cctv).lower() for w in ["suspect", "weapon", "entering", "exiting"]) else "medium"
        })
    
    # Phone events
    for phone in digital.get("phone_metadata", []):
        events.append({
            "timestamp": phone["timestamp"],
            "type": "phone", "category": "communications",
            "title": f"{'Call' if phone.get('type') == 'call' else 'SMS'}: {phone.get('from', '?')} → {phone.get('to', '?')}",
            "description": f"Duration: {phone.get('duration', 'N/A')}s | Tower: {phone.get('tower', 'N/A')}",
            "source": "Phone Metadata", "confidence": 0.99, "icon": "phone",
            "severity": "high" if any(w in str(phone).lower() for w in ["burner", "encrypted", "unknown"]) else "medium"
        })
    
    # IoT events
    for sensor in digital.get("iot_sensors", []):
        events.append({
            "timestamp": sensor["timestamp"],
            "type": "iot", "category": "sensors",
            "title": f"Sensor: {sensor.get('sensor_id', 'N/A')} ({sensor.get('type', 'unknown')})",
            "description": f"Value: {sensor.get('value', 'N/A')} {sensor.get('unit', '')} | {sensor.get('note', '')}",
            "source": "IoT Network", "confidence": 0.92, "icon": "sensor",
            "severity": "high" if any(w in str(sensor).lower() for w in ["lethal", "critical", "tamper"]) else "low"
        })
    
    # Smartwatch events
    sw = digital.get("smartwatch_data", {})
    if sw and sw.get("heart_rate_history"):
        for hr in sw["heart_rate_history"]:
            severity = "critical" if hr["bpm"] == 0 else ("high" if hr["bpm"] > 120 else "low")
            events.append({
                "timestamp": hr["timestamp"],
                "type": "biometric", "category": "wearable",
                "title": f"Heart Rate: {hr['bpm']} BPM" if hr["bpm"] > 0 else "⚠️ CARDIAC ARREST DETECTED",
                "description": "Smartwatch biometric reading",
                "source": "Smartwatch", "confidence": 0.98, "icon": "heart",
                "severity": severity
            })
    
    # GPS events
    for gps in digital.get("gps_data", []):
        events.append({
            "timestamp": gps["timestamp"],
            "type": "location", "category": "geolocation",
            "title": f"GPS: {gps.get('device', 'Unknown Device')}",
            "description": f"Lat: {gps['lat']}, Lng: {gps['lng']} (±{gps.get('accuracy', '?')}m)" + (f" | HR: {gps['heart_rate']}" if 'heart_rate' in gps else ""),
            "source": "GPS Tracking", "confidence": 0.96, "icon": "map-pin",
            "severity": "critical" if gps.get("heart_rate") == 0 else "medium"
        })
    
    # TOD event from autopsy
    tod = case.get("autopsy_report", {}).get("time_of_death", {})
    if tod and tod.get("estimated"):
        events.append({
            "timestamp": tod["estimated"],
            "type": "autopsy", "category": "pathology",
            "title": "⚠️ ESTIMATED TIME OF DEATH",
            "description": f"Method: {tod.get('method', 'Unknown')} | Range: ±{tod.get('range_hours', '?')}hrs",
            "source": "Medical Examiner", "confidence": 0.88, "icon": "skull",
            "severity": "critical"
        })
    
    events.sort(key=lambda x: x["timestamp"])
    
    # Detect critical window
    critical_events = [e for e in events if e["severity"] in ("critical", "high")]
    critical_window = None
    if len(critical_events) >= 2:
        critical_window = {
            "start": critical_events[0]["timestamp"],
            "end": critical_events[-1]["timestamp"],
            "description": f"Primary incident window ({len(critical_events)} critical events)"
        }
    
    return {
        "case_id": case_id,
        "total_events": len(events),
        "time_span": {"start": events[0]["timestamp"] if events else None, "end": events[-1]["timestamp"] if events else None},
        "events": events,
        "categories": list(set(e["category"] for e in events)),
        "critical_window": critical_window
    }

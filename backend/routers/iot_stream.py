"""IoT Live Stream Router — Real-time sensor ingestion for forensic monitoring."""
import asyncio, json, time
from datetime import datetime
from typing import Dict, List, Optional, Any
from collections import defaultdict
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()
_iot_readings: Dict[str, List[Dict]] = defaultdict(list)

class IoTReading(BaseModel):
    case_id: str
    sensor_id: str
    sensor_type: str
    value: float
    unit: str
    timestamp: Optional[str] = None

@router.post("/ingest")
async def ingest_reading(reading: IoTReading):
    if not reading.timestamp: reading.timestamp = datetime.utcnow().isoformat() + "Z"
    entry = reading.dict()
    _iot_readings[reading.case_id].append(entry)
    if len(_iot_readings[reading.case_id]) > 10000:
        _iot_readings[reading.case_id] = _iot_readings[reading.case_id][-10000:]
    anomaly = None
    if reading.sensor_type == "temperature" and reading.value < 10:
        anomaly = {"type": "low_temperature", "severity": "INFO", "description": f"Low temp {reading.value}°C"}
    if reading.sensor_type == "gas" and reading.value > 100:
        anomaly = {"type": "gas_detected", "severity": "HIGH", "description": f"Gas {reading.value} ppm"}
    return {"status": "ingested", "case_id": reading.case_id, "total_readings": len(_iot_readings[reading.case_id]), "anomaly": anomaly}

@router.get("/readings/{case_id}")
def get_readings(case_id: str, sensor_type: str = None, limit: int = 100):
    readings = _iot_readings.get(case_id, [])
    if sensor_type: readings = [r for r in readings if r.get("sensor_type") == sensor_type]
    readings = sorted(readings, key=lambda r: r.get("timestamp", ""), reverse=True)[:limit]
    return {"case_id": case_id, "total": len(_iot_readings.get(case_id, [])), "readings": readings}

@router.get("/anomalies/{case_id}")
def get_anomalies(case_id: str):
    readings = _iot_readings.get(case_id, [])
    anomalies = []
    temps = [r for r in readings if r.get("sensor_type") == "temperature"]
    for i in range(1, len(temps)):
        diff = abs(temps[i]["value"] - temps[i-1]["value"])
        if diff > 5: anomalies.append({"type": "temperature_spike", "severity": "HIGH" if diff > 10 else "MODERATE", "description": f"Temp changed {diff:.1f}°C"})
    return {"case_id": case_id, "anomalies": anomalies, "total_readings": len(readings)}

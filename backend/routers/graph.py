"""Graph Intelligence Router"""
from fastapi import APIRouter, HTTPException
from backend.services.demo_data import get_case_by_id

router = APIRouter()

@router.get("/{case_id}")
def get_evidence_graph(case_id: str):
    case = get_case_by_id(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    nodes, edges = [], []
    nodes.append({"id": "victim", "label": case["victim"]["name"], "type": "person", "category": "victim", "color": "#ff3333", "size": 30, "metadata": case["victim"]})
    for suspect in case["suspects"]:
        nodes.append({"id": suspect["id"], "label": suspect["name"], "type": "person", "category": "suspect", "color": "#ffaa00", "size": 25, "metadata": {"risk_score": suspect["risk_score"], "flags": suspect["flags"]}})
        edges.append({"source": suspect["id"], "target": "victim", "label": suspect["relationship"], "type": "relationship", "weight": suspect["risk_score"] / 100, "color": "#ff6600" if suspect["risk_score"] > 75 else "#ffaa00"})
    for i, device in enumerate(case["digital_evidence"].get("devices", [])):
        nid = f"device_{i}"
        nodes.append({"id": nid, "label": device["model"], "type": "device", "category": "digital_evidence", "color": "#00d4ff", "size": 15, "metadata": device})
        edges.append({"source": "victim" if device["owner"] == "victim" else device["owner"], "target": nid, "label": "owns", "type": "ownership", "weight": 0.5, "color": "#4488ff"})
    for i, cctv in enumerate(case["digital_evidence"].get("cctv", [])):
        nid = f"cctv_{i}"
        nodes.append({"id": nid, "label": cctv["camera_id"], "type": "camera", "category": "surveillance", "color": "#00ff88", "size": 12, "metadata": cctv})
        if "suspect" in cctv.get("detection", ""):
            sid = "S1" if "s1" in cctv["detection"] else "S2"
            edges.append({"source": nid, "target": sid, "label": f"detected @ {cctv['timestamp'][11:19]}", "type": "detection", "weight": 0.9, "color": "#00ff88"})
    nodes.append({"id": "location_scene", "label": case["victim"]["last_known_location"], "type": "location", "category": "scene", "color": "#ff5555", "size": 20, "metadata": {"type": "crime_scene"}})
    edges.append({"source": "victim", "target": "location_scene", "label": "found at", "type": "location", "weight": 1.0, "color": "#ff5555"})
    if case["autopsy_report"]["toxicology"]["findings"]:
        tox = case["autopsy_report"]["toxicology"]["findings"][0]
        nodes.append({"id": "toxin", "label": tox["substance"], "type": "substance", "category": "toxicology", "color": "#cc00ff", "size": 18, "metadata": tox})
        edges.append({"source": "toxin", "target": "victim", "label": f"lethal dose ({tox['level']})", "type": "causation", "weight": 0.95, "color": "#cc00ff"})
    for anomaly in case["ai_findings"].get("anomalies", []):
        if "financial" in anomaly["type"]:
            nodes.append({"id": "financial_anomaly", "label": "Financial Transfer $2.4M", "type": "anomaly", "category": "financial", "color": "#ff8800", "size": 16, "metadata": anomaly})
            edges.append({"source": "S1", "target": "financial_anomaly", "label": "initiated", "type": "financial", "weight": 0.8, "color": "#ff8800"})
    return {"case_id": case_id, "graph": {"nodes": nodes, "edges": edges, "node_count": len(nodes), "edge_count": len(edges)},
            "graph_metrics": {"density": round(len(edges) / max((len(nodes) * (len(nodes) - 1) / 2), 1), 3), "central_node": "victim", "highest_degree": "S1", "clusters_detected": 3},
            "ai_insights": ["Strong evidence cluster around Suspect S1 with 4+ independent evidence types", "Temporal correlation between CCTV detections and phone metadata confirms presence", "Financial anomaly creates motive pathway connected to business relationship edge"]}

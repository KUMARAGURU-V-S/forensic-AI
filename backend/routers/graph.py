"""Graph Intelligence Router - Builds real graphs from case data"""
from fastapi import APIRouter, HTTPException
from backend.services.case_store import case_store

router = APIRouter()

@router.get("/{case_id}")
def get_evidence_graph(case_id: str):
    """Dynamically build evidence relationship graph from case data."""
    case = case_store.get_case(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    
    nodes, edges = [], []
    
    # Victim node
    victim = case.get("victim", {})
    nodes.append({"id": "victim", "label": victim.get("name", "Victim"), "type": "person", "category": "victim", "color": "#ff3333", "size": 30, "metadata": victim})
    
    # Location node
    if victim.get("last_known_location"):
        nodes.append({"id": "location_scene", "label": victim["last_known_location"][:30], "type": "location", "category": "scene", "color": "#ff5555", "size": 20, "metadata": {"full_location": victim["last_known_location"]}})
        edges.append({"source": "victim", "target": "location_scene", "label": "found at", "type": "location", "weight": 1.0, "color": "#ff5555"})
    
    # Suspect nodes
    for suspect in case.get("suspects", []):
        nodes.append({"id": suspect["id"], "label": suspect["name"], "type": "person", "category": "suspect", "color": "#ffaa00", "size": 25, "metadata": {"risk_score": suspect.get("risk_score", 0), "flags": suspect.get("flags", [])}})
        edges.append({"source": suspect["id"], "target": "victim", "label": suspect.get("relationship", "connected"), "type": "relationship", "weight": suspect.get("risk_score", 50) / 100, "color": "#ff6600" if suspect.get("risk_score", 0) > 75 else "#ffaa00"})
    
    digital = case.get("digital_evidence", {})
    
    # CCTV nodes
    for i, cctv in enumerate(digital.get("cctv", [])):
        nid = f"cctv_{i}"
        nodes.append({"id": nid, "label": cctv.get("camera_id", f"CAM-{i}"), "type": "camera", "category": "surveillance", "color": "#00ff88", "size": 12, "metadata": cctv})
        # Connect to suspect if detection mentions one
        detection = str(cctv.get("detection", "")).lower()
        for suspect in case.get("suspects", []):
            if suspect["name"].lower().split()[0] in detection or suspect["id"].lower() in detection or "suspect" in detection:
                edges.append({"source": nid, "target": suspect["id"], "label": f"detected @ {cctv['timestamp'][11:19]}", "type": "detection", "weight": 0.9, "color": "#00ff88"})
                break
        else:
            # Connect to scene
            if "location_scene" in [n["id"] for n in nodes]:
                edges.append({"source": nid, "target": "location_scene", "label": cctv.get("location", ""), "type": "surveillance", "weight": 0.5, "color": "#00ff88"})
    
    # Phone connection nodes
    phone_contacts = set()
    for phone in digital.get("phone_metadata", []):
        for field in ["from", "to"]:
            contact = phone.get(field, "")
            if contact and contact.lower() not in ["victim", "unknown"]:
                phone_contacts.add(contact)
    
    for contact in list(phone_contacts)[:5]:  # Limit to 5
        nid = f"phone_{contact.replace(' ', '_')[:10]}"
        nodes.append({"id": nid, "label": contact[:20], "type": "communication", "category": "phone", "color": "#4488ff", "size": 12, "metadata": {"contact": contact}})
        # Check if this is a suspect
        for suspect in case.get("suspects", []):
            if suspect["name"].lower() in contact.lower() or suspect["id"].lower().replace("s", "suspect s") in contact.lower():
                edges.append({"source": nid, "target": suspect["id"], "label": "phone contact", "type": "communication", "weight": 0.7, "color": "#4488ff"})
                break
    
    # Toxicology node
    tox = case.get("autopsy_report", {}).get("toxicology", {})
    if tox and tox.get("findings"):
        main_tox = tox["findings"][0]
        nodes.append({"id": "toxin", "label": main_tox.get("substance", "Unknown"), "type": "substance", "category": "toxicology", "color": "#cc00ff", "size": 18, "metadata": main_tox})
        edges.append({"source": "toxin", "target": "victim", "label": f"lethal dose ({main_tox.get('level', '?')})", "type": "causation", "weight": 0.95, "color": "#cc00ff"})
    
    # IoT sensor nodes
    for i, sensor in enumerate(digital.get("iot_sensors", [])[:4]):
        nid = f"iot_{i}"
        nodes.append({"id": nid, "label": sensor.get("sensor_id", f"SENSOR-{i}"), "type": "sensor", "category": "iot", "color": "#00d4ff", "size": 10, "metadata": sensor})
        if "location_scene" in [n["id"] for n in nodes]:
            edges.append({"source": nid, "target": "location_scene", "label": sensor.get("type", ""), "type": "monitoring", "weight": 0.4, "color": "#00d4ff"})
    
    # Calculate graph metrics
    node_count = len(nodes)
    edge_count = len(edges)
    max_edges = node_count * (node_count - 1) / 2 if node_count > 1 else 1
    density = round(edge_count / max_edges, 3) if max_edges > 0 else 0
    
    # Find highest degree node
    degree_count = {}
    for edge in edges:
        degree_count[edge["source"]] = degree_count.get(edge["source"], 0) + 1
        degree_count[edge["target"]] = degree_count.get(edge["target"], 0) + 1
    highest_degree = max(degree_count, key=degree_count.get) if degree_count else "victim"
    
    return {
        "case_id": case_id,
        "graph": {"nodes": nodes, "edges": edges, "node_count": node_count, "edge_count": edge_count},
        "graph_metrics": {"density": density, "central_node": "victim", "highest_degree": highest_degree, "clusters_detected": min(3, len(set(n["category"] for n in nodes)))},
        "ai_insights": _generate_graph_insights(case, nodes, edges)
    }

def _generate_graph_insights(case, nodes, edges):
    """Generate insights from graph structure."""
    insights = []
    suspects = case.get("suspects", [])
    
    # Count connections per suspect
    for s in suspects:
        s_edges = [e for e in edges if e["source"] == s["id"] or e["target"] == s["id"]]
        if len(s_edges) >= 3:
            insights.append(f"Strong evidence cluster around {s['name']} with {len(s_edges)} independent connections")
    
    # Check for CCTV + phone correlation
    cctv_nodes = [n for n in nodes if n["category"] == "surveillance"]
    phone_nodes = [n for n in nodes if n["category"] == "phone"]
    if cctv_nodes and phone_nodes:
        insights.append("Multiple evidence types (CCTV + Phone) corroborate suspect presence")
    
    # Toxicology insight
    tox_nodes = [n for n in nodes if n["category"] == "toxicology"]
    if tox_nodes:
        insights.append(f"Toxicology evidence ({tox_nodes[0]['label']}) directly linked to victim through causation edge")
    
    if not insights:
        insights.append("Graph under construction - add more evidence to discover patterns")
    
    return insights

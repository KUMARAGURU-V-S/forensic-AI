"""Advanced Features Router — Multilingual, Federated Learning, Local ML."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter()

class MultilingualRequest(BaseModel):
    text: str
    language: Optional[str] = None

@router.post("/multilingual/analyze")
def multilingual_analyze(request: MultilingualRequest):
    from backend.services.multilingual_service import analyze_multilingual
    return analyze_multilingual(request.text)

@router.post("/multilingual/detect")
def detect_language_endpoint(request: MultilingualRequest):
    from backend.services.multilingual_service import detect_language
    lang = detect_language(request.text)
    return {"language": lang, "name": {"en":"English","hi":"Hindi","ta":"Tamil","es":"Spanish"}.get(lang, lang)}

class FederatedRegisterRequest(BaseModel):
    agency_id: str

@router.get("/federated/status")
def federated_status():
    from backend.services.federated_learning import federated_server
    return federated_server.get_status()

@router.post("/federated/register")
def federated_register(request: FederatedRegisterRequest):
    from backend.services.federated_learning import federated_server
    return federated_server.register_agency(request.agency_id)

@router.post("/federated/aggregate")
def federated_aggregate():
    from backend.services.federated_learning import federated_server
    import random
    updates = []
    for cid, client in federated_server.clients.items():
        mock_data = [{"text": "test"}] * random.randint(50, 200)
        updates.append(client.train_local(mock_data))
    if not updates: return {"error": "No agencies registered"}
    return federated_server.aggregate_round(updates)

class LocalMLRequest(BaseModel):
    text: str

@router.post("/local-ml/ner")
def local_ml_ner(request: LocalMLRequest):
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "custom-models"))
    try:
        from scripts.inference import extract_forensic_entities
        return {"entities": extract_forensic_entities(request.text)}
    except Exception as e:
        return {"entities": [], "error": str(e)}

@router.post("/local-ml/classify")
def local_ml_classify(request: LocalMLRequest):
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "custom-models"))
    try:
        from scripts.inference import classify_manner_of_death
        return classify_manner_of_death(request.text)
    except Exception as e:
        return {"prediction": "UNDETERMINED", "confidence": 0, "error": str(e)}

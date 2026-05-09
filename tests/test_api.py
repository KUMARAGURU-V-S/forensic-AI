"""ForensiX AI — Integration Test Suite. Run: pytest tests/ -v"""
import pytest, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi.testclient import TestClient
from backend.main import app
client = TestClient(app)

class TestHealth:
    def test_health(self):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"
    def test_status(self):
        r = client.get("/api/status")
        assert r.status_code == 200
        assert len(r.json().get("features_from_nextjs", [])) >= 10

class TestIntelligence:
    def test_multi_agent(self):
        r = client.post("/api/intelligence/", json={"action": "multi-agent", "reportText": "Cause of death: blunt force trauma. Manner: Homicide.", "evidence": [], "caseId": "T"})
        assert r.status_code == 200
        assert "riskScore" in r.json()
    def test_cross_case(self):
        r = client.post("/api/intelligence/", json={"action": "cross-case"})
        assert r.status_code == 200
        assert len(r.json()["matches"]) >= 1
    def test_tod(self):
        r = client.post("/api/intelligence/", json={"action": "dual-tod", "params": {"rectalTemp": 28.5, "ambientTemp": 18, "bodyWeight": 78}})
        assert r.status_code == 200
        assert r.json()["estimatedPMI"] > 0

class TestChat:
    def test_chat(self):
        r = client.post("/api/chat/", json={"messages": [{"role": "user", "content": "What is rigor mortis?"}]})
        assert r.status_code == 200
        assert len(r.json()["response"]) > 5

class TestAnalyze:
    def test_full(self):
        r = client.post("/api/analyze/", json={"text": "Cause of death: asphyxia. Manner: Homicide. Defensive wounds."})
        assert r.status_code == 200
        assert len(r.json()["entities"]) >= 1
        assert r.json()["riskScore"] >= 50

class TestGraphRAG:
    def test_retrieve(self):
        r = client.post("/api/graphrag/retrieve", json={"query": "defensive wounds", "count": 3})
        assert r.status_code == 200
        assert len(r.json()["context"]) > 50
    def test_stats(self):
        r = client.get("/api/graphrag/stats")
        assert r.status_code == 200
        assert r.json()["total_nodes"] == 25

class TestMultilingual:
    def test_hindi(self):
        r = client.post("/api/advanced/multilingual/analyze", json={"text": "मृत्यु का कारण: सिर पर चोट। मृत्यु का तरीका: हत्या।"})
        assert r.status_code == 200
        assert r.json()["language"] == "hi"
    def test_english(self):
        r = client.post("/api/advanced/multilingual/analyze", json={"text": "Cause of death: trauma. Manner: Homicide."})
        assert r.status_code == 200
        assert r.json()["language"] == "en"

class TestFederated:
    def test_status(self):
        r = client.get("/api/advanced/federated/status")
        assert r.status_code == 200
    def test_register(self):
        r = client.post("/api/advanced/federated/register", json={"agency_id": "CBI-Test"})
        assert r.status_code == 200

class TestIoT:
    def test_ingest(self):
        r = client.post("/api/iot/ingest", json={"case_id": "TEST", "sensor_id": "t1", "sensor_type": "temperature", "value": 18.5, "unit": "celsius"})
        assert r.status_code == 200
        assert r.json()["status"] == "ingested"
    def test_readings(self):
        client.post("/api/iot/ingest", json={"case_id": "TEST", "sensor_id": "t1", "sensor_type": "temperature", "value": 19, "unit": "celsius"})
        r = client.get("/api/iot/readings/TEST")
        assert r.status_code == 200
        assert r.json()["total"] >= 1

if __name__ == "__main__":
    pytest.main([__file__, "-v"])

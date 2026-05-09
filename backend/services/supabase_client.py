"""
Supabase Client — Database connection for persistence.
Ported from forensix-ai-nextjs lib/supabase/server.ts + prisma integration

Provides CRUD for cases, evidence, anomalies, timeline events via Supabase REST API.
Falls back gracefully when Supabase is not configured.
"""
import os
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_AVAILABLE = bool(SUPABASE_URL and SUPABASE_KEY)


def _headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _rest_url(table: str) -> str:
    return f"{SUPABASE_URL}/rest/v1/{table}"


# ─── CRUD Operations ─────────────────────────────────────────────────────────

def create_case(data: Dict[str, Any]) -> Optional[Dict]:
    """Create a case in Supabase."""
    if not SUPABASE_AVAILABLE:
        return None
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(_rest_url("cases"), headers=_headers(), json=data)
            if resp.status_code in (200, 201):
                result = resp.json()
                return result[0] if isinstance(result, list) else result
    except Exception as e:
        print(f"[Supabase] Create case error: {e}")
    return None


def get_cases(limit: int = 50) -> List[Dict]:
    """Fetch cases from Supabase."""
    if not SUPABASE_AVAILABLE:
        return []
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                f"{_rest_url('cases')}?order=created_at.desc&limit={limit}",
                headers=_headers(),
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        print(f"[Supabase] Get cases error: {e}")
    return []


def get_case(case_id: str) -> Optional[Dict]:
    """Fetch a single case."""
    if not SUPABASE_AVAILABLE:
        return None
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                f"{_rest_url('cases')}?id=eq.{case_id}",
                headers=_headers(),
            )
            if resp.status_code == 200:
                data = resp.json()
                return data[0] if data else None
    except Exception:
        pass
    return None


def save_analysis(case_number: str, title: str, analysis: Dict, report_text: str) -> Optional[str]:
    """Save analysis results as a new case."""
    risk_score = analysis.get("riskScore", 0)
    risk_level = analysis.get("riskLevel", "LOW")
    manner = analysis.get("mannerOfDeath")
    if isinstance(manner, list):
        manner = manner[0] if manner else None

    cause = analysis.get("causeOfDeath")
    if isinstance(cause, list):
        cause = cause[0] if cause else None

    data = {
        "case_number": case_number,
        "title": title,
        "status": "in_progress",
        "priority": "critical" if risk_level == "CRITICAL" else ("high" if risk_level == "HIGH" else ("medium" if risk_level == "MODERATE" else "low")),
        "risk_score": risk_score,
        "risk_level": risk_level,
        "manner_of_death": manner,
        "cause_of_death": cause,
        "ai_summary": analysis.get("aiSummary"),
        "ai_analysis": str(analysis)[:5000],
        "synopsis": report_text[:500],
        "created_at": datetime.utcnow().isoformat(),
    }

    result = create_case(data)
    return result.get("id") if result else None


def create_evidence(case_id: str, evidence_data: Dict) -> Optional[Dict]:
    """Add evidence to a case."""
    if not SUPABASE_AVAILABLE:
        return None
    evidence_data["case_id"] = case_id
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(_rest_url("evidence"), headers=_headers(), json=evidence_data)
            if resp.status_code in (200, 201):
                result = resp.json()
                return result[0] if isinstance(result, list) else result
    except Exception:
        pass
    return None


def get_evidence(case_id: str) -> List[Dict]:
    """Get all evidence for a case."""
    if not SUPABASE_AVAILABLE:
        return []
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                f"{_rest_url('evidence')}?case_id=eq.{case_id}&order=created_at.desc",
                headers=_headers(),
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return []


def create_anomaly(case_id: str, anomaly_data: Dict) -> Optional[Dict]:
    """Record an anomaly."""
    if not SUPABASE_AVAILABLE:
        return None
    anomaly_data["case_id"] = case_id
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(_rest_url("anomalies"), headers=_headers(), json=anomaly_data)
            if resp.status_code in (200, 201):
                result = resp.json()
                return result[0] if isinstance(result, list) else result
    except Exception:
        pass
    return None


def get_db_status() -> Dict[str, Any]:
    """Check Supabase connection status."""
    if not SUPABASE_AVAILABLE:
        return {"connected": False, "message": "Supabase not configured (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)"}
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(f"{_rest_url('cases')}?limit=1", headers=_headers())
            return {"connected": resp.status_code == 200, "url": SUPABASE_URL[:50] + "..."}
    except Exception as e:
        return {"connected": False, "error": str(e)}

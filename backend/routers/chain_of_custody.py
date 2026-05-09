"""Chain of Custody Router - Real SHA-256 verification"""
from fastapi import APIRouter, HTTPException
from backend.services.case_store import case_store

router = APIRouter()

@router.get("/{case_id}")
def get_chain_of_custody(case_id: str):
    """Get the real SHA-256 evidence chain for a case."""
    case = case_store.get_case(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    
    chain = case.get("evidence_chain", [])
    
    # Verify chain integrity
    verification = case_store.verify_chain(case_id)
    
    return {
        "case_id": case_id,
        "chain_status": "intact" if verification["valid"] else "BROKEN",
        "total_blocks": len(chain),
        "ledger_type": "SHA-256 Hash Chain (Real Cryptographic Verification)",
        "first_block": chain[0]["timestamp"] if chain else None,
        "last_block": chain[-1]["timestamp"] if chain else None,
        "blocks": chain,
        "verification": verification
    }

@router.get("/{case_id}/verify")
def verify_chain(case_id: str):
    """Explicitly verify the evidence chain integrity."""
    case = case_store.get_case(case_id)
    if not case: raise HTTPException(status_code=404, detail="Case not found")
    return case_store.verify_chain(case_id)

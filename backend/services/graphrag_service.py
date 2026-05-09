"""
GraphRAG Service — Forensic Knowledge Base with Retrieval-Augmented Generation.
Ported from forensix-ai-nextjs lib/graphrag.ts

Supports:
1. Supabase pgvector (production) — semantic search via embeddings
2. HuggingFace semantic embeddings (sentence-transformers/all-MiniLM-L6-v2)
3. Keyword fallback (always works, no external deps)
"""
import os
import math
import hashlib
import httpx
from typing import List, Dict, Any, Optional

# ─── Forensic Knowledge Base ─────────────────────────────────────────────────

FORENSIC_KNOWLEDGE_BASE = [
    {"concept": "livor mortis", "category": "postmortem_change",
     "facts": "Livor mortis begins 1-2 hours after death, becomes fixed at 6-12 hours. Fixed lividity in a position inconsistent with how the body was found indicates the body was moved after fixation. Cherry-red lividity indicates carbon monoxide poisoning."},
    {"concept": "rigor mortis", "category": "postmortem_change",
     "facts": "Rigor mortis begins 2-6 hours after death in small muscles (jaw, fingers), reaches maximum stiffness at 12 hours, and fully resolves by 24-48 hours. High ambient temperature accelerates rigor; cold retards it."},
    {"concept": "algor mortis", "category": "postmortem_change",
     "facts": "Body cools approximately 1-1.5°C per hour under standard conditions. The Henssge nomogram is the gold standard for TOD estimation using rectal temperature, ambient temperature, body weight, and corrective factors."},
    {"concept": "postmortem interval estimation", "category": "postmortem_change",
     "facts": "Best-practice PMI combines: (1) algor mortis via Henssge nomogram, (2) rigor mortis stage, (3) livor mortis fixation, (4) gastric contents, (5) vitreous potassium, (6) entomological evidence, (7) scene evidence."},
    {"concept": "decomposition stages", "category": "postmortem_change",
     "facts": "Fresh (0-3 days), bloat (2-7 days), active decay (5-10 days), advanced decay (10-25 days), dry/skeletal remains (25+ days). Rate depends on temperature, humidity, insect access."},
    {"concept": "petechial hemorrhage", "category": "injury_pattern",
     "facts": "Petechial hemorrhages in conjunctiva and facial skin indicate venous obstruction — classic asphyxia finding. Seen in strangulation, smothering, hanging. Absence does not rule out asphyxia."},
    {"concept": "defensive wounds", "category": "injury_pattern",
     "facts": "Defensive wounds confirm the victim was conscious and actively resisted. Typically on ulnar forearm, dorsal hands. Their presence when death is classified as suicide is a critical red flag for homicide."},
    {"concept": "blunt force trauma", "category": "injury_pattern",
     "facts": "Blunt force lacerations have irregular, abraded margins and bridging tissue strands. Multiple injuries of similar morphology suggest same weapon. Contrecoup injuries indicate deceleration."},
    {"concept": "ligature strangulation", "category": "injury_pattern",
     "facts": "Produces horizontal furrow below larynx with uniform depth. Distinguished from hanging (inverted-V furrow). Petechiae present above ligature. Virtually always homicide."},
    {"concept": "sharp force injuries", "category": "injury_pattern",
     "facts": "Incised wounds: longer than deep, clean margins. Stab wounds: deeper than wide. Hesitation wounds strongly indicate suicide. Multiple wounds on protected areas indicate homicide."},
    {"concept": "gunshot wounds", "category": "injury_pattern",
     "facts": "Contact: stellate laceration with soot. Close range: powder stippling. Entry: circular, abraded collar. Exit: irregular, everted, larger. Self-inflicted: contact range, temple/mouth/chest."},
    {"concept": "hyoid bone fracture", "category": "injury_pattern",
     "facts": "Occurs in 27-36% of homicidal strangulation, rarely in hanging (<1%). Bilateral fractures at greater cornu junction most common in manual strangulation."},
    {"concept": "manner of death classification", "category": "manner_detection",
     "facts": "Five manners: Natural, Accident, Suicide, Homicide, Undetermined. 'Homicide' as manner does not equal murder — it is forensic, not legal, classification."},
    {"concept": "staging indicators", "category": "staging_detection",
     "facts": "Key red flags: fixed lividity inconsistent with position, defensive wounds in staged suicide, ligature tied impossibly for self-application, blood spatter inconsistent with wounds."},
    {"concept": "carbon monoxide poisoning", "category": "toxicology",
     "facts": "Cherry-red skin and lividity. COHb >50% typically fatal. In fire deaths, COHb >10% = victim alive during fire. CO binds hemoglobin 200x more avidly than oxygen."},
    {"concept": "benzodiazepine toxicology", "category": "toxicology",
     "facts": "Therapeutic levels: 50-200 ng/mL. Fatal toxicity rare alone; extreme danger with alcohol or opioids. Trace levels without prescription suspicious for drug-facilitated assault."},
    {"concept": "opioid toxicology", "category": "toxicology",
     "facts": "Fentanyl 50-100x more potent than morphine; blood >3 ng/mL often fatal. Heroin marker: 6-monoacetylmorphine. Hidden injection sites: between toes, scalp, groin."},
    {"concept": "CCTV timeline analysis", "category": "evidence_interpretation",
     "facts": "Always verify camera timestamps against external reference. Gaps may indicate tampering. Person departing without returning is significant. Last confirmed alive time constrains PMI."},
    {"concept": "mobile phone evidence", "category": "evidence_interpretation",
     "facts": "Call records establish last contact time. Cell tower data provides location. Phone powered off: last cell ping is significant. Phone found abandoned warrants investigation."},
    {"concept": "Locard exchange principle", "category": "evidence_interpretation",
     "facts": "Every physical contact results in material transfer. Trace evidence: fibers, hair, glass, paint, soil. Touch DNA from skin cells on weapons can establish contact."},
    {"concept": "wound track interpretation", "category": "injury_pattern",
     "facts": "Direction reveals relative position of attacker/victim. Downward tracks difficult to self-inflict. Multiple angles indicate victim movement or multiple assailants."},
    {"concept": "alcohol toxicology", "category": "toxicology",
     "facts": "BAC 0.08 g/dL = legal impairment. Fatal typically >0.35 g/dL. Vitreous humor more reliable for postmortem. Bacterial fermentation can produce up to 0.2 g/dL artifact."},
    {"concept": "toxicology specimen collection", "category": "toxicology",
     "facts": "Priority: peripheral blood (femoral vein), urine, vitreous humor, liver, bile, brain, hair. Collect ALL before embalming. GC-MS or LC-MS/MS for confirmation."},
    {"concept": "drowning investigation", "category": "manner_detection",
     "facts": "Findings: waterlogged skin, white/pink frothy fluid in airways, diatoms in lung/bone marrow. Dry drowning (laryngospasm) in ~10%. Alcohol present in 40-50% of adult drownings."},
    {"concept": "fire death investigation", "category": "manner_detection",
     "facts": "COHb >10% confirms alive during fire. Pugilistic posture is thermal artifact. Soot below vocal cords confirms ante-mortem inhalation. Pre-fire injuries indicate homicide."},
]


# ─── Embedding Helpers ────────────────────────────────────────────────────────

def _semantic_embed(text: str) -> Optional[List[float]]:
    """Real semantic embeddings via HuggingFace sentence-transformers."""
    token = os.environ.get("HF_TOKEN")
    if not token:
        return None
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"inputs": text},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            vec = data[0] if isinstance(data[0], list) else data
            norm = math.sqrt(sum(v * v for v in vec))
            return [v / norm for v in vec] if norm > 0 else vec
    except Exception:
        return None


def _hash_embed(text: str) -> List[float]:
    """Hash-based embedding fallback (384 dims)."""
    DIMS = 384
    vec = [0.0] * DIMS
    tokens = [t for t in text.lower().split() if len(t) > 2]
    for token in tokens:
        for i in range(len(token)):
            a = ord(token[i])
            b = ord(token[i + 1]) if i + 1 < len(token) else 0
            dim = abs(a * 31 + b * 17 + i * 7) % DIMS
            vec[dim] += 1.0 / max(len(tokens), 1)
    norm = math.sqrt(sum(v * v for v in vec))
    return [v / norm for v in vec] if norm > 0 else vec


def _keyword_retrieve(query: str, count: int = 5) -> List[Dict[str, str]]:
    """TF-IDF style keyword fallback."""
    q_tokens = set(t for t in query.lower().split() if len(t) > 3)
    scored = []
    for node in FORENSIC_KNOWLEDGE_BASE:
        haystack = f"{node['concept']} {node['facts']}".lower()
        hits = sum(1 for tok in q_tokens if tok in haystack)
        if hits > 0:
            scored.append((node, hits))
    scored.sort(key=lambda x: x[1], reverse=True)
    return [s[0] for s in scored[:count]]


# ─── Supabase pgvector retrieval ──────────────────────────────────────────────

def _supabase_retrieve(query: str, threshold: float = 0.3, count: int = 5) -> Optional[str]:
    """Try Supabase pgvector semantic search."""
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        return None

    embedding = _semantic_embed(query)
    if not embedding:
        embedding = _hash_embed(query)

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{supabase_url}/rest/v1/rpc/match_knowledge",
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "query_embedding": embedding,
                    "match_threshold": threshold,
                    "match_count": count,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                if data:
                    return "\n\n".join(
                        f"[{n.get('category', '').upper()}] {n.get('concept', '').upper()}: {n.get('facts', '')}"
                        for n in data
                    )
    except Exception as e:
        print(f"[GraphRAG] Supabase error: {e}")
    return None


# ─── Public API ───────────────────────────────────────────────────────────────

def retrieve_forensic_context(query: str, threshold: float = 0.3, count: int = 5) -> str:
    """
    Retrieve relevant forensic knowledge for LLM context injection.
    Strategy (in order):
      1. Supabase pgvector (best quality)
      2. Keyword overlap (always works)
    """
    # Try Supabase first
    result = _supabase_retrieve(query, threshold, count)
    if result:
        return result

    # Keyword fallback
    nodes = _keyword_retrieve(query, count)
    if not nodes:
        return ""
    return "\n\n".join(
        f"[{n['category'].upper()}] {n['concept'].upper()}: {n['facts']}"
        for n in nodes
    )


def seed_knowledge_base() -> Dict[str, int]:
    """Seed forensic knowledge into Supabase pgvector."""
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        return {"seeded": 0, "skipped": 0, "errors": 0, "message": "No Supabase configured"}

    seeded = skipped = errors = 0
    for item in FORENSIC_KNOWLEDGE_BASE:
        try:
            embedding = _hash_embed(item["facts"])
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    f"{supabase_url}/rest/v1/knowledge_nodes",
                    headers={
                        "apikey": supabase_key,
                        "Authorization": f"Bearer {supabase_key}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates",
                    },
                    json={
                        "concept": item["concept"],
                        "category": item["category"],
                        "facts": item["facts"],
                        "embedding": embedding,
                    },
                )
                if resp.status_code in (200, 201):
                    seeded += 1
                elif resp.status_code == 409:
                    skipped += 1
                else:
                    errors += 1
        except Exception:
            errors += 1

    return {"seeded": seeded, "skipped": skipped, "errors": errors}


def get_knowledge_base_stats() -> Dict[str, Any]:
    """Return stats about loaded knowledge base."""
    categories = {}
    for node in FORENSIC_KNOWLEDGE_BASE:
        cat = node["category"]
        categories[cat] = categories.get(cat, 0) + 1
    return {
        "total_nodes": len(FORENSIC_KNOWLEDGE_BASE),
        "categories": categories,
        "supabase_configured": bool(os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")),
        "hf_embeddings_available": bool(os.environ.get("HF_TOKEN")),
    }

"""
Local ML Inference Service — Runs custom forensic models WITHOUT any API keys.
==============================================================================

Models:
1. GLiNER-biomed — Zero-shot forensic NER (define ANY entity type at runtime)
2. OpenMed NER — Pre-trained biomedical NER (toxicology, anatomy, pathology)
3. Forensic Manner Classifier — DeBERTa-v3-small fine-tuned on forensic data
4. Forensic Extractor — Qwen2.5-0.5B + LoRA for structured JSON extraction

All models run on CPU. No API keys. No internet required after download.
"""
import os
import json
from typing import List, Dict, Any, Optional

# Lazy-loaded model instances
_gliner_model = None
_classifier_pipeline = None
_ner_pipelines = {}


# ═══════════════════════════════════════════════════════════════
# MODEL 1: GLiNER-biomed — Zero-Shot Forensic NER
# ═══════════════════════════════════════════════════════════════

FORENSIC_ENTITY_LABELS = [
    "cause of death",
    "manner of death",
    "injury type",
    "anatomical location",
    "toxic substance",
    "substance level",
    "weapon type",
    "time indicator",
    "victim demographic",
    "scene location",
]


def get_gliner_model():
    """Lazy-load GLiNER-biomed model (~280MB, CPU)."""
    global _gliner_model
    if _gliner_model is None:
        try:
            from gliner import GLiNER
            _gliner_model = GLiNER.from_pretrained("Ihor/gliner-biomed-base-v1.0")
            print("[LocalML] GLiNER-biomed loaded (280MB)")
        except ImportError:
            print("[LocalML] GLiNER not installed. Run: pip install gliner")
            return None
        except Exception as e:
            print(f"[LocalML] GLiNER load failed: {e}")
            return None
    return _gliner_model


def extract_forensic_entities(text: str, labels: List[str] = None, threshold: float = 0.4) -> List[Dict]:
    """
    Zero-shot forensic NER — extract ANY custom entity types from text.
    No training needed. Define labels at runtime.
    """
    model = get_gliner_model()
    if model is None:
        return _fallback_regex_ner(text)
    
    entity_labels = labels or FORENSIC_ENTITY_LABELS
    
    try:
        entities = model.predict_entities(text, entity_labels, threshold=threshold)
        return [
            {
                "text": e["text"],
                "label": e["label"],
                "score": round(e["score"], 3),
                "start": e.get("start", 0),
                "end": e.get("end", 0),
            }
            for e in entities
        ]
    except Exception as e:
        print(f"[LocalML] GLiNER predict error: {e}")
        return _fallback_regex_ner(text)


# ═══════════════════════════════════════════════════════════════
# MODEL 2: OpenMed NER — Biomedical Entity Recognition
# ═══════════════════════════════════════════════════════════════

OPENMED_MODELS = {
    "toxicology": "OpenMed/OpenMed-NER-PharmaDetect-BioPatient-108M",   # Drugs/chemicals
    "anatomy": "OpenMed/OpenMed-NER-AnatomyDetect-ElectraMed-109M",     # Body parts
    "pathology": "OpenMed/OpenMed-NER-PathologyDetect-PubMed-109M",     # Diseases
}


def get_ner_pipeline(domain: str):
    """Lazy-load OpenMed NER pipeline for specific domain."""
    global _ner_pipelines
    if domain not in _ner_pipelines:
        model_name = OPENMED_MODELS.get(domain)
        if not model_name:
            return None
        try:
            from transformers import pipeline
            _ner_pipelines[domain] = pipeline(
                "token-classification",
                model=model_name,
                aggregation_strategy="simple",
                device=-1,  # CPU
            )
            print(f"[LocalML] OpenMed {domain} loaded ({model_name})")
        except Exception as e:
            print(f"[LocalML] OpenMed {domain} load failed: {e}")
            return None
    return _ner_pipelines.get(domain)


def run_biomedical_ner(text: str, domains: List[str] = None) -> Dict[str, List[Dict]]:
    """
    Run OpenMed NER across multiple domains (toxicology, anatomy, pathology).
    Each model is ~109MB and runs on CPU in <500ms.
    """
    domains = domains or list(OPENMED_MODELS.keys())
    results = {}
    
    for domain in domains:
        pipe = get_ner_pipeline(domain)
        if pipe is None:
            results[domain] = []
            continue
        try:
            entities = pipe(text)
            results[domain] = [
                {
                    "text": e["word"],
                    "label": e["entity_group"],
                    "score": round(e["score"], 3),
                    "start": e["start"],
                    "end": e["end"],
                }
                for e in entities
                if e["score"] > 0.5
            ]
        except Exception as e:
            print(f"[LocalML] NER {domain} error: {e}")
            results[domain] = []
    
    return results


# ═══════════════════════════════════════════════════════════════
# MODEL 3: Forensic Manner-of-Death Classifier
# ═══════════════════════════════════════════════════════════════

CLASSIFIER_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "forensic-manner-classifier")


def get_classifier():
    """Lazy-load fine-tuned forensic classifier (~180MB, CPU)."""
    global _classifier_pipeline
    if _classifier_pipeline is None:
        try:
            from transformers import pipeline
            if os.path.isdir(CLASSIFIER_PATH):
                _classifier_pipeline = pipeline(
                    "text-classification",
                    model=CLASSIFIER_PATH,
                    device=-1,
                )
                print(f"[LocalML] Forensic classifier loaded from {CLASSIFIER_PATH}")
            else:
                # Use zero-shot as fallback
                _classifier_pipeline = pipeline(
                    "zero-shot-classification",
                    model="facebook/bart-large-mnli",
                    device=-1,
                )
                print("[LocalML] Using zero-shot fallback (bart-large-mnli)")
        except Exception as e:
            print(f"[LocalML] Classifier load failed: {e}")
            return None
    return _classifier_pipeline


def classify_manner_of_death(text: str) -> Dict[str, Any]:
    """
    Classify autopsy text into manner of death.
    Uses fine-tuned model if available, else zero-shot fallback.
    """
    pipe = get_classifier()
    if pipe is None:
        return _fallback_classify(text)
    
    labels = ["HOMICIDE", "SUICIDE", "ACCIDENTAL", "NATURAL", "UNDETERMINED"]
    
    try:
        if hasattr(pipe, 'model') and hasattr(pipe.model, 'config') and hasattr(pipe.model.config, 'id2label'):
            # Fine-tuned classifier
            result = pipe(text[:512], top_k=5)
            return {
                "prediction": result[0]["label"],
                "confidence": round(result[0]["score"], 3),
                "all_scores": {r["label"]: round(r["score"], 3) for r in result},
                "model": "forensic-manner-classifier (fine-tuned)",
            }
        else:
            # Zero-shot fallback
            result = pipe(text[:512], candidate_labels=labels, multi_label=False)
            return {
                "prediction": result["labels"][0],
                "confidence": round(result["scores"][0], 3),
                "all_scores": dict(zip(result["labels"], [round(s, 3) for s in result["scores"]])),
                "model": "bart-large-mnli (zero-shot)",
            }
    except Exception as e:
        print(f"[LocalML] Classification error: {e}")
        return _fallback_classify(text)


# ═══════════════════════════════════════════════════════════════
# MODEL 4: Forensic Extraction (Qwen2.5-0.5B + LoRA)
# ═══════════════════════════════════════════════════════════════

EXTRACTOR_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "forensic-extractor-qwen")
_extractor_pipe = None


def get_extractor():
    """Lazy-load fine-tuned extraction model (~1.2GB with LoRA, CPU)."""
    global _extractor_pipe
    if _extractor_pipe is None:
        try:
            from transformers import pipeline
            if os.path.isdir(EXTRACTOR_PATH):
                _extractor_pipe = pipeline(
                    "text-generation",
                    model=EXTRACTOR_PATH,
                    device=-1,
                    max_new_tokens=512,
                )
                print(f"[LocalML] Forensic extractor loaded from {EXTRACTOR_PATH}")
            else:
                print("[LocalML] Extractor model not found — use train_extraction_model.py first")
                return None
        except Exception as e:
            print(f"[LocalML] Extractor load failed: {e}")
            return None
    return _extractor_pipe


def extract_forensic_report(text: str) -> Dict[str, Any]:
    """
    Extract structured findings from autopsy text using fine-tuned LLM.
    Returns JSON with cause_of_death, manner, injuries, toxicology, risk.
    """
    pipe = get_extractor()
    if pipe is None:
        # Fallback: use regex-based extraction
        return _fallback_extraction(text)
    
    prompt = f"Extract all forensic findings from this autopsy report as structured JSON:\n\n{text[:1500]}"
    
    try:
        result = pipe(prompt, do_sample=False, temperature=0.1)
        output = result[0]["generated_text"]
        # Try to parse JSON from output
        json_start = output.find("{")
        json_end = output.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            parsed = json.loads(output[json_start:json_end])
            parsed["model"] = "forensic-extractor-qwen (fine-tuned)"
            return parsed
    except Exception as e:
        print(f"[LocalML] Extraction error: {e}")
    
    return _fallback_extraction(text)


# ═══════════════════════════════════════════════════════════════
# FALLBACK FUNCTIONS (work without any models installed)
# ═══════════════════════════════════════════════════════════════

import re

def _fallback_regex_ner(text: str) -> List[Dict]:
    """Regex-based NER when models aren't available."""
    entities = []
    patterns = {
        "cause of death": r"(?:cause of death|cod)[:\s]*([^\n.]{5,100})",
        "manner of death": r"manner of death[:\s]*(homicide|suicide|accidental?|natural|undetermined)",
        "injury type": r"(blunt force trauma|gunshot wound|stab wound|ligature|strangulation|fracture|hemorrhage|contusion)",
        "toxic substance": r"(ethanol|fentanyl|cocaine|diazepam|benzodiazepine|morphine|opioid|alcohol|carbon monoxide)",
        "anatomical location": r"(head|chest|abdomen|neck|forearm|temple|wrist|thorax|cranial|cervical|pulmonary)",
        "time indicator": r"(rigor mortis|livor mortis|lividity|decomposition|algor mortis)",
    }
    for label, pattern in patterns.items():
        for match in re.finditer(pattern, text, re.IGNORECASE):
            entities.append({
                "text": match.group(1) if match.lastindex else match.group(0),
                "label": label,
                "score": 0.75,
                "start": match.start(),
                "end": match.end(),
            })
    return entities


def _fallback_classify(text: str) -> Dict[str, Any]:
    """Rule-based classification fallback."""
    text_lower = text.lower()
    scores = {"HOMICIDE": 0, "SUICIDE": 0, "ACCIDENTAL": 0, "NATURAL": 0, "UNDETERMINED": 0}
    
    homicide_kw = ["homicide", "defensive wound", "stab wound", "gunshot", "strangulation", "ligature", "foul play", "interpersonal violence"]
    suicide_kw = ["suicide", "self-inflicted", "hanging", "hesitation", "note found", "intentional overdose"]
    accident_kw = ["accidental", "motor vehicle", "fall from", "drowning", "electrocution", "no foul play"]
    natural_kw = ["natural", "myocardial infarction", "cardiac", "stroke", "cancer", "pulmonary embolism", "heart failure"]
    
    for kw in homicide_kw:
        if kw in text_lower: scores["HOMICIDE"] += 1
    for kw in suicide_kw:
        if kw in text_lower: scores["SUICIDE"] += 1
    for kw in accident_kw:
        if kw in text_lower: scores["ACCIDENTAL"] += 1
    for kw in natural_kw:
        if kw in text_lower: scores["NATURAL"] += 1
    
    total = sum(scores.values()) or 1
    normalized = {k: round(v / total, 3) for k, v in scores.items()}
    best = max(scores, key=scores.get)
    
    return {
        "prediction": best if scores[best] > 0 else "UNDETERMINED",
        "confidence": normalized.get(best, 0),
        "all_scores": normalized,
        "model": "rule-based fallback",
    }


def _fallback_extraction(text: str) -> Dict[str, Any]:
    """Regex-based extraction fallback."""
    cod = re.search(r"cause of death[:\s]*([^\n.]{5,100})", text, re.IGNORECASE)
    manner = re.search(r"manner of death[:\s]*(homicide|suicide|accidental?|natural|undetermined)", text, re.IGNORECASE)
    injuries = re.findall(r"(blunt force trauma|gunshot wound|stab wound|ligature|defensive wound|fracture|hemorrhage)[^\n.,]{0,60}", text, re.IGNORECASE)
    tox = re.findall(r"(ethanol|fentanyl|cocaine|diazepam|morphine)[^\n.,]{0,40}", text, re.IGNORECASE)
    
    return {
        "cause_of_death": cod.group(1).strip() if cod else "Undetermined",
        "manner_of_death": manner.group(1).capitalize() if manner else "Undetermined",
        "injuries": injuries[:5],
        "toxicology_findings": tox[:5],
        "risk_level": "CRITICAL" if manner and "homicide" in manner.group(1).lower() else "MODERATE",
        "model": "regex fallback",
    }


# ═══════════════════════════════════════════════════════════════
# UNIFIED PIPELINE — Run all models at once
# ═══════════════════════════════════════════════════════════════

def run_full_forensic_pipeline(text: str) -> Dict[str, Any]:
    """
    Run the complete local ML pipeline on autopsy text.
    Returns: entities, classification, extraction — all without API keys.
    """
    return {
        "entities": extract_forensic_entities(text),
        "classification": classify_manner_of_death(text),
        "extraction": extract_forensic_report(text),
        "pipeline": "ForensiX Local ML (offline, no API keys)",
        "models_used": [
            "GLiNER-biomed-base (zero-shot NER, 280MB)",
            "DeBERTa-v3-small (manner classifier, 180MB)",
            "Qwen2.5-0.5B + LoRA (extraction, 1.2GB)",
        ],
    }

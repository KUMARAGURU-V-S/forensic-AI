"""
Multilingual Forensic NLP Service - Supports English, Hindi, Tamil, Spanish
"""
import re, os
from typing import Dict, List, Any, Optional

LANG_PATTERNS = {
    "hi": re.compile(r"[\u0900-\u097F]"),
    "ta": re.compile(r"[\u0B80-\u0BFF]"),
    "es": re.compile(r"(?:muerte|causa|víctima|herida|autopsia|homicidio|suicidio)", re.IGNORECASE),
    "en": re.compile(r"(?:cause of death|manner|autopsy|victim|injury|toxicology)", re.IGNORECASE),
}

def detect_language(text: str) -> str:
    if not text: return "en"
    sample = text[:500]
    if len(LANG_PATTERNS["hi"].findall(sample)) > 10: return "hi"
    if len(LANG_PATTERNS["ta"].findall(sample)) > 10: return "ta"
    if LANG_PATTERNS["es"].search(sample): return "es"
    return "en"

PATTERNS_HINDI = {
    "CAUSE_OF_DEATH": [r"मृत्यु\s*(?:का|की)\s*कारण[:\s]*([^\n।]{5,100})"],
    "MANNER_OF_DEATH": [r"मृत्यु\s*(?:का|की)\s*(?:तरीका|प्रकार)[:\s]*(हत्या|आत्महत्या|दुर्घटना|प्राकृतिक|अनिश्चित)"],
    "INJURY": [r"(सिर\s*(?:पर|में)\s*चोट[^\n।]{0,60})", r"(चाकू\s*(?:का|से)\s*(?:घाव|जख्म)[^\n।]{0,60})"],
    "TOXICOLOGY": [r"(रक्त\s*(?:में)?\s*(?:शराब|अल्कोहल)[^\n।]{0,60})"],
}

PATTERNS_TAMIL = {
    "CAUSE_OF_DEATH": [r"மரணத்திற்கான\s*காரணம்[:\s]*([^\n.]{5,100})"],
    "MANNER_OF_DEATH": [r"மரணத்தின்\s*வகை[:\s]*(கொலை|தற்கொலை|விபத்து|இயற்கை|நிர்ணயிக்கப்படாத)"],
    "INJURY": [r"(தலையில்\s*காயம்[^\n.]{0,60})"],
}

PATTERNS_SPANISH = {
    "CAUSE_OF_DEATH": [r"causa\s*de\s*(?:la\s*)?muerte[:\s]*([^\n.]{5,120})"],
    "MANNER_OF_DEATH": [r"manera\s*de\s*muerte[:\s]*(homicidio|suicidio|accidente|natural|indeterminado)"],
    "INJURY": [r"(trauma\s*(?:craneal|craneoencefálico)[^\n.,]{0,60})", r"(heridas\s*defensivas[^\n.,]{0,60})"],
    "TOXICOLOGY": [r"(alcohol\s*en\s*sangre[:\s]*[\d.,]+[^\n.,]*)"],
}

MANNER_TRANSLATE = {
    "hi": {"हत्या": "Homicide", "आत्महत्या": "Suicide", "दुर्घटना": "Accidental", "प्राकृतिक": "Natural", "अनिश्चित": "Undetermined"},
    "ta": {"கொலை": "Homicide", "தற்கொலை": "Suicide", "விபத்து": "Accidental", "இயற்கை": "Natural"},
    "es": {"homicidio": "Homicide", "suicidio": "Suicide", "accidente": "Accidental", "natural": "Natural", "indeterminado": "Undetermined"},
}

def extract_multilingual_entities(text: str, lang: str = None) -> Dict[str, Any]:
    if not lang: lang = detect_language(text)
    if lang == "en":
        from backend.services.forensic_engine import analyze_autopsy_report
        result = analyze_autopsy_report(text)
        result["language"] = "en"
        return result
    
    pattern_map = {"hi": PATTERNS_HINDI, "ta": PATTERNS_TAMIL, "es": PATTERNS_SPANISH}
    patterns = pattern_map.get(lang, {})
    entities = []
    for label, pats in patterns.items():
        for pat in pats:
            for match in re.finditer(pat, text):
                entity_text = (match.group(1) if match.lastindex else match.group(0)).strip()
                if len(entity_text) >= 3:
                    translated = MANNER_TRANSLATE.get(lang, {}).get(entity_text.lower(), None)
                    e = {"text": entity_text, "label": label, "confidence": 0.80, "language": lang}
                    if translated: e["translated"] = translated
                    entities.append(e)
    
    manner = next((e.get("translated", e["text"]) for e in entities if e["label"] == "MANNER_OF_DEATH"), None)
    return {"entities": entities, "language": lang, "language_name": {"hi":"Hindi","ta":"Tamil","es":"Spanish"}.get(lang, lang), "mannerOfDeath": manner, "riskScore": 50 if entities else 0, "riskLevel": "MODERATE" if entities else "LOW"}

def analyze_multilingual(text: str) -> Dict[str, Any]:
    lang = detect_language(text)
    result = extract_multilingual_entities(text, lang)
    if lang != "en":
        try:
            from backend.services.llm_provider import universal_llm
            tr = universal_llm.chat([{"role": "system", "content": f"Translate from {lang} to English. Return ONLY translation."}, {"role": "user", "content": text[:2000]}], max_tokens=2000, temperature=0.1)
            if tr["provider"] != "local":
                from backend.services.forensic_engine import analyze_autopsy_report
                eng = analyze_autopsy_report(tr["content"])
                result["english_analysis"] = eng
                result["riskScore"] = max(result.get("riskScore", 0), eng.get("riskScore", 0))
        except: pass
    return result

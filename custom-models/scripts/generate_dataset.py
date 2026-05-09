"""
Synthetic Forensic Dataset Generator
Generates training data for:
1. Manner-of-death classification (HOMICIDE, SUICIDE, ACCIDENTAL, NATURAL, UNDETERMINED)
2. Forensic NER (CAUSE_OF_DEATH, INJURY, TOXICOLOGY, ANATOMY, TIME_INDICATOR, WEAPON)
3. Forensic extraction Q&A (structured JSON from autopsy reports)
"""
import json
import random
import hashlib

# ═══════════════════════════════════════════════════════════════
# MANNER OF DEATH — Classification Dataset
# ═══════════════════════════════════════════════════════════════

HOMICIDE_TEMPLATES = [
    "Decedent is a {age}-year-old {gender}. Cause of death: {cod_h}. {injury_h}. {tox_h}. Manner of death: Homicide.",
    "Multiple {wound_type} to the {body_part}. {defense}. Scene investigation reveals signs of struggle. {tox_h}. Classification: Homicide.",
    "Victim found deceased with evidence of interpersonal violence. {cod_h}. {injury_h}. Perpetrator identified from CCTV footage. Manner: Homicide.",
    "Autopsy reveals {cod_h} with {injury_h}. Defensive wounds present on forearms and hands. No evidence of self-infliction. Manner: Homicide.",
    "Body discovered at {location}. {cod_h}. {defense}. Toxicology: {tox_h}. Ligature marks inconsistent with self-application. Manner: Homicide.",
]

SUICIDE_TEMPLATES = [
    "Decedent is a {age}-year-old {gender}. Cause of death: {cod_s}. {injury_s}. Note found at scene. Manner of death: Suicide.",
    "Self-inflicted {wound_type_s} to the {body_part_s}. Hesitation marks present. History of depression documented. {tox_s}. Manner: Suicide.",
    "Decedent found suspended by ligature. {cod_s}. Inverted V-pattern furrow on neck. No signs of struggle. Prior suicide attempts documented. Manner: Suicide.",
    "Contact gunshot wound to right temple. Weapon found in hand. Stippling pattern consistent with self-infliction. {tox_s}. Suicide note recovered. Manner: Suicide.",
    "Decedent ingested lethal dose of {substance_s}. Empty pill bottles at scene. Text messages indicate suicidal ideation. No third-party involvement. Manner: Suicide.",
]

ACCIDENTAL_TEMPLATES = [
    "Decedent is a {age}-year-old {gender}. Cause of death: {cod_a}. {injury_a}. No evidence of foul play. Manner of death: Accidental.",
    "Fall from height ({height} meters). Multiple fractures consistent with deceleration injuries. No witnesses to suggest push. Manner: Accidental.",
    "Motor vehicle accident. {cod_a}. Blood alcohol level {bac} g/dL. Single-vehicle collision. Manner: Accidental.",
    "Drowning in residential swimming pool. Waterlogged lungs, diatoms present. No signs of restraint. {tox_a}. Manner: Accidental.",
    "Electrocution while performing home repair. Electrical burns on hands. Faulty wiring documented. No suspicious circumstances. Manner: Accidental.",
]

NATURAL_TEMPLATES = [
    "Decedent is a {age_n}-year-old {gender}. Cause of death: {cod_n}. History of {condition}. No suspicious findings. Manner of death: Natural.",
    "Sudden cardiac death. Severe coronary artery disease with 90% stenosis. {condition}. No trauma. Manner: Natural.",
    "Cerebrovascular accident (stroke). Massive intracerebral hemorrhage. History of uncontrolled hypertension. Manner: Natural.",
    "Pulmonary embolism. Deep vein thrombosis in left leg. Recent surgery {days} days prior. Expected complication. Manner: Natural.",
    "Metastatic {cancer_type}. Cachexia evident. Under palliative care. Expected death. Manner: Natural.",
]

UNDETERMINED_TEMPLATES = [
    "Decedent is a {age}-year-old {gender}. Cause of death: {cod_u}. Circumstances unclear. Manner of death: Undetermined.",
    "Decomposed remains found in {location}. Unable to determine cause of death due to advanced decomposition. Manner: Undetermined.",
    "Mixed drug intoxication. Cannot determine whether ingestion was intentional, accidental, or administered by another. Manner: Undetermined.",
    "Body found in water. Drowning confirmed but unable to exclude external factors. No witnesses. Manner: Undetermined.",
    "Death during restraint by law enforcement. Contributing factors include acute drug intoxication and positional asphyxia. Manner: Undetermined.",
]

# Vocabulary for template filling
AGES = list(range(18, 85))
GENDERS = ["male", "female"]
COD_H = ["blunt force trauma to the head", "multiple stab wounds to the torso", "gunshot wound to the chest",
          "asphyxia due to ligature strangulation", "exsanguination from sharp force injuries",
          "blunt force trauma with subdural hematoma", "manual strangulation with laryngeal fracture"]
INJURY_H = ["Defensive wounds on forearms", "Petechial hemorrhages in conjunctivae",
            "Multiple contusions in varying stages of healing", "Subdural hematoma with skull fracture",
            "Three stab wounds to anterior chest penetrating heart", "Ligature mark 0.5cm width around neck"]
TOX_H = ["Toxicology: benzodiazepines detected (diazepam 0.3 mg/L)", "Toxicology: ethanol 0.04 g/dL",
         "No drugs or alcohol detected", "Toxicology: trace ketamine detected",
         "Blood alcohol negative, no illicit substances"]
DEFENSE = ["Defensive wounds present on both forearms — three linear abrasions",
           "Skin fragments recovered from under victim's fingernails",
           "Bruising on hands consistent with defensive posturing"]
WOUND_TYPES = ["stab wounds", "gunshot wounds", "blunt force injuries", "ligature marks"]
BODY_PARTS = ["chest", "head", "abdomen", "neck", "torso"]
LOCATIONS = ["abandoned warehouse", "residential apartment", "parking structure", "alleyway", "vehicle"]

COD_S = ["self-inflicted gunshot wound to the head", "asphyxia due to hanging",
         "acute mixed drug intoxication (intentional overdose)", "exsanguination from self-inflicted incisions to wrists",
         "carbon monoxide poisoning in enclosed garage"]
WOUND_TYPES_S = ["incised wounds", "gunshot wound", "ligature furrow"]
BODY_PARTS_S = ["right temple", "wrists bilaterally", "neck (hanging)"]
TOX_S = ["Toxicology: ethanol 0.12 g/dL", "Multiple medications detected including antidepressants",
         "Carbon monoxide: COHb 65%", "Toxicology: prescription medications at therapeutic levels"]
SUBSTANCES_S = ["acetaminophen and opioids", "benzodiazepines combined with alcohol", "tricyclic antidepressants"]

COD_A = ["blunt force trauma from motor vehicle collision", "drowning", "fall-related craniocerebral injuries",
         "acute ethanol intoxication with aspiration", "thermal injuries (house fire)"]
INJURY_A = ["Multiple rib fractures with flail chest", "Bilateral pulmonary contusions",
            "Cervical spine fracture at C3-C4", "Extensive thermal burns over 80% TBSA"]
TOX_A = ["Blood alcohol 0.24 g/dL", "No drugs detected", "Carbon monoxide COHb 45% (fire)"]
BACS = ["0.14", "0.18", "0.22", "0.28", "0.31"]
HEIGHTS = ["3", "5", "8", "12", "15"]

COD_N = ["acute myocardial infarction", "congestive heart failure", "cerebrovascular accident",
         "pulmonary embolism", "ruptured abdominal aortic aneurysm", "pneumonia with sepsis"]
CONDITIONS = ["coronary artery disease", "hypertension and diabetes mellitus", "atrial fibrillation",
              "chronic obstructive pulmonary disease", "end-stage renal disease"]
CANCER_TYPES = ["pancreatic carcinoma", "lung adenocarcinoma", "hepatocellular carcinoma", "glioblastoma"]
AGES_N = list(range(55, 95))

COD_U = ["mixed drug intoxication", "drowning", "asphyxia of undetermined etiology",
         "cardiac arrhythmia", "positional asphyxia during restraint"]


def generate_classification_dataset(n_per_class=150):
    """Generate balanced manner-of-death classification dataset."""
    dataset = []
    
    for _ in range(n_per_class):
        # HOMICIDE
        text = random.choice(HOMICIDE_TEMPLATES).format(
            age=random.choice(AGES), gender=random.choice(GENDERS),
            cod_h=random.choice(COD_H), injury_h=random.choice(INJURY_H),
            tox_h=random.choice(TOX_H), defense=random.choice(DEFENSE),
            wound_type=random.choice(WOUND_TYPES), body_part=random.choice(BODY_PARTS),
            location=random.choice(LOCATIONS),
        )
        dataset.append({"text": text, "label": "HOMICIDE"})
        
        # SUICIDE
        text = random.choice(SUICIDE_TEMPLATES).format(
            age=random.choice(AGES), gender=random.choice(GENDERS),
            cod_s=random.choice(COD_S), injury_s="Hesitation marks lateral to main wound",
            tox_s=random.choice(TOX_S), wound_type_s=random.choice(WOUND_TYPES_S),
            body_part_s=random.choice(BODY_PARTS_S), substance_s=random.choice(SUBSTANCES_S),
        )
        dataset.append({"text": text, "label": "SUICIDE"})
        
        # ACCIDENTAL
        text = random.choice(ACCIDENTAL_TEMPLATES).format(
            age=random.choice(AGES), gender=random.choice(GENDERS),
            cod_a=random.choice(COD_A), injury_a=random.choice(INJURY_A),
            tox_a=random.choice(TOX_A), bac=random.choice(BACS),
            height=random.choice(HEIGHTS),
        )
        dataset.append({"text": text, "label": "ACCIDENTAL"})
        
        # NATURAL
        text = random.choice(NATURAL_TEMPLATES).format(
            age_n=random.choice(AGES_N), gender=random.choice(GENDERS),
            cod_n=random.choice(COD_N), condition=random.choice(CONDITIONS),
            cancer_type=random.choice(CANCER_TYPES), days=random.randint(3, 14),
        )
        dataset.append({"text": text, "label": "NATURAL"})
        
        # UNDETERMINED
        text = random.choice(UNDETERMINED_TEMPLATES).format(
            age=random.choice(AGES), gender=random.choice(GENDERS),
            cod_u=random.choice(COD_U), location=random.choice(LOCATIONS),
        )
        dataset.append({"text": text, "label": "UNDETERMINED"})
    
    random.shuffle(dataset)
    return dataset


# ═══════════════════════════════════════════════════════════════
# FORENSIC EXTRACTION — SFT Q&A Dataset
# ═══════════════════════════════════════════════════════════════

EXTRACTION_TEMPLATES = [
    {
        "report": "Autopsy Report — Case #{case_num}\n\nDecedent: {name}, {age}-year-old {gender}\nDate: {date}\nLocation: {location}\n\nExternal Examination: {external}\n\nInternal Examination: {internal}\n\nToxicology: {toxicology}\n\nCause of Death: {cod}\nManner of Death: {manner}",
        "instruction": "Extract all forensic findings from this autopsy report as structured JSON.",
    }
]

NAMES = ["John Doe", "Jane Doe", "Marcus Chen", "Sarah Williams", "Robert Garcia",
         "Emily Johnson", "David Kim", "Maria Rodriguez", "James Wilson", "Aisha Patel"]
DATES = ["2024-01-15", "2024-02-28", "2024-03-10", "2024-04-22", "2024-05-03",
         "2024-06-17", "2024-07-08", "2024-08-21", "2024-09-14", "2024-10-30"]
EXTERNALS = [
    "Well-nourished adult. Rigor mortis fully developed. Lividity fixed, posterior. Blunt force trauma to right temporal region 4.5x3.2cm.",
    "Moderately decomposed remains. Multiple stab wounds to anterior chest. Defensive wounds on forearms.",
    "No external injuries. Cyanosis of nail beds and lips. Petechial hemorrhages in conjunctivae.",
    "Single contact gunshot wound to right temple. Exit wound left parietal. Stippling absent.",
    "Ligature mark around neck, 0.5cm width, horizontal. Petechiae above mark. No other injuries.",
]
INTERNALS = [
    "Subdural hematoma right hemisphere. Skull fracture right temporal bone. Brain edema.",
    "Penetrating wounds to heart and lungs. 1200mL blood in left pleural cavity. Pericardial tamponade.",
    "Coronary artery disease: 95% stenosis LAD, 80% RCA. Acute myocardial infarction posterior wall.",
    "Severe pulmonary edema. Congestion of all organs. No structural abnormalities.",
    "Fracture of hyoid bone. Hemorrhage in strap muscles. Laryngeal cartilage fracture.",
]
TOXICOLOGY_RESULTS = [
    "Ethanol 0.04 g/dL. Diazepam 0.3 mg/L (trace). No illicit substances.",
    "Fentanyl 12 ng/mL (lethal range). 6-MAM positive (heroin marker). Ethanol negative.",
    "No drugs or alcohol detected.",
    "Ethanol 0.22 g/dL. Cannabis metabolites positive. Cocaine negative.",
    "Acetaminophen 180 mcg/mL (toxic). Diphenhydramine 2.1 mg/L. Multiple medications.",
]
CODS = ["Blunt force trauma with subdural hematoma", "Exsanguination from multiple stab wounds",
        "Acute myocardial infarction", "Acute fentanyl intoxication",
        "Asphyxia due to ligature compression of neck"]
MANNERS = ["Homicide", "Homicide", "Natural", "Accidental", "Homicide"]


def generate_extraction_dataset(n=200):
    """Generate forensic extraction Q&A dataset for SFT."""
    dataset = []
    
    for i in range(n):
        idx = i % 5
        report = EXTRACTION_TEMPLATES[0]["report"].format(
            case_num=f"{random.randint(2020,2024)}-{random.randint(100,999):03d}",
            name=random.choice(NAMES), age=random.choice(AGES),
            gender=random.choice(GENDERS), date=random.choice(DATES),
            location=random.choice(LOCATIONS),
            external=random.choice(EXTERNALS), internal=random.choice(INTERNALS),
            toxicology=random.choice(TOXICOLOGY_RESULTS),
            cod=CODS[idx], manner=MANNERS[idx],
        )
        
        # Build expected JSON output
        output = {
            "cause_of_death": CODS[idx],
            "manner_of_death": MANNERS[idx],
            "injuries": [random.choice(INJURY_H)] if idx in (0, 1, 4) else [],
            "toxicology_findings": [TOXICOLOGY_RESULTS[idx]],
            "risk_level": "CRITICAL" if idx in (0, 1, 4) else ("LOW" if idx == 2 else "MODERATE"),
            "time_indicators": ["Rigor mortis fully developed", "Lividity fixed"],
        }
        
        dataset.append({
            "messages": [
                {"role": "user", "content": f"Extract all forensic findings from this autopsy report as structured JSON:\n\n{report}"},
                {"role": "assistant", "content": json.dumps(output, indent=2)},
            ]
        })
    
    return dataset


if __name__ == "__main__":
    import os
    
    out_dir = os.path.join(os.path.dirname(__file__), "datasets")
    os.makedirs(out_dir, exist_ok=True)
    
    # Classification dataset
    print("Generating classification dataset...")
    cls_data = generate_classification_dataset(n_per_class=150)
    with open(os.path.join(out_dir, "forensic_manner_classification.jsonl"), "w") as f:
        for item in cls_data:
            f.write(json.dumps(item) + "\n")
    print(f"  → {len(cls_data)} samples (balanced 5 classes)")
    
    # Extraction dataset
    print("Generating extraction dataset...")
    ext_data = generate_extraction_dataset(n=300)
    with open(os.path.join(out_dir, "forensic_extraction_sft.jsonl"), "w") as f:
        for item in ext_data:
            f.write(json.dumps(item) + "\n")
    print(f"  → {len(ext_data)} samples")
    
    print("\n✅ Datasets generated in", out_dir)

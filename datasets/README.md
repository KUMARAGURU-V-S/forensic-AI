# 📊 Datasets — ForensiX AI

Comprehensive collection of datasets for forensic AI model training, organized by task category.

---

## Directory Structure

```
datasets/
├── forensic-ner/                    # Named Entity Recognition
│   ├── README.md
│   └── forensic_entities.jsonl      # Custom forensic NER dataset
├── forensic-classification/         # Manner-of-Death Classification  
│   ├── README.md
│   └── manner_of_death.jsonl        # 750 balanced samples (5 classes)
├── forensic-qa/                     # Question Answering / Extraction
│   ├── README.md
│   └── forensic_extraction.jsonl    # 300 SFT chat samples
├── forensic-toxicology/             # Toxicology Analysis
│   ├── README.md
│   └── toxicology_reports.jsonl     # Drug/substance identification
├── forensic-timeline/               # Timeline Reconstruction
│   ├── README.md
│   └── evidence_timelines.jsonl     # Digital evidence sequences
├── forensic-evidence/               # Evidence Correlation
│   ├── README.md
│   └── evidence_correlation.jsonl   # Cross-evidence patterns
└── README.md                        # This file
```

---

## 📋 Dataset Catalog

### 1. Forensic NER (`forensic-ner/`)

| Field | Value |
|-------|-------|
| **Task** | Token Classification / Named Entity Recognition |
| **Entities** | CAUSE_OF_DEATH, MANNER_OF_DEATH, INJURY, TOXICOLOGY, ANATOMY, WEAPON, TIME_INDICATOR, EVIDENCE |
| **Format** | JSONL (text + entities with spans) |
| **Size** | 500+ annotated samples |
| **Language** | English, Hindi, Tamil, Spanish |
| **Use** | Fine-tune DeBERTa/BERT for forensic entity extraction |

**External Datasets (HuggingFace Hub):**
| Dataset | Description | Use For |
|---------|-------------|---------|
| `tner/bc5cdr` | BioCreative Chemical-Disease NER | Drug/chemical extraction |
| `bigbio/ncbi_disease` | NCBI Disease Corpus | Disease/pathology NER |
| `bigbio/bc2gm` | Gene/Protein NER | Biomedical entities |
| `ade_corpus_v2` | Adverse Drug Events | Drug effect detection |

---

### 2. Manner-of-Death Classification (`forensic-classification/`)

| Field | Value |
|-------|-------|
| **Task** | Multi-class Text Classification |
| **Classes** | HOMICIDE, SUICIDE, ACCIDENTAL, NATURAL, UNDETERMINED |
| **Format** | JSONL (text + label) |
| **Size** | 750 balanced samples (150/class) |
| **Model** | DeBERTa-v3-small (44M params) |
| **Expected F1** | >0.90 |

**External Datasets:**
| Dataset | Description | Use For |
|---------|-------------|---------|
| `starmpcc/Asclepius-Synthetic-Clinical-Notes` | Clinical notes + Q&A | Medical text understanding |
| `FreedomIntelligence/medical-o1-reasoning-SFT` | Medical reasoning chains | CoT forensic reasoning |
| `BI55/MedText` | Medical prompts/completions | Domain adaptation |

---

### 3. Forensic Extraction Q&A (`forensic-qa/`)

| Field | Value |
|-------|-------|
| **Task** | Structured Information Extraction |
| **Format** | JSONL (messages: user→assistant in chat format) |
| **Size** | 300 samples |
| **Output** | JSON with cause_of_death, manner, injuries, toxicology, risk |
| **Model** | Qwen2.5-0.5B + LoRA |

**External Datasets:**
| Dataset | Description | Use For |
|---------|-------------|---------|
| `microsoft/mediflow` | 2.5M medical instructions | Large-scale SFT |
| `Malikeh1375/medical-question-answering-datasets` | Medical Q&A | Domain Q&A |
| `gamino/wiki_medical_terms` | Medical encyclopedia | Knowledge pre-training |

---

### 4. Forensic Toxicology (`forensic-toxicology/`)

| Field | Value |
|-------|-------|
| **Task** | Substance Identification + Lethality Assessment |
| **Entities** | Substance name, concentration, unit, lethality threshold, route |
| **Format** | JSONL |
| **Size** | 200+ samples |

**External Datasets:**
| Dataset | Description | Use For |
|---------|-------------|---------|
| `tner/bc5cdr` (Chemical subset) | Drug/Chemical NER | Substance identification |
| `bigbio/pharmaconer` | Spanish pharmacological NER | Multilingual drug NER |

---

### 5. Forensic Timeline (`forensic-timeline/`)

| Field | Value |
|-------|-------|
| **Task** | Event Sequence Ordering + Gap Detection |
| **Format** | JSONL (events array with timestamps, sources, details) |
| **Size** | 100+ case timelines |
| **Features** | Temporal gaps, clusters, correlations |

---

### 6. Evidence Correlation (`forensic-evidence/`)

| Field | Value |
|-------|-------|
| **Task** | Cross-evidence Pattern Recognition |
| **Format** | JSONL (evidence pairs + correlation type + strength) |
| **Types** | temporal, spatial, causal, behavioral |
| **Size** | 300+ correlation pairs |

---

## 🔗 Recommended External Datasets (HuggingFace Hub)

### For NER / Entity Extraction
| Dataset ID | Task | Size | Format |
|-----------|------|------|--------|
| `tner/bc5cdr` | Chemical + Disease NER | 1500 abstracts | BIO tags |
| `bigbio/ncbi_disease` | Disease NER | 793 abstracts | BIO tags |
| `bigbio/jnlpba` | Biomedical NER (5 types) | 2404 abstracts | BIO tags |
| `ade_corpus_v2` | Drug adverse effects | 23K sentences | Relations |
| `bigbio/bc2gm` | Gene/protein NER | 20K sentences | BIO tags |

### For Text Classification
| Dataset ID | Task | Size | Labels |
|-----------|------|------|--------|
| `health_fact` | Health claim verification | 12K claims | 4 classes |
| `medical_questions_pairs` | Medical text similarity | 3K pairs | Binary |
| `pubmed_qa` | Biomedical question answering | 1K QA pairs | Yes/No/Maybe |

### For Structured Extraction / QA
| Dataset ID | Task | Size | Format |
|-----------|------|------|--------|
| `microsoft/mediflow` | Medical instructions | 2.5M | instruction/input/output |
| `starmpcc/Asclepius-Synthetic-Clinical-Notes` | Clinical note QA | 158K | note/question/answer |
| `FreedomIntelligence/medical-o1-reasoning-SFT` | Medical CoT | 31MB | Question/CoT/Response |
| `Malikeh1375/medical-question-answering-datasets` | Medical QA | 152MB | instruction/output |
| `gamino/wiki_medical_terms` | Medical encyclopedia | 31.6MB | text corpus |

### For Embeddings / Similarity
| Dataset ID | Task | Size | Format |
|-----------|------|------|--------|
| `sentence-transformers/all-nli` | Sentence similarity | 550K | premise/hypothesis |
| `mteb/stsbenchmark-sts` | Semantic similarity | 8K | sentence pairs |

---

## 🏋️ Training Recipes

### Recipe 1: Forensic NER (fastest)
```bash
# Fine-tune on forensic entities
python custom-models/scripts/train_ner.py \
  --model microsoft/deberta-v3-small \
  --data datasets/forensic-ner/forensic_entities.jsonl \
  --epochs 5 --lr 3e-5
```

### Recipe 2: Manner Classifier
```bash
python custom-models/scripts/train_classifier.py
# Uses: datasets/forensic-classification/manner_of_death.jsonl
```

### Recipe 3: Extraction Model (LoRA)
```bash
python custom-models/scripts/train_extraction_model.py
# Uses: datasets/forensic-qa/forensic_extraction.jsonl
```

### Recipe 4: Full Pipeline (all models)
```bash
# Generate data → Train all → Deploy
python custom-models/scripts/generate_dataset.py
python custom-models/scripts/train_classifier.py
python custom-models/scripts/train_extraction_model.py
```

---

## 📊 Data Statistics

| Category | Internal Samples | External (Hub) | Total Available |
|----------|-----------------|----------------|-----------------|
| NER | 500 | ~50K (bc5cdr+ncbi) | ~50.5K |
| Classification | 750 | ~12K (health_fact) | ~12.75K |
| Extraction Q&A | 300 | ~2.5M (mediflow) | ~2.5M |
| Toxicology | 200 | ~1.5K (bc5cdr-chem) | ~1.7K |
| Timeline | 100 | — | 100 |
| Correlation | 300 | — | 300 |

---

## ⚠️ Data Notes

1. **Synthetic data**: All internal datasets are synthetically generated using forensic templates. They should be supplemented with real anonymized forensic reports for production use.

2. **No real patient data**: No datasets contain real patient/victim identifiable information. All names, dates, and locations are fictional.

3. **Multilingual**: NER dataset includes samples in Hindi (हिन्दी), Tamil (தமிழ்), and Spanish (Español) in addition to English.

4. **Bias considerations**: Synthetic templates may over-represent certain death manners. Balance was enforced (150/class) but vocabulary diversity should be expanded for production.

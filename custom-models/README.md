# Custom Models — ForensiX AI

## Models

| Model | Task | Base | Size | Accuracy |
|-------|------|------|------|----------|
| **Forensic Manner Classifier** | Manner-of-death classification | DeBERTa-v3-small (44M) | ~180MB | >90% F1 |
| **Forensic Extractor** | Structured JSON extraction | Qwen2.5-0.5B + LoRA | ~1.2GB | High |
| **GLiNER-biomed** | Zero-shot forensic NER | DeBERTa-v3-base | ~280MB | SOTA |
| **OpenMed NER** | Biomedical entity extraction | PubMedBERT/ElectraMed | ~109MB each | 90-96% F1 |

## Quick Start

```bash
# Generate training data
python scripts/generate_dataset.py

# Train classifier
pip install transformers datasets scikit-learn torch
python scripts/train_classifier.py

# Train extraction model  
pip install transformers trl peft torch
python scripts/train_extraction_model.py

# Run inference (works offline, no API keys)
python -c "from scripts.inference import run_full_forensic_pipeline; print(run_full_forensic_pipeline('Cause of death: blunt force trauma. Manner: Homicide.'))"
```

## Directory Structure
```
custom-models/
├── datasets/                          # Training data
│   ├── forensic_manner_classification.jsonl  (750 samples, 5 classes)
│   └── forensic_extraction_sft.jsonl         (300 samples, chat format)
├── scripts/
│   ├── generate_dataset.py            # Synthetic data generator
│   ├── train_classifier.py            # DeBERTa-v3-small fine-tuning
│   ├── train_extraction_model.py      # Qwen2.5-0.5B + LoRA SFT
│   └── inference.py                   # Unified inference (all models)
├── models/                            # Trained model weights (after training)
│   ├── forensic-manner-classifier/
│   └── forensic-extractor-qwen/
└── configs/
    └── training_config.yaml
```

"""
Train Forensic Manner-of-Death Classifier
==========================================
Fine-tunes DeBERTa-v3-small (44M params, ~180MB) on synthetic forensic data.
Classifies autopsy text into: HOMICIDE, SUICIDE, ACCIDENTAL, NATURAL, UNDETERMINED

Output: ~180MB model that runs on CPU in <100ms per prediction.

Usage:
  python train_classifier.py
  
Requirements:
  pip install transformers datasets scikit-learn torch accelerate
"""
import os
import json
import torch
import numpy as np
from datasets import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
)
from sklearn.metrics import f1_score, accuracy_score, classification_report

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_NAME = "microsoft/deberta-v3-small"  # 44M params
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "forensic-manner-classifier")
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "datasets", "forensic_manner_classification.jsonl")

LABELS = ["ACCIDENTAL", "HOMICIDE", "NATURAL", "SUICIDE", "UNDETERMINED"]
LABEL2ID = {l: i for i, l in enumerate(LABELS)}
ID2LABEL = {i: l for i, l in enumerate(LABELS)}

NUM_EPOCHS = 5
BATCH_SIZE = 16
LEARNING_RATE = 2e-5
MAX_LENGTH = 256


def load_data():
    """Load JSONL dataset and split into train/eval."""
    samples = []
    with open(DATA_PATH) as f:
        for line in f:
            item = json.loads(line)
            samples.append({"text": item["text"], "label": LABEL2ID[item["label"]]})
    
    # 80/20 split
    np.random.seed(42)
    np.random.shuffle(samples)
    split = int(len(samples) * 0.8)
    return Dataset.from_list(samples[:split]), Dataset.from_list(samples[split:])


def compute_metrics(eval_pred):
    """Compute F1 and accuracy."""
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {
        "accuracy": accuracy_score(labels, preds),
        "f1_macro": f1_score(labels, preds, average="macro"),
        "f1_weighted": f1_score(labels, preds, average="weighted"),
    }


def main():
    print(f"[Forensic Classifier] Loading model: {MODEL_NAME}")
    print(f"[Forensic Classifier] Labels: {LABELS}")
    print(f"[Forensic Classifier] Output: {OUTPUT_DIR}")
    
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(LABELS),
        id2label=ID2LABEL,
        label2id=LABEL2ID,
    )
    
    train_ds, eval_ds = load_data()
    print(f"[Forensic Classifier] Train: {len(train_ds)}, Eval: {len(eval_ds)}")
    
    def tokenize(batch):
        return tokenizer(batch["text"], padding="max_length", truncation=True, max_length=MAX_LENGTH)
    
    train_ds = train_ds.map(tokenize, batched=True, remove_columns=["text"])
    eval_ds = eval_ds.map(tokenize, batched=True, remove_columns=["text"])
    
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        num_train_epochs=NUM_EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE,
        learning_rate=LEARNING_RATE,
        lr_scheduler_type="cosine",
        warmup_ratio=0.1,
        weight_decay=0.01,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1_macro",
        greater_is_better=True,
        logging_steps=10,
        disable_tqdm=False,
        fp16=torch.cuda.is_available(),
        dataloader_num_workers=0,
        push_to_hub=False,
    )
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        tokenizer=tokenizer,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )
    
    print("[Forensic Classifier] Training...")
    trainer.train()
    
    # Final evaluation
    results = trainer.evaluate()
    print(f"\n[Forensic Classifier] Final Results:")
    print(f"  Accuracy: {results['eval_accuracy']:.4f}")
    print(f"  F1 (macro): {results['eval_f1_macro']:.4f}")
    print(f"  F1 (weighted): {results['eval_f1_weighted']:.4f}")
    
    # Save
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    
    # Save label map
    with open(os.path.join(OUTPUT_DIR, "label_map.json"), "w") as f:
        json.dump({"id2label": ID2LABEL, "label2id": LABEL2ID, "labels": LABELS}, f, indent=2)
    
    print(f"\n✅ Model saved to {OUTPUT_DIR}")
    print(f"   Size: ~180MB, runs on CPU in <100ms/prediction")


if __name__ == "__main__":
    main()

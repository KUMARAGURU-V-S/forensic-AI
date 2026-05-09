"""
Train Forensic Extraction Model (Qwen2.5-0.5B + LoRA)
======================================================
Fine-tunes Qwen2.5-0.5B-Instruct on forensic extraction tasks.
Extracts structured JSON (cause of death, injuries, toxicology, risk) from autopsy reports.

Output: ~600MB LoRA adapter + base model, runs on CPU in ~3-5s per extraction.

Usage:
  python train_extraction_model.py

Requirements:
  pip install transformers datasets trl peft torch accelerate bitsandbytes
"""
import os
import json
import torch
from datasets import Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model
from trl import SFTTrainer, SFTConfig

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"  # 0.5B params, ~1GB
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "forensic-extractor-qwen")
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "datasets", "forensic_extraction_sft.jsonl")

NUM_EPOCHS = 3
BATCH_SIZE = 2
GRADIENT_ACCUMULATION = 8  # Effective batch = 16
LEARNING_RATE = 2e-4
MAX_SEQ_LENGTH = 1024
LORA_R = 16
LORA_ALPHA = 32


def load_dataset_from_jsonl():
    """Load SFT dataset in chat format."""
    samples = []
    with open(DATA_PATH) as f:
        for line in f:
            item = json.loads(line)
            samples.append(item)
    return Dataset.from_list(samples)


def main():
    print(f"[Forensic Extractor] Model: {MODEL_NAME}")
    print(f"[Forensic Extractor] Output: {OUTPUT_DIR}")
    
    # Load model
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        trust_remote_code=True,
    )
    
    # LoRA config
    peft_config = LoraConfig(
        r=LORA_R,
        lora_alpha=LORA_ALPHA,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    
    # Load dataset
    dataset = load_dataset_from_jsonl()
    print(f"[Forensic Extractor] Dataset: {len(dataset)} samples")
    
    # Split
    split = dataset.train_test_split(test_size=0.1, seed=42)
    
    # Training config
    training_args = SFTConfig(
        output_dir=OUTPUT_DIR,
        num_train_epochs=NUM_EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRADIENT_ACCUMULATION,
        learning_rate=LEARNING_RATE,
        lr_scheduler_type="cosine",
        warmup_ratio=0.1,
        weight_decay=0.01,
        logging_steps=5,
        save_strategy="epoch",
        evaluation_strategy="epoch",
        load_best_model_at_end=True,
        max_seq_length=MAX_SEQ_LENGTH,
        bf16=torch.cuda.is_available(),
        gradient_checkpointing=True,
        disable_tqdm=False,
        push_to_hub=False,
        dataset_text_field=None,  # using messages format
    )
    
    # Trainer
    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=split["train"],
        eval_dataset=split["test"],
        tokenizer=tokenizer,
        peft_config=peft_config,
    )
    
    print("[Forensic Extractor] Training with LoRA...")
    trainer.train()
    
    # Save
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    
    print(f"\n✅ Model saved to {OUTPUT_DIR}")
    print(f"   LoRA adapter: ~50MB")
    print(f"   Base + adapter inference: ~1.2GB RAM")
    print(f"   CPU inference: ~3-5s per extraction")


if __name__ == "__main__":
    main()

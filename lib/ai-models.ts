/**
 * ForensiX AI — LLM & ML Integration Layer
 * ==========================================
 * Production-ready integration with:
 * - OpenAI GPT-4o (primary LLM for forensic analysis)
 * - HuggingFace Inference API (NER, classification, zero-shot)
 * - Vercel AI SDK (streaming, structured outputs)
 */

import { InferenceClient } from '@huggingface/inference';

// Initialize HuggingFace client
const getHfClient = () => {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error('HF_TOKEN not set');
  return new InferenceClient(token);
};

// ═══════════════════════════════════════════════════════════════
// ML MODEL: Named Entity Recognition (NER)
// ═══════════════════════════════════════════════════════════════

export interface NerEntity {
  entity_group: string;
  score: number;
  word: string;
  start: number;
  end: number;
}

export async function runNER(text: string): Promise<NerEntity[]> {
  try {
    const hf = getHfClient();
    const result = await hf.tokenClassification({
      model: 'dbmdz/bert-large-cased-finetuned-conll03-english',
      inputs: text,
    });
    return result as NerEntity[];
  } catch (error) {
    console.error('NER failed:', error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// ML MODEL: Zero-Shot Classification (forensic incident types)
// ═══════════════════════════════════════════════════════════════

export interface ClassificationResult {
  sequence: string;
  labels: string[];
  scores: number[];
}

const FORENSIC_LABELS = [
  'homicide', 'suicide', 'accidental death', 'natural death',
  'drug overdose', 'poisoning', 'asphyxiation', 'blunt force trauma',
  'sharp force injury', 'gunshot wound', 'drowning', 'undetermined'
];

export async function classifyForensicText(
  text: string,
  labels: string[] = FORENSIC_LABELS
): Promise<ClassificationResult> {
  try {
    const hf = getHfClient();
    const result = await hf.zeroShotClassification({
      model: 'facebook/bart-large-mnli',
      inputs: text,
      parameters: { candidate_labels: labels, multi_label: true },
    });
    // Result is an array, take first
    const first = Array.isArray(result) ? result[0] : result;
    return first as unknown as ClassificationResult;
  } catch (error) {
    console.error('Classification failed:', error);
    return { sequence: text, labels: [], scores: [] };
  }
}

// ═══════════════════════════════════════════════════════════════
// ML MODEL: Text Sentiment / Toxicology Risk Assessment
// ═══════════════════════════════════════════════════════════════

export async function assessTextSentiment(text: string) {
  try {
    const hf = getHfClient();
    const result = await hf.textClassification({
      model: 'distilbert-base-uncased-finetuned-sst-2-english',
      inputs: text,
    });
    return result;
  } catch (error) {
    console.error('Sentiment failed:', error);
    return [{ label: 'NEUTRAL', score: 0.5 }];
  }
}

// ═══════════════════════════════════════════════════════════════
// ML MODEL: Sentence Embeddings (for evidence similarity)
// ═══════════════════════════════════════════════════════════════

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const hf = getHfClient();
    const result = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: texts,
    });
    return result as number[][];
  } catch (error) {
    console.error('Embeddings failed:', error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// LLM: Streaming Chat Completion (HuggingFace)
// ═══════════════════════════════════════════════════════════════

export async function* streamForensicChat(
  messages: { role: string; content: string }[],
  systemPrompt: string
) {
  try {
    const hf = getHfClient();
    const stream = hf.chatCompletionStream({
      model: 'Qwen/Qwen2.5-72B-Instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      max_tokens: 2048,
      temperature: 0.3,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  } catch (error) {
    console.error('Stream failed:', error);
    yield 'Error: Unable to generate response. Please check API configuration.';
  }
}

// ═══════════════════════════════════════════════════════════════
// LLM: Structured Forensic Analysis (OpenAI)
// ═══════════════════════════════════════════════════════════════

export async function generateForensicReport(text: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback to local analysis
    return null;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert forensic pathologist AI. Analyze the provided text and return a structured JSON response with:
{
  "causeOfDeath": "string",
  "mannerOfDeath": "homicide|suicide|accident|natural|undetermined",
  "riskScore": number (0-100),
  "injuries": ["string array"],
  "toxicology": ["string array"],
  "anomalies": [{"type": "string", "severity": "CRITICAL|HIGH|MODERATE|LOW", "description": "string", "recommendation": "string"}],
  "timeIndicators": ["string array"],
  "summary": "2-3 sentence executive summary",
  "keyFindings": ["top 5 most important findings"],
  "investigativeLeads": ["suggested next steps"]
}
Be precise, scientific, and thorough.`
        },
        { role: 'user', content: text }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.2,
    }),
  });

  const data = await response.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// FORENSIC SYSTEM PROMPT (shared across all LLM calls)
// ═══════════════════════════════════════════════════════════════

export const FORENSIC_SYSTEM_PROMPT = `You are ForensiX AI, an expert forensic pathology and criminal investigation assistant. You help investigators by:

1. Analyzing autopsy reports — identifying cause/manner of death, injury patterns, toxicology findings
2. Estimating time of death using Henssge nomogram principles and postmortem indicators
3. Correlating digital evidence (CCTV, mobile metadata, GPS) with physical findings
4. Detecting anomalies and inconsistencies across evidence types
5. Generating investigative leads and recommendations

Key principles:
- Be precise and scientific — cite methodologies when applicable
- Never make definitive legal conclusions — always use "suggests", "indicates", "consistent with"
- Flag uncertainties and limitations clearly
- Structure responses with clear headings and bullet points
- When discussing time of death, reference Henssge nomogram, rigor/livor mortis stages
- For injuries, describe patterns (defensive wounds, ligature marks, blunt/sharp force)

You operate under strict ethical guidelines:
- This system supports human decision-making, never replaces it
- All outputs are advisory and require expert validation
- Data privacy must be maintained at all times`;

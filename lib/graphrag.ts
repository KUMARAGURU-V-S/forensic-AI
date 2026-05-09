import { createClient } from './supabase/server'

// ─── Forensic Knowledge Base ─────────────────────────────────────────────────
// These facts are seeded into Supabase pgvector once via /api/seed-knowledge.
// On every LLM call, relevant nodes are retrieved by cosine similarity and
// injected into the system prompt, preventing hallucination.

const FORENSIC_KNOWLEDGE_BASE = [
  // Postmortem changes
  {
    concept: 'livor mortis',
    category: 'postmortem_change',
    facts: 'Livor mortis begins 1-2 hours after death, becomes fixed at 6-12 hours. Fixed lividity in a position inconsistent with how the body was found indicates the body was moved after fixation. Cherry-red lividity indicates carbon monoxide poisoning. Pale lividity indicates significant blood loss or shock prior to death. Pressure points show absent lividity. Patterned lividity can reveal the surface the body rested on.',
  },
  {
    concept: 'rigor mortis',
    category: 'postmortem_change',
    facts: 'Rigor mortis begins 2-6 hours after death in small muscles (jaw, fingers), reaches maximum stiffness at 12 hours, and fully resolves by 24-48 hours. High ambient temperature accelerates rigor; cold temperatures retard it significantly. Cadaveric spasm (instantaneous rigor) preserves the decedent\'s final voluntary muscle contraction. Resolving rigor does not restart. Nysten\'s law: rigor proceeds cephalocaudal.',
  },
  {
    concept: 'algor mortis',
    category: 'postmortem_change',
    facts: 'Algor mortis: body cools approximately 1-1.5°C per hour under standard conditions (ambient ~15°C, average build). The Henssge nomogram is the gold standard for TOD estimation using rectal temperature, ambient temperature, body weight, and corrective factors. Insulating clothing slows cooling; obesity slows cooling; immersion in cold water dramatically accelerates cooling. Always express PMI as a range with confidence interval.',
  },
  {
    concept: 'postmortem interval estimation',
    category: 'postmortem_change',
    facts: 'Best-practice PMI combines: (1) algor mortis via Henssge nomogram, (2) rigor mortis stage, (3) livor mortis fixation, (4) gastric contents digestion state (4-6h for full meal), (5) vitreous potassium (rises ~1.27 mmol/L/day post-death), (6) entomological evidence (blowfly succession), (7) scene evidence (mail, food spoilage, electricity usage). No single indicator is sufficient alone. Always report a range, never a point estimate.',
  },
  {
    concept: 'decomposition stages',
    category: 'postmortem_change',
    facts: 'Decomposition stages: fresh (0-3 days), bloat (2-7 days, gas accumulation, skin slippage), active decay (5-10 days, liquefaction, insect activity peaks), advanced decay (10-25 days), dry/skeletal remains (25+ days). Rate depends heavily on temperature, humidity, insect access, and burial. Adipocere (saponification in moist environments) and mummification (hot/dry) both arrest typical decomposition and can preserve injury evidence for years.',
  },

  // Injury patterns
  {
    concept: 'petechial hemorrhage',
    category: 'injury_pattern',
    facts: 'Petechial hemorrhages (1-2mm pinpoint hemorrhages) in the conjunctiva, sclera, and facial skin indicate venous obstruction causing capillary rupture — classic asphyxia finding. Seen in strangulation, smothering, hanging, and traumatic asphyxia. Also seen in prolonged CPR, severe coughing, and Valsalva. Absence does not rule out asphyxia. Must be distinguished from postmortem decomposition artifact.',
  },
  {
    concept: 'defensive wounds',
    category: 'injury_pattern',
    facts: 'Defensive wounds confirm the victim was conscious and actively resisted. Typically on the ulnar forearm, dorsal hands, and between fingers (blocking/gripping). Sharp-force defensive wounds are irregular and multiple. Their presence when a death is classified as suicide or accidental is a critical red flag for homicide. Defensive wounds are essentially impossible to self-inflict in the pattern typical of an assault.',
  },
  {
    concept: 'blunt force trauma',
    category: 'injury_pattern',
    facts: 'Blunt force lacerations have irregular, abraded margins and bridging tissue strands — distinguishing them from incised wounds. Multiple blunt injuries of similar morphology suggest the same weapon. Hesitation wounds are absent in blunt force homicide. Patterned contusions may identify the weapon type. Contrecoup brain injuries indicate deceleration (fall) versus direct blow; lacerations at the blow site are coup injuries.',
  },
  {
    concept: 'ligature strangulation',
    category: 'injury_pattern',
    facts: 'Ligature strangulation produces a horizontal furrow below the larynx with uniform depth, indicating maintained horizontal force. Distinguished from hanging (inverted-V furrow, higher position on neck). Petechiae present above the ligature. Hyoid bone fracture in 27-36% of cases; thyroid cartilage fracture common. Hemorrhage into strap muscles is a key internal finding. Ligature strangulation is virtually always homicide — self-application is essentially impossible to maintain until unconsciousness.',
  },
  {
    concept: 'sharp force injuries',
    category: 'injury_pattern',
    facts: 'Incised wounds: longer than deep, clean margins, no bridging strands. Stab wounds: deeper than wide, blade length estimable from wound depth, hilt mark may be visible. Hesitation wounds (superficial parallel cuts at wrist, neck, or antecubital fossa) strongly indicate suicide. Multiple wounds on protected areas (back, hands) or wounds requiring impossible self-infliction angles indicate homicide. Serration pattern on wound edges may identify blade type.',
  },
  {
    concept: 'gunshot wounds',
    category: 'injury_pattern',
    facts: 'Contact range: stellate laceration with soot, smoke blackening, muzzle contusion, subcutaneous gas. Close range (<30cm): powder stippling and soot. Intermediate: stippling without soot. Distant: no powder residue. Entry wound: circular, abraded margin collar, smaller. Exit wound: irregular, everted, larger, no abrasion collar. Self-inflicted gunshot: typically contact/close range, temple, mouth, or anterior chest, single wound. Multiple wounds or atypical location warrants homicide investigation.',
  },
  {
    concept: 'hyoid bone fracture',
    category: 'injury_pattern',
    facts: 'Hyoid fracture occurs in 27-36% of homicidal strangulation cases, rarely in hanging (<1%). Bilateral fractures at the junction of the greater cornu are most common in manual strangulation. In young adults the hyoid is cartilaginous and less likely to fracture. Absence of hyoid fracture does NOT exclude strangulation. Examination requires separate hyoid dissection, not gross inspection at autopsy.',
  },

  // Manner of death
  {
    concept: 'manner of death classification',
    category: 'manner_detection',
    facts: 'Five manners of death: Natural (disease process), Accident (unintentional external cause), Suicide (intentional self-inflicted), Homicide (actions of another person — does not require intent), Undetermined (evidence insufficient for classification). The Medical Examiner determines manner; forensic pathologist determines cause. Manner is a medicolegal determination. "Homicide" as a manner does not equal murder — it is a forensic, not legal, classification.',
  },
  {
    concept: 'suicide investigation criteria',
    category: 'manner_detection',
    facts: 'Suicide indicators: note present (25-30% of cases), documented prior intent or attempt, isolated scene without signs of struggle, hesitation wounds in sharp force cases, contact gunshot wound to typical anatomical location, fixed lividity consistent with position found, toxicology consistent with self-administration. Equivocal death investigation (psychological autopsy + scene reconstruction) required when manner is uncertain. Absence of a note does NOT exclude suicide.',
  },
  {
    concept: 'staging indicators',
    category: 'staging_detection',
    facts: 'Crime scene staging: manipulation of scene to mislead. Key red flags: fixed lividity inconsistent with body position found, defensive wounds present in a staged suicide, ligature tied in a pattern impossible for self-application, postmortem injuries presented as cause of death, blood spatter inconsistent with wound locations, scene "too clean" or "too messy," evidence of surface cleaning under body, multiple mechanisms of injury inconsistent with single event.',
  },
  {
    concept: 'drowning investigation',
    category: 'manner_detection',
    facts: 'Drowning findings: waterlogged skin (washerwoman changes), white/pink frothy fluid in airways, Paltauf hemorrhages (pale subpleural), pulmonary hyperinflation. Diatoms matching the drowning source water detected in lung, bone marrow, or brain tissue are diagnostic for antemortem drowning. Dry drowning (laryngospasm, no water in lungs) occurs in ~10%. Alcohol is present in 40-50% of adult drowning deaths. Pre-immersion injuries suggest assault before submersion.',
  },
  {
    concept: 'fire death investigation',
    category: 'manner_detection',
    facts: 'Fire deaths: COHb >10% confirms victim was alive during the fire. Pugilistic attitude (flexed-limb posture) is a postmortem thermal artifact, not a fighting pose. Soot below the vocal cords confirms ante-mortem inhalation. Heat-related skull fractures/splitting are thermal artifacts. Accelerant residues should be sampled beneath the body where protected from the fire. Pre-fire blunt or sharp injuries indicate homicide before fire was set as a cover.',
  },

  // Toxicology
  {
    concept: 'carbon monoxide poisoning',
    category: 'toxicology',
    facts: 'Carbon monoxide (CO): cherry-red or pink skin and lividity. COHb >50% typically fatal; smokers tolerate higher baseline levels. CO binds hemoglobin 200x more avidly than oxygen. In fire deaths, COHb >10% = victim was alive during fire. COHb does not increase significantly postmortem. Sources: vehicle exhaust, generators, faulty heating. In suicidal CO deaths, often found in enclosed space with deliberate ignition source.',
  },
  {
    concept: 'alcohol toxicology',
    category: 'toxicology',
    facts: 'Blood alcohol concentration (BAC): 0.08 g/dL = legal impairment (US). Fatal BAC typically >0.35 g/dL but varies widely with tolerance. Vitreous humor alcohol lags 1-2h behind blood alcohol and is more resistant to postmortem artifact. Peripheral blood (femoral vein) is more reliable than central blood for postmortem BAC. Bacterial fermentation in putrefied bodies can produce up to 0.2 g/dL of endogenous alcohol artifact — must be excluded by vitreous alcohol testing.',
  },
  {
    concept: 'benzodiazepine toxicology',
    category: 'toxicology',
    facts: 'Benzodiazepines (diazepam, lorazepam, clonazepam, alprazolam): enhance GABA-mediated CNS depression. Therapeutic levels: 50-200 ng/mL. Fatal toxicity rare alone; extreme danger in combination with alcohol or opioids. In forensic context: trace levels without a known prescription are suspicious for drug-facilitated assault. Hair analysis detects use for months prior to death. Significant postmortem redistribution occurs — peripheral blood required.',
  },
  {
    concept: 'opioid toxicology',
    category: 'toxicology',
    facts: 'Opioid toxidrome: pinpoint pupils, severe respiratory depression, CNS depression. Fentanyl 50-100x more potent than morphine; blood >3 ng/mL often associated with fatality. Heroin metabolizes rapidly to 6-monoacetylmorphine (6-MAM), the specific marker for heroin use. Pulmonary edema present at autopsy. In suspected injection homicide: check hidden injection sites (between toes, scalp, groin). Naloxone reversal confirms opioid toxicity if victim survives.',
  },
  {
    concept: 'toxicology specimen collection',
    category: 'toxicology',
    facts: 'Toxicology specimen priority: peripheral blood (femoral vein) first, then urine, vitreous humor, liver (drug reservoir), bile, brain (lipophilic drugs), hair (chronic use history). Collect ALL specimens BEFORE embalming — embalming fluid destroys alcohol evidence and introduces artifact chemicals. Request postmortem redistribution-resistant matrix (vitreous) alongside all blood specimens. GC-MS or LC-MS/MS required for confirmation of immunoassay screening positives.',
  },

  // Digital evidence
  {
    concept: 'CCTV timeline analysis',
    category: 'evidence_interpretation',
    facts: 'CCTV analysis: always verify camera timestamps against an external reference (NTP server, broadcast time, known event on tape). Gaps in footage may indicate tampering or system failure — both require investigation. Synchronize multiple cameras before cross-location timeline reconstruction. Person departing without being seen returning is significant. Last confirmed alive time from CCTV directly constrains the ante-mortem window for PMI correlation.',
  },
  {
    concept: 'mobile phone evidence',
    category: 'evidence_interpretation',
    facts: 'Mobile evidence: call records establish last contact time. Cell tower data provides location radius (100m-2km urban, wider rural). SMS/messaging timestamps are UTC — apply timezone correction. App data (GPS, accelerometer, messaging) can precisely locate individuals. Phone powered off or SIM removed: last cell ping time is significant. Phone found abandoned or at scene without owner is anomalous and warrants investigation. IMEI persists even after SIM swap.',
  },
  {
    concept: 'trace evidence Locard exchange',
    category: 'evidence_interpretation',
    facts: 'Locard\'s exchange principle: every physical contact between two objects results in a transfer of material from each to the other. Trace evidence: fibers (identify clothing type and transfer direction), hair (nuclear DNA from root, mitochondrial from shaft), glass (fracture patterns indicate force direction), paint (vehicle layer analysis), soil (botanical and mineral composition). Touch DNA from skin cells on ligatures, weapons, or door handles can establish contact without visible trace.',
  },
  {
    concept: 'wound track interpretation',
    category: 'injury_pattern',
    facts: 'Wound track direction reveals the relative position of attacker and victim at time of wounding. Downward-directed stab tracks are difficult to self-inflict when the victim is tall. Multiple entries from different angles indicate victim movement or multiple assailants. Perimortem versus postmortem fractures: perimortem fractures show bone elasticity (green-stick pattern), hemorrhage into fracture margins. Document: organs traversed, intermediate structures struck, projectile recovery location.',
  },
]

// ─── Embedding helpers ────────────────────────────────────────────────────────

/**
 * Real semantic embeddings via HuggingFace sentence-transformers.
 * Returns null if HF_TOKEN is not configured.
 */
async function semanticEmbed(text: string): Promise<number[] | null> {
  const token = process.env.HF_TOKEN
  if (!token) return null
  try {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: text }),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    // Returns [[...384 floats...]]
    const vec: number[] = Array.isArray(data[0]) ? data[0] : data
    const norm = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0))
    return norm > 0 ? vec.map((v: number) => v / norm) : vec
  } catch {
    return null
  }
}

/**
 * TF-IDF style keyword fallback: scores each knowledge node by term overlap
 * with the query. Used when Supabase pgvector is unavailable.
 */
function keywordRetrieve(query: string, count = 5): typeof FORENSIC_KNOWLEDGE_BASE {
  const qTokens = new Set(
    query.toLowerCase().split(/\W+/).filter(t => t.length > 3)
  )
  const scored = FORENSIC_KNOWLEDGE_BASE.map(node => {
    const haystack = `${node.concept} ${node.facts}`.toLowerCase()
    let hits = 0
    qTokens.forEach(tok => { if (haystack.includes(tok)) hits++ })
    return { node, hits }
  })
  return scored
    .filter(s => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, count)
    .map(s => s.node)
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

export interface KnowledgeNode {
  id: string
  concept: string
  category: string
  facts: string
  similarity: number
}

/**
 * Retrieve relevant forensic knowledge for LLM context injection.
 *
 * Strategy (in order):
 *   1. HuggingFace semantic embeddings + Supabase pgvector (best quality)
 *   2. Hash embeddings + Supabase pgvector (if HF_TOKEN missing)
 *   3. Keyword overlap against in-memory knowledge base (no Supabase needed)
 */
export async function retrieveForensicContext(
  query: string,
  threshold = 0.3,
  count = 5
): Promise<string> {
  // ── Path 1 & 2: pgvector retrieval ────────────────────────────────────────
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient()

      // Try real semantic embedding first, fall back to hash
      let embedding = await semanticEmbed(query)
      if (!embedding) embedding = hashEmbed(query)

      const { data, error } = await supabase.rpc('match_knowledge', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: count,
      })

      if (!error && data?.length) {
        return (data as KnowledgeNode[])
          .map(n => `[${n.category.toUpperCase()}] ${n.concept.toUpperCase()}: ${n.facts}`)
          .join('\n\n')
      }
    } catch {}
  }

  // ── Path 3: keyword fallback (always works, no external deps) ─────────────
  const nodes = keywordRetrieve(query, count)
  if (!nodes.length) return ''
  return nodes
    .map(n => `[${n.category.toUpperCase()}] ${n.concept.toUpperCase()}: ${n.facts}`)
    .join('\n\n')
}

/**
 * Hash-based embedding kept as fallback when HF_TOKEN is absent.
 * Character bigram bag-of-words, L2-normalised to 384 dims.
 * Works for exact-vocabulary matches but misses semantic synonyms.
 */
function hashEmbed(text: string): number[] {
  const DIMS = 384
  const vec = new Array<number>(DIMS).fill(0)
  const tokens = text.toLowerCase().split(/\W+/).filter(t => t.length > 2)
  for (const token of tokens) {
    for (let i = 0; i < token.length; i++) {
      const a = token.charCodeAt(i)
      const b = i + 1 < token.length ? token.charCodeAt(i + 1) : 0
      const dim = Math.abs(a * 31 + b * 17 + i * 7) % DIMS
      vec[dim] += 1.0 / tokens.length
    }
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  return norm > 0 ? vec.map(v => v / norm) : vec
}

// ─── Seeding ──────────────────────────────────────────────────────────────────

export async function seedKnowledgeBase(): Promise<{ seeded: number; skipped: number; errors: number }> {
  const supabase = createClient()
  let seeded = 0
  let skipped = 0
  let errors = 0

  for (const item of FORENSIC_KNOWLEDGE_BASE) {
    try {
      // Check if concept already exists with an embedding
      const { data: existing } = await supabase
        .from('knowledge_nodes')
        .select('id, embedding')
        .eq('concept', item.concept)
        .single()

      if (existing?.embedding) {
        skipped++
        continue
      }

      const embedding = hashEmbed(item.facts)
      if (!embedding.length) { errors++; continue }

      const { error } = await supabase.from('knowledge_nodes').upsert(
        {
          concept: item.concept,
          category: item.category,
          facts: item.facts,
          sources: null,
          embedding,
        },
        { onConflict: 'concept' }
      )

      if (error) { errors++; } else { seeded++ }
    } catch {
      errors++
    }
  }

  return { seeded, skipped, errors }
}

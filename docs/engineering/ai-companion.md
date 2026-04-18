# Ask Vela — AI Companion

Technical reference for Vela's conversational health companion. Located in `src/App.jsx`, lines 779–1475.

## What it is

A **rule-based conversational system** — not a large language model. Ask Vela layers three data sources to generate personalized, research-backed responses:

1. **Personal data** — user's log history (mood, energy, symptoms, triggers, notes)
2. **Clinical knowledge base** — 15 symptoms and 5 triggers with prevalence, science, strategies, and doctor-visit triggers
3. **Stage context** — perimenopause / postmenopause / surgical menopause guidance

The result reads like a well-informed health companion who actually knows your data.

## Why rule-based (not LLM)

- **Privacy:** no data leaves the device
- **Reliability:** every response is auditable and clinically reviewed
- **Cost:** zero per-query inference cost
- **Latency:** instant
- **Safety:** no hallucinated medical claims

## Architecture

```
user input
    ↓
matchQuestion(input)                     ← regex router (line 1008)
    ↓  returns { handler, param, timeRange }
generateResponse(handler, logs, profile) ← dispatcher (line 1106)
    ↓
handler function
    ├─ analyze logs (filtered by timeRange)
    ├─ lookup SYMPTOM_KNOWLEDGE / TRIGGER_KNOWLEDGE
    ├─ inject getStageContext(stage, symptom)
    ├─ append doctor nudge if severity threshold met
    └─ append suggestFollowUp()
    ↓
response string → UI
    ↓
cache _lastHandler, _lastParam for follow-ups
```

### Conversational memory

Module-level variables (around line 826):

```js
let _lastHandler = null;
let _lastParam = null;
```

When the user says "tell me more" or "why?", `matchQuestion` detects the follow-up and re-runs the previous handler.

## `matchQuestion` — the router

Located at line 1008. A waterfall of pattern matches, first match wins.

### Order of detection

1. **Follow-up phrases** — "tell me more", "explain", "go on", "elaborate", "more"
2. **Time range** — "this month" | "last month" | "last week" → sets `timeRange` flag
3. **Compound: symptom-triggers** — "What triggers my [symptom]?"
4. **Compound: trigger-symptom** — "How does [trigger] affect my [symptom]?"
5. **Single symptom** — any symptom name alone → `symptomTrend`
6. **Single trigger** — any trigger name alone → `triggerImpact`
7. **Intent patterns** (regex) — see table below
8. **Fallback** → `recent` (weekly summary)

### Intent patterns

| Pattern | Handler |
|---------|---------|
| `/trigger\|worst\|cause\|why\|making.*worse/` | `triggers` |
| `/better\|worse\|improv\|progress\|trend\|trajectory/` | `trend` |
| `/doctor\|appointment\|visit\|tell.*doc\|prepare/` | `doctor` |
| `/best.*day\|worst.*day\|day.*week\|[monday-sunday]/` | `bestWorstDays` |
| `/mood\|how.*feel\|emotion\|happy\|sad/` | `mood` |
| `/energy\|tired\|exhaust\|depleted/` | `energy` |
| `/week\|how.*doing\|overview\|summary\|recap/` | `recent` |
| `/pattern\|notice\|insight\|connection\|correlat/` | `patterns` |
| `/help\|what can\|how do you work\|capable/` | `help` |
| `/thank\|great\|awesome\|helpful/` | `thanks` |

## Knowledge base

### `SYMPTOM_KNOWLEDGE` (line 834)

15 symptoms, each with this shape:

```js
"hot flash": {
  prevalence: "Up to 80% of women experience hot flashes...",
  science: "Hot flashes are caused by changes in the hypothalamus...",
  strategies: [
    "Layered clothing and keeping a room cool...",
    "Deep slow breathing (6-8 breaths/min)...",
    "CBT for hot flashes has good evidence...",
    "Regular aerobic exercise..."
  ],
  stages: {
    perimenopause: "Hot flashes often peak in late perimenopause...",
    postmenopause: "For most women, hot flashes gradually decrease...",
    surgical:      "Surgical menopause often causes more sudden onset..."
  },
  whenToSeeDoc: "If hot flashes are disrupting sleep..."
}
```

**Covered symptoms:** hot flash, night sweat, brain fog, fatigue, anxiety, joint pain, poor sleep, irritability, depression, palpitation, headache, weight change, low libido, vaginal dryness, bloating.

### `TRIGGER_KNOWLEDGE` (line 971)

5 triggers, each with:

```js
caffeine: {
  science: "Caffeine stimulates the sympathetic nervous system...",
  tip: "Try cutting off caffeine by noon...",
  nuance: "Individual tolerance varies widely..."
}
```

**Covered triggers:** caffeine, alcohol, exercise, stress, sleep.

### `getSymptomKnowledge(symptomName)` (line 943)

Fuzzy lookup with 3-step fallback:

1. Direct lookup (case-insensitive)
2. Partial substring match either direction
3. Alias map: `"insomnia" → "poor sleep"`, `"migraine" → "headache"`, `"muscle ache" → "joint pain"`, `"memory lapse" → "brain fog"`, etc.

Returns `null` for unmapped symptoms.

### `getStageContext(stage, symptom)` (line 1000)

Given the user's journey stage (from profile) and a symptom, returns a formatted stage-specific string like:

```
📋 Hot flashes often peak in late perimenopause when estrogen fluctuates...
```

Appended to every symptom handler response.

## Handlers

Located in `generateResponse`, line 1106. All handlers follow this response pattern:

```
📊 data (statistics from filtered logs)
📚 science (from knowledge base)
💡 strategy (actionable tip)
📋 stage context (via getStageContext)
⚕️ doctor nudge (if severity threshold met)
💬 follow-up suggestion (via suggestFollowUp)
```

### Handler catalog

| Handler | Trigger | What it returns |
|---------|---------|------------------|
| `symptomTrend` | Any symptom name | 2-week frequency trend, severity delta, research, stage guidance, doctor nudge if ≥7 days or severity ≥7/10 |
| `triggerImpact` | Any trigger name | Impact classification (worsens/helps/neutral), symptom counts with/without, mood correlation, energy delta, science + tip |
| `symptomTriggers` | "What triggers my X?" | Per-trigger % occurrence with/without, ranked by effect, stage context |
| `triggerSymptom` | "How does X affect my Y?" | Direct cross-reference: % points difference, connection assessment |
| `mood` | Mood intent | 2-week avg mood (0–4), distribution, trend vs prior, energy correlation, research, tailored advice |
| `energy` | Energy intent | 2-week avg energy, trend vs prior, sleep-energy correlation, research, advice (thyroid suggestion if avg ≤1.5) |
| `trend` | Improvement intent | Direction (improving/worse/steady), symptom count delta, mood delta, research context |
| `doctor` | Doctor prep intent | Bullet summary, top 2 correlations, trend, top symptom + whenToSeeDoc, PDF tip |
| `bestWorstDays` | Day-of-week intent | Best/worst day of week by mood, symptoms, energy; chronobiology tip |
| `patterns` | Pattern intent | Up to 3 insights from `analyzePatterns` + `analyzeCorrelations` |
| `triggers` | General triggers intent | Worst triggers ranked, helpers ranked, research on top trigger |
| `help` | Help intent | Capability list with example questions |
| `thanks` | Thanks intent | One of 4 random positive responses |
| `recent` | Fallback/summary | Weekly recap |

### `suggestFollowUp()` helper (around line 1116)

After every response, picks a contextually relevant next question:

```
💬 Try asking: "What should I tell my doctor?"
```

Keeps the conversation going without requiring the user to know what to ask next.

## How to extend

### Add a new symptom

1. **Add to `SYMPTOMS`** (line 22) — emoji, name, category
2. **Add to `AI_SYMPTOM_NAMES`** (line 812) — canonical name + aliases for matcher
3. **Add entry to `SYMPTOM_KNOWLEDGE`** (line 834) — prevalence, science, 3–4 strategies, stages (all 3), whenToSeeDoc
4. **Add aliases if needed** in `getSymptomKnowledge` alias map (line 952)
5. **Test:** send "What triggers my [new symptom]?" and "Tell me about [new symptom]"

### Add a new trigger

1. **Add to `AI_TRIGGER_NAMES`** (line 824)
2. **Add entry to `TRIGGER_KNOWLEDGE`** (line 971) — science, tip, nuance
3. **Update `symptomTriggers` handler** (line 1149) — add trigger to the iteration array
4. **Update log filtering** (lines 1155–1162) — add conditional for how trigger is stored in `l.context`
5. **Test:** "How does [new trigger] affect me?" and "What triggers my [symptom]?" should surface it

## Quality principles

- **Every clinical claim must be supported by the evidence base.** Daily lessons, knowledge base entries, and CBT content have all been audited for consistency with NAMS, Mayo Clinic, and NHS guidelines. Cross-check new content before shipping.
- **Never promise outcomes.** Strategies are "evidence-based" or "shown to help many women," not "will fix your X."
- **Always layer personal data with general knowledge.** Pure statistics without context feels sterile; pure knowledge without their data feels generic. The combination is the product.

## Related docs

- [architecture.md](architecture.md) — overall codebase structure
- [community-firebase.md](community-firebase.md) — the separate community moderation system

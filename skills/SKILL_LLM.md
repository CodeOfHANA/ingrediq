# IngredIQ — LLM Integration Skill File

## Runtime
All LLM calls go through the **Supabase Edge Function** (Deno runtime).
File: `supabase/functions/analyze-ingredients/index.ts`
- The Next.js API route `/api/analyze` is a thin proxy to this function
- The Next.js API route `/api/chat` is a thin proxy to this function in chat mode
- `GROQ_API_KEY` is in Supabase Vault secrets — never in any file

## Models
- Analysis: `llama-3.3-70b-versatile` — temperature 0.1 (consistent structured output)
- Chat: `llama-3.3-70b-versatile` — temperature 0.3 (more conversational)

## Edge Function: Two Modes

### Analysis Mode (default)
POST body: `{ ingredientsText, profile }`
Returns: structured `ScanResult` JSON

### Chat Mode
POST body: `{ mode: "chat", messages: [{role, content}], ingredientsText, profile }`
Returns: `{ reply: string }`

## Analysis System Prompt Structure

The system prompt has eight sections:

### 1. Core rules
```
You are IngredIQ, a personal ingredient safety analyzer.
USER PROFILE: [JSON]
Check conflicts with: medical conditions, medications, lab values, allergies, religious restrictions, presets.
Rules: never diagnose, flag aliases and E-numbers, most restrictive preset wins.
Hidden alias examples: sugar has 40+ names (dextrose, maltose, HFCS, corn syrup, etc.)
```

### 2. E-Number Quick Reference
```
HALAL-HARAM: E120 (cochineal), E441 (gelatin), E542 (bone phosphate),
  E631 (disodium inosinate), E901 (beeswax), E904 (shellac), E471, E470a/b
VEGAN-ALERT: All above + E322 (lecithin), E966 (lactitol), E1105 (lysozyme),
  E270 (lactic acid), E920 (L-cysteine), casein, whey, honey
HEALTH-CONCERN: E211, E621, E951, E102, E110, E129, E320, E321, E250, E171
```

### 3. Medication-Food Interactions
```
- Warfarin → high-Vitamin K foods at HIGH
- MAOIs → tyramine-rich foods at HIGH
- Statins → grapefruit at HIGH
- Metformin → alcohol at MEDIUM
- ACE inhibitors → potassium if kidney disease at HIGH
- SSRIs → St. John's Wort at HIGH
- Thyroid meds (levothyroxine) → soy, calcium-fortified foods at MEDIUM
```

### 4. Lab Value Context
```
- blood_sugar_mmol > 7.0 → upgrade sugar flags to AVOID
- cholesterol_mmol > 5.2 → upgrade sat fat / trans fat / palm oil / coconut oil to HIGH
- sodium_mmol > 145 OR kidney_disease → upgrade sodium/salt/MSG to HIGH
- creatinine_umol > 110 → flag potassium-rich at MEDIUM+
- potassium_mmol > 5.0 → flag ALL potassium-rich at HIGH
```

### 5. Multi-Language Handling
Translates German, French, and Arabic ingredient names. Key terms like
Schweinefett (pork fat → HARAM) are explicitly included.

### 6. Allergen Cross-Contamination
Detects "may contain", "traces of", "produced in a facility that processes"
phrases. Flags at MEDIUM if allergen matches user's list, HIGH if ingredient
IS the allergen.

### 7. Verdict Decision Tree
```
AVOID: any HIGH flag from allergy, medication, medical condition, or religious preset
CAUTION: any HIGH flag for lifestyle-only, OR 2+ MEDIUM flags
SAFE: no HIGH flags, at most 1-2 LOW flags
```

### 8. Chain-of-Thought + One-Shot Example
The prompt includes an 8-step reasoning process (parse → presets → allergies →
meds → labs → cross-contamination → verdict rules → JSON output) and a concrete
example input/output pair (Nutella-like product for halal+vegan user with
elevated cholesterol).

### Required JSON output schema
```json
{
  "verdict": "SAFE" | "CAUTION" | "AVOID",
  "flags": [{
    "ingredient": "...",
    "reason": "...",
    "severity": "HIGH" | "MEDIUM" | "LOW",
    "conflicts_with": "..."
  }],
  "summary": "2-3 sentences, always ends with medical disclaimer",
  "alternative_suggestion": "only if verdict is AVOID"
}
```

## Chat System Prompt
```
You are IngredIQ assistant. The user just received a verdict on a product.
Answer follow-up questions in plain, friendly English (2-4 sentences).
Never diagnose. Frame as "conflicts with your profile".
Profile: [JSON]
Ingredients analysed: [first 800 chars]
This is not medical advice.
```

## JSON Response Parsing (Edge Function)
Always parse defensively:
```typescript
function parseLLMResponse(raw: string): ScanResult {
    try { return JSON.parse(raw) }
    catch {
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) { try { return JSON.parse(match[0]) } catch {} }
    }
    return { verdict: 'CAUTION', flags: [], summary: 'Analysis could not be completed...' }
}
```

## Error Handling
- Analysis: retry once after 2s on failure — never crash
- Chat: single attempt, return friendly error message on failure
- Never expose raw Groq errors to the user

## Token Guidelines
- Average ingredient list: ~300 tokens input
- System prompt with profile: ~600 tokens (larger with medication/lab sections)
- Response: ~400 tokens
- Groq free tier: 14,400 requests/day

---

## Legacy: Python / Streamlit (not active)

```python
# Python client (legacy Streamlit app)
from groq import Groq
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
ANALYSIS_MODEL = "llama-3.3-70b-versatile"
UTILITY_MODEL  = "llama-3.1-8b-instant"
```

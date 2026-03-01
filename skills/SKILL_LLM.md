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

The system prompt has four sections:

### 1. Core rules
```
You are IngredIQ, a personal ingredient safety analyzer.
USER PROFILE: [JSON]
Check conflicts with: medical conditions, medications, lab values, allergies, religious restrictions, presets.
Rules: never diagnose, flag aliases and E-numbers, most restrictive preset wins.
Return ONLY valid JSON in exact schema.
```

### 2. Medication-Food Interactions
```
MEDICATION-FOOD INTERACTIONS:
The user takes: [medications list]
- Warfarin/blood thinners → flag high-Vitamin K foods (kale, spinach, green tea) at HIGH
- MAOIs/antidepressants → flag tyramine-rich foods (aged cheese, cured meats, fermented) at HIGH
- Statins → flag grapefruit, grapefruit juice at HIGH
- Metformin → flag alcohol-containing ingredients
- ACE inhibitors → flag high-potassium if kidney disease present
- SSRIs → flag St. John's Wort at HIGH
```

### 3. Lab Value Context
```
LAB VALUE CONTEXT:
User's values: [lab_values JSON]
- blood_sugar_mmol > 7.0 → upgrade sugar/glucose/HFCS flags to AVOID
- cholesterol_mmol > 5.2 → upgrade saturated fat / trans fat / palm oil to HIGH
- sodium_mmol > 145 OR kidney_disease → upgrade sodium/salt/MSG to HIGH
- creatinine_umol > 110 → flag potassium-rich ingredients at MEDIUM+
- potassium_mmol > 5.0 → flag ALL potassium-rich foods at HIGH
```

### 4. Required JSON output schema
```json
{
  "verdict": "SAFE" | "CAUTION" | "AVOID",
  "flags": [{
    "ingredient": "...",
    "reason": "...",
    "severity": "HIGH" | "MEDIUM" | "LOW",
    "conflicts_with": "..."
  }],
  "summary": "2-3 sentence plain English summary",
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

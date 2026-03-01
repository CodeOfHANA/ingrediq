# IngredIQ — LLM Integration Skill File

## Models
- Analysis model: llama-3.3-70b-versatile  (ingredient analysis, verdict generation)
- Utility model:  llama-3.1-8b-instant     (OCR text cleanup, ingredient list formatting)
- One Groq API key works for both models

## Client Initialization
```python
from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

ANALYSIS_MODEL = "llama-3.3-70b-versatile"
UTILITY_MODEL  = "llama-3.1-8b-instant"
```

## Analysis Call — Ingredient Safety Check
Use ANALYSIS_MODEL for this. Always temperature=0.1 for consistent structured output.

```python
def analyze_ingredients(ingredients_text: str, user_profile: dict) -> dict:
    system_prompt = f"""
You are IngredIQ, a personal ingredient safety analyzer.

USER PROFILE:
{json.dumps(user_profile, indent=2)}

Your job is to analyze the provided ingredient list strictly against this
user's personal profile. Check for conflicts with their:
- Medical conditions
- Current medications
- Lab report values
- Allergies and intolerances
- Religious dietary restrictions
- Lifestyle and dietary preferences
- Active preset profiles (halal, vegan, kosher, jain etc.)

IMPORTANT RULES:
- Never diagnose. Always frame findings as "conflicts with your profile"
- Flag hidden ingredient aliases (e.g. sugar has 40+ names)
- Flag E-numbers that may violate religious or dietary presets
- When preset is active, apply its FULL ruleset — not just obvious items
- Most restrictive rule wins when multiple presets are active
- Always add: "This is not medical advice. Consult your doctor."

You MUST return ONLY valid JSON. No explanation outside the JSON block.

Return this exact structure:
{{
  "verdict": "SAFE" | "CAUTION" | "AVOID",
  "flags": [
    {{
      "ingredient": "ingredient name as found in list",
      "reason": "plain English explanation of the conflict",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "conflicts_with": "which profile rule or preset triggered this"
    }}
  ],
  "summary": "2-3 sentence plain English overall explanation for the user",
  "alternative_suggestion": "suggest safer product type — only include if verdict is AVOID, otherwise omit this field"
}}
"""
    response = client.chat.completions.create(
        model=ANALYSIS_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Analyze these ingredients:\n\n{ingredients_text}"}
        ],
        temperature=0.1,
        max_tokens=1500
    )
    return parse_llm_response(response.choices[0].message.content)
```

## Utility Call — OCR Text Cleanup
Use UTILITY_MODEL for this. Cleans raw OCR output before sending to analysis.

```python
def clean_ocr_text(raw_text: str) -> str:
    response = client.chat.completions.create(
        model=UTILITY_MODEL,
        messages=[
            {
                "role": "system",
                "content": """You are a text cleanup assistant.
You will receive raw OCR text extracted from a product ingredient label.
Clean it up: fix obvious OCR errors, remove page numbers or irrelevant text,
format as a clean comma-separated ingredient list.
Return ONLY the cleaned ingredient list. Nothing else."""
            },
            {"role": "user", "content": raw_text}
        ],
        temperature=0.0,
        max_tokens=500
    )
    return response.choices[0].message.content.strip()
```

## JSON Response Parsing
Always use this parser — never assume LLM returns perfect JSON.

```python
import json
import re

def parse_llm_response(raw: str) -> dict:
    try:
        # Try direct parse first
        return json.loads(raw)
    except json.JSONDecodeError:
        try:
            # Extract JSON block if wrapped in markdown
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                return json.loads(match.group())
        except:
            pass
    # Return safe fallback if all parsing fails
    return {
        "verdict": "CAUTION",
        "flags": [],
        "summary": "Analysis could not be completed. Please try again or consult the ingredient list manually.",
        "alternative_suggestion": None
    }
```

## Error Handling Rules
- If Groq API call fails: retry once after 2 seconds
- If retry fails: return fallback CAUTION response — never crash
- If JSON parsing fails: return fallback CAUTION response
- Always log errors to console in development mode
- Never show raw API errors to the user

## Token Usage Guidelines
- Average ingredient list: ~300 tokens input
- System prompt with profile: ~500 tokens
- Response: ~400 tokens
- Total per scan: ~1200 tokens
- Groq free tier: 14,400 requests/day — more than enough for hackathon

## Temperature Settings
- Ingredient analysis: 0.1 (consistent, reliable)
- OCR cleanup: 0.0 (deterministic)
- Never use temperature above 0.3 for any IngredIQ task

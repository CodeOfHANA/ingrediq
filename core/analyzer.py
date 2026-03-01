import json
import os
import re
import time

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

ANALYSIS_MODEL = "llama-3.3-70b-versatile"
UTILITY_MODEL = "llama-3.1-8b-instant"

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


_FALLBACK = {
    "verdict": "CAUTION",
    "flags": [],
    "summary": (
        "Analysis could not be completed. "
        "Please try again or consult the ingredient list manually."
    ),
    "alternative_suggestion": None
}


def parse_llm_response(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        try:
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                return json.loads(match.group())
        except Exception:
            pass
    return _FALLBACK.copy()


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
    client = _get_client()

    def _call():
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

    try:
        return _call()
    except Exception as e:
        print(f"Groq analysis error (attempt 1): {e}")
        time.sleep(2)
        try:
            return _call()
        except Exception as e2:
            print(f"Groq analysis error (attempt 2): {e2}")
            return _FALLBACK.copy()


def process_manual_input(text: str) -> dict:
    cleaned = text.strip().replace("\n", ", ").replace("  ", " ")
    return {
        "ingredients_text": cleaned,
        "product_name": None,
        "source": "manual",
        "confidence": "HIGH"
    }

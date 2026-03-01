# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What Is IngredIQ
A personal ingredient intelligence platform that cross-references product ingredients against a user's unique health profile and returns an instant, personalized safety verdict: **SAFE / CAUTION / AVOID**.

**Context:** 100x Engineers GenAI Mini-Hackathon — Open Category

---

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
streamlit run app.py

# Run with explicit Python version
python -m streamlit run app.py
```

> **First-time setup:** Copy `.env.txt` to `.env` and fill in all keys before running.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Streamlit (multipage) |
| Primary LLM | Groq — `llama-3.3-70b-versatile` |
| Utility LLM | Groq — `llama-3.1-8b-instant` |
| OCR | Tesseract via `pytesseract` |
| Barcode decode | `pyzbar` + OpenCV |
| Barcode data | Open Food Facts API (free, no key) |
| Database | Supabase (Frankfurt region) |
| Local fallback | JSON files in `data/` |
| Language | Python 3.11+ / Windows |

---

## Architecture

All three input modes (barcode → Open Food Facts, photo → OCR, manual text) converge to an identical **Output Contract** before any LLM call:

```python
{
    "ingredients_text": str,   # clean, comma-separated
    "product_name": str | None,
    "source": "barcode" | "ocr" | "manual",
    "confidence": "HIGH" | "MEDIUM" | "LOW"
}
```

The Output Contract is passed to Groq (`llama-3.3-70b-versatile`) along with the user's full profile JSON in the system prompt. The LLM returns a structured verdict JSON — never free text.

Results are saved to **Supabase first, local JSON fallback second**. The app must never crash on API failure.

---

## Project Structure

```
ingrediq/
├── app.py                  # Streamlit entry point + home page
├── pages/
│   ├── 1_Profile.py        # Profile setup + preset selection
│   ├── 2_Scan.py           # Barcode + OCR + manual scanning + verdict display
│   └── 3_History.py        # Past scan history
├── core/
│   ├── analyzer.py         # Groq LLM calls + verdict logic
│   ├── ocr.py              # Tesseract OCR + image preprocessing
│   ├── barcode.py          # pyzbar decode + Open Food Facts API
│   ├── presets.py          # PRESET_PROFILES and MEDICAL_PRESETS dicts
│   └── supabase_client.py  # All Supabase DB operations + local fallbacks
├── data/
│   ├── user_id.txt         # Auto-generated UUID (no auth system)
│   ├── profiles/local.json # Local profile fallback
│   └── history/local.json  # Local scan history fallback
├── skills/                 # Detailed implementation reference files
└── assets/logo.png
```

---

## Key Design Principles

1. All three input paths produce **identical Output Contract** before the LLM call
2. LLM always returns **structured JSON** — parse defensively, never assume perfect output
3. User profile always passed as **JSON in the Groq system prompt**
4. **Supabase is primary** — local JSON (`data/`) is always the fallback
5. **Never crash on API failure** — degrade gracefully, show user-friendly messages
6. **Never diagnose** — always frame findings as "conflicts with your profile"
7. Always show the **medical disclaimer** at the bottom of results
8. **Demo must work offline** — local fallback must cover this
9. Temperature **0.1** for ingredient analysis, **0.0** for OCR cleanup

---

## Environment Variables

```bash
GROQ_API_KEY=

SUPABASE_URL=https://agomwlvmhstadcpldwbm.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
SUPABASE_DB_PASSWORD=

TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe

APP_ENV=development
```

---

## Supabase Tables

| Table | Purpose | PK |
|---|---|---|
| `profiles` | User health profiles (no auth — identified by `user_id` UUID) | `user_id` text unique |
| `scan_history` | Every scan result with full LLM response | `id` uuid |
| `products_cache` | Open Food Facts results cached by barcode | `barcode` text |

---

## Preset System

Multiple presets can be active simultaneously. **Most restrictive rule always wins.**

- **Religious:** `halal`, `kosher`, `jain`, `hindu_vegetarian`, `buddhist_strict`
- **Dietary:** `vegan`, `vegetarian`, `pescatarian`, `keto`, `gluten_free`, `dairy_free`, `low_fodmap`
- **Medical:** `diabetes`, `hypertension`, `kidney_disease`

Full rulesets with all excluded ingredients and E-numbers are in `skills/SKILL_PROFILES.md` and implemented in `core/presets.py`.

---

## UI Color System

```python
COLOR = {
    "safe":    "#059669",  # SAFE verdict
    "caution": "#d97706",  # CAUTION verdict
    "avoid":   "#dc2626",  # AVOID verdict
    "primary": "#4f46e5",  # Indigo accent
    "bg_light":"#f0f0ff",  # Card backgrounds
}
```

---

## Plan & Review Workflow

### Before Starting Any Work
1. Enter plan mode and write the plan to `.claude/tasks/TASK_NAME.md`
2. The plan must include: implementation steps with reasoning, tasks broken into small units, any new packages or APIs needed
3. Think MVP — do not over-engineer
4. **Wait for explicit approval before writing a single line of code**

### While Implementing
- Update the plan file as you go
- After each completed step, append to **Implementation Notes** in the task file:
  - What was built, files created/modified, decisions made, any deviations and why

### Task File Format
```
.claude/tasks/TASK_NAME.md

## Goal
## Plan
## Status
- [ ] Step 1
- [x] Step 2 — completed
## Implementation Notes
### Step 2 — completed YYYY-MM-DD
What was built, files changed, decisions made
```

---

## SKILL Files Reference

Always read the relevant file in `skills/` before coding any module:

| Task | Read First |
|---|---|
| Any LLM / Groq code | `skills/SKILL_LLM.md` |
| Profile or preset code | `skills/SKILL_PROFILES.md` |
| OCR or barcode code | `skills/SKILL_SCANNING.md` |
| Any UI / Streamlit code | `skills/SKILL_UI.md` |
| Any database code | `skills/SKILL_SUPABASE.md` |
| Starting a new module | `skills/SKILL.md` |

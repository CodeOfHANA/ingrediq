# IngredIQ — Master Project Skill File

## What This Is
IngredIQ is a personal ingredient intelligence platform that cross-references
product ingredients against a user's unique health profile and returns a
personalized, explainable safety verdict in real time.

## Core Concept
Every product has an ingredients list. Every person has a unique health context.
IngredIQ connects these two at the moment of decision — point of purchase or
consumption — and delivers a personalized SAFE / CAUTION / AVOID verdict with
specific, human-readable reasoning.

## Core User Flow
1. User sets up a personal health profile (one time)
2. User scans product via:
   - Barcode scan → Open Food Facts API
   - Photo of label → OCR (Tesseract via pytesseract)
   - Manual text input → direct paste
3. All three input paths produce one output: ingredient list string
4. Groq LLM analyzes ingredients against the user's full profile
5. App returns traffic light verdict with explainable flags and reasoning

## Tech Stack
- Frontend: Streamlit (multipage app)
- Primary LLM: Groq API — llama-3.3-70b-versatile (ingredient analysis)
- Utility LLM: Groq API — llama-3.1-8b-instant (text cleanup, formatting)
- OCR: Tesseract via pytesseract (path set via .env)
- Barcode decode: pyzbar + OpenCV
- Barcode data: Open Food Facts API (free, no key needed)
- Database: Supabase (profiles, scan_history, products_cache)
- Local fallback: JSON files in data/ folder
- Environment: python-dotenv
- Language: Python 3.11+

## Project Folder Structure
```
ingrediq/
├── SKILL.md
├── SKILL_LLM.md
├── SKILL_PROFILES.md
├── SKILL_SCANNING.md
├── SKILL_UI.md
├── SKILL_SUPABASE.md
├── .env
├── requirements.txt
├── app.py                  # Main Streamlit entry point
├── pages/
│   ├── 1_Profile.py        # Profile setup and management
│   ├── 2_Scan.py           # Barcode + OCR + manual scanning
│   └── 3_History.py        # Past scan history
├── core/
│   ├── analyzer.py         # Groq LLM integration and verdict logic
│   ├── ocr.py              # Tesseract OCR logic and preprocessing
│   ├── barcode.py          # Barcode decoding + Open Food Facts API
│   ├── presets.py          # All dietary and medical preset profiles
│   └── supabase_client.py  # Supabase client and all DB operations
├── data/
│   ├── profiles/           # Local JSON profile fallback
│   └── history/            # Local JSON scan history fallback
└── assets/
    └── logo.png
```

## Key Design Principles
1. All three input paths must produce identical output format before LLM call
2. LLM always returns structured JSON — never free text
3. User profile is always passed as structured JSON in the system prompt
4. Preset dietary profiles are combinable — most restrictive rule always wins
5. Supabase is primary storage — local JSON is always the fallback
6. Never crash on API failure — always degrade gracefully
7. Never diagnose — always frame as "conflicts with your profile"
8. Always show disclaimer that this is not medical advice
9. Health data never leaves the device except for the Groq API call
10. Demo must work offline if needed — local fallback covers this

## Environment Variables Required
```
GROQ_API_KEY=
SUPABASE_URL=https://agomwlvmhstadcpldwbm.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
SUPABASE_DB_PASSWORD=
TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe
APP_ENV=development
```

## Requirements.txt
```
streamlit
groq
pytesseract
Pillow
opencv-python
pyzbar
requests
supabase
python-dotenv
numpy
```

## Read These Files Before Coding Any Module
- Before LLM code → read SKILL_LLM.md
- Before profile/preset code → read SKILL_PROFILES.md
- Before OCR/barcode code → read SKILL_SCANNING.md
- Before any UI code → read SKILL_UI.md
- Before any database code → read SKILL_SUPABASE.md

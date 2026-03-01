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
1. User completes 2-step onboarding wizard on first visit (name + presets → allergies + medical)
2. User scans product via:
   - Barcode → Open Food Facts API (HIGH confidence)
   - Photo of label → OCR via tesseract.js WASM (MEDIUM confidence)
   - Manual text input → direct paste (LOW confidence)
3. All three input paths converge to one ingredient text string
4. Supabase Edge Function calls Groq LLM with the ingredient text + full user profile
5. App returns verdict (SAFE/CAUTION/AVOID) with explainable flags, confidence badge, share button
6. User can ask follow-up questions via AI chat (max 8 turns)
7. Every scan is saved to Supabase scan_history

## Active Tech Stack (Next.js)
- Framework: Next.js 16, App Router, Turbopack
- Styling: Custom CSS in globals.css — design tokens, no component library
- LLM: Groq llama-3.3-70b-versatile, via Supabase Edge Function (Deno runtime)
- OCR: tesseract.js (browser WASM — works deployed, no system binary)
- Barcode decode: @undecaf/zbar-wasm (server API route)
- Barcode data: Open Food Facts API (free, no key)
- Database: Supabase (Frankfurt) — profiles, scan_history, products_cache
- Security: server-only package, NEXT_PUBLIC_ prefix separation

## Active Project Structure
```
ingrediq/
├── CLAUDE.md                       # Primary instructions for Claude Code
├── skills/                         # This folder — reference files
├── .gitignore                      # Root-level exclusions (secrets, Python, CLI temp)
├── .env                            # SUPABASE_ACCESS_TOKEN — never committed
├── frontend/                       # ACTIVE APP
│   ├── app/                        # Next.js App Router pages + API routes
│   ├── components/                 # VerdictCard, FlagList, Sidebar, PresetGrid
│   ├── lib/                        # types.ts, presets.ts, supabase/server.ts, supabase/client.ts
│   └── .env.local                  # SUPABASE_SERVICE_KEY + ANON_KEY — never committed
└── supabase/
    └── functions/analyze-ingredients/
        └── index.ts                # Edge Function — LLM analysis + chat mode
```

## Key Design Principles
1. All three input paths produce the same ingredient text before LLM call
2. LLM always returns structured JSON — parse defensively, never assume perfect output
3. User profile always passed as JSON in the Groq system prompt
4. Never diagnose — always frame findings as "conflicts with your profile"
5. Never crash on API failure — degrade gracefully, show user-friendly messages
6. Always show the medical disclaimer at the bottom of results
7. `server-only` guard on Supabase server client — service key never reaches browser
8. Confidence level (HIGH/MEDIUM/LOW) is always derived from the scan source, not hardcoded

## Environment Variables
```
# Root .env (never committed)
SUPABASE_ACCESS_TOKEN=...    # CLI deploy only

# frontend/.env.local (never committed)
NEXT_PUBLIC_SUPABASE_URL=https://agomwlvmhstadcpldwbm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...     # Server-only — no NEXT_PUBLIC_ prefix

# Supabase Vault (never in any file)
GROQ_API_KEY=...
```

## Read These Files Before Coding Any Module
- Before LLM / Edge Function code → SKILL_LLM.md
- Before profile / preset code → SKILL_PROFILES.md
- Before OCR / barcode code → SKILL_SCANNING.md
- Before any UI / CSS / Next.js component code → SKILL_UI.md
- Before any API route / Supabase code → SKILL_SUPABASE.md

## Legacy: Streamlit App
The original Python/Streamlit app (`app.py`, `pages/`, `core/`) is at the repo root.
It is NOT the active app. Do not modify unless explicitly asked.

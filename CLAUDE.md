# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What Is IngredIQ
A personal ingredient intelligence platform that cross-references product ingredients against a user's unique health profile and returns an instant, personalized safety verdict: **SAFE / CAUTION / AVOID**.

**Context:** 100x Engineers GenAI Mini-Hackathon — Open Category

---

## Active App: Next.js Frontend

The active, deployed app lives in `frontend/`. The Streamlit app at the root is legacy.

```bash
# Install
cd frontend && npm install

# Run dev server (localhost:3000)
npm run dev

# Type-check (note: pre-existing TS errors in barcode/decode/route.ts are known — ignore them)
npx tsc --noEmit
```

---

## Deploy Edge Function

```bash
# From repo root — requires SUPABASE_ACCESS_TOKEN in .env
SUPABASE_ACCESS_TOKEN=$(grep -oP '(?<=SUPABASE_ACCESS_TOKEN=).*' .env | tr -d '\r') \
  npx supabase functions deploy analyze-ingredients --project-ref agomwlvmhstadcpldwbm
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Styling | Custom CSS (`globals.css`) — no component library |
| LLM | Groq `llama-3.3-70b-versatile` via Supabase Edge Function (Deno) |
| OCR | Groq Vision API (`llama-4-scout-17b`) via `/api/ocr` — server-side (replaced `tesseract.js` which fails on Vercel serverless) |
| Barcode decode | `@undecaf/zbar-wasm` (server-side API route, HEIC/HEIF supported) |
| Barcode data | Open Food Facts API |
| Database | Supabase (Frankfurt) — profiles, scan_history, products_cache |
| Security | `server-only` package prevents service key leaking to browser bundle |

---

## Frontend Architecture

```
frontend/
├── app/
│   ├── page.tsx                    # Home — onboarding wizard (new users) or normal home
│   ├── layout.tsx                  # App shell: Sidebar + BottomNav + main content
│   ├── globals.css                 # ALL styles — design tokens, components, responsive
│   ├── scan/page.tsx               # 3-tab scanning + confidence badge + chat follow-up
│   ├── profile/page.tsx            # Profile editor (presets, medical, allergies, labs)
│   ├── history/page.tsx            # Last 50 scans with stats
│   └── api/
│       ├── analyze/route.ts        # Proxy → Supabase Edge Function (analysis)
│       ├── chat/route.ts           # Proxy → Supabase Edge Function (chat mode)
│       ├── profile/route.ts        # Supabase profiles CRUD
│       ├── history/route.ts        # Supabase scan_history CRUD
│       ├── ocr/route.ts            # Groq Vision OCR: sharp preprocess → base64 → Groq llama-4-scout
│       └── barcode/
│           ├── decode/route.ts     # ZBar WASM barcode decode from image
│           └── lookup/route.ts     # Open Food Facts product lookup
├── components/
│   ├── Sidebar.tsx                 # Self-fetches profile; re-fetches on every pathname change
│   ├── BottomNav.tsx               # Mobile bottom navigation
│   ├── VerdictCard.tsx             # Verdict + confidence badge + share button
│   ├── FlagList.tsx                # Expandable ingredient flags
│   └── PresetGrid.tsx              # Dietary preset toggle grid
├── lib/
│   ├── types.ts                    # All shared TypeScript types
│   ├── presets.ts                  # PRESET_PROFILES + MEDICAL_PRESETS
│   ├── supabase/server.ts          # getServerSupabase() — import 'server-only' guard
│   └── supabase/client.ts          # getBrowserSupabase() — anon key, browser-safe
└── supabase/
    └── functions/analyze-ingredients/
        └── index.ts                # Groq LLM analysis + chat mode (Deno runtime)
```

---

## Key Architecture Patterns

### Security boundary
`lib/supabase/server.ts` uses `import 'server-only'` — the build will fail if the service key is ever accidentally imported client-side. Never use `getServerSupabase()` in components or `'use client'` files.

### Stale data prevention
Every API route returns `Cache-Control: no-store`. Every fetch call uses `cache: 'no-store'`. This is how profile/scan results stay fresh across navigation.

### Confidence tracking
Each scan source sets a confidence level that flows through to the verdict card:
- Barcode lookup (Open Food Facts hit) → `HIGH`
- Photo OCR → `MEDIUM`
- Manual text entry → `LOW`

### Auto-OCR fallback
When Open Food Facts returns 404 for a barcode, the scan page shows an inline banner with a "📸 Use Photo OCR →" button instead of a generic error. Users are never left at a dead end.

### AI chat follow-up
After a verdict, users can ask follow-up questions (max 8 turns). The edge function supports `mode: 'chat'` which uses the same Groq model at temperature 0.3 with a conversational system prompt.

---

## Edge Function: analyze-ingredients

`supabase/functions/analyze-ingredients/index.ts` (Deno runtime)

Supports two modes in the POST body:

**Analysis mode** (default):
```json
{ "ingredientsText": "...", "profile": { ... } }
```
Returns structured `ScanResult` JSON.

**Chat mode**:
```json
{ "mode": "chat", "messages": [...], "ingredientsText": "...", "profile": { ... } }
```
Returns `{ "reply": "..." }`.

The system prompt includes:
- **E-number reference table** (~30 entries classified halal-haram, vegan-alert, health-concern)
- **One-shot example** (Nutella-like product → expected JSON output)
- **Verdict decision tree** (explicit SAFE/CAUTION/AVOID rules)
- **Chain-of-thought reasoning** (8-step internal analysis before JSON output)
- Medication-food interaction rules (Warfarin, MAOIs, Statins, Metformin, ACE inhibitors, SSRIs, thyroid meds)
- Lab-value-aware severity upgrading (blood sugar, cholesterol, sodium, creatinine, potassium)
- **Multi-language handling** (German/French/Arabic ingredient translation)
- **Allergen cross-contamination** detection ("may contain traces of" warnings)
- Preset dietary/religious rules (most restrictive wins)

---

## Frontend Environment Variables

`frontend/.env.local` — never committed (covered by `.gitignore`):
```
NEXT_PUBLIC_SUPABASE_URL=https://agomwlvmhstadcpldwbm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...          # Server-only — no NEXT_PUBLIC_ prefix
```

Root `.env` — never committed:
```
SUPABASE_ACCESS_TOKEN=...         # Used only for npx supabase CLI commands
```

> **GROQ_API_KEY** is needed in two places:
> - `frontend/.env.local` → used by the Next.js `/api/ocr` route (Node.js runtime, Vercel env var in prod)
> - Supabase Vault secrets → used by the Deno edge function `analyze-ingredients`
> It is never committed to git in any file.

---

## Supabase

- Project ref: `agomwlvmhstadcpldwbm`
- Region: Frankfurt
- Tables: `profiles`, `scan_history`, `products_cache`
- `GROQ_API_KEY` is stored in Supabase Vault secrets — **never in any file**

---

## Plan & Review Workflow

### Before Starting Any Work
1. Enter plan mode and write the plan to `.claude/plans/TASK_NAME.md`
2. Include: implementation steps, files to change, any new packages
3. Think MVP — do not over-engineer
4. **Wait for explicit approval before writing a single line of code**

### Task File Format
```
## Goal
## Plan
## Status
- [ ] Step 1
- [x] Step 2 — completed
## Implementation Notes
```

---

## SKILL Files Reference

| Task | Read First |
|---|---|
| LLM / Groq / Edge Function code | `skills/SKILL_LLM.md` |
| Profile or preset code | `skills/SKILL_PROFILES.md` |
| OCR or barcode code | `skills/SKILL_SCANNING.md` |
| UI / CSS / Next.js components | `skills/SKILL_UI.md` |
| Supabase / API routes | `skills/SKILL_SUPABASE.md` |
| Security — rate limiting, auth, CORS | `skills/SKILL_SECURITY.md` |
| Starting a new module | `skills/SKILL.md` |

---

## Legacy: Streamlit App (root level)

The original Python/Streamlit app is still present at the repo root (`app.py`, `pages/`, `core/`).
It is **not the active app** — do not modify it unless explicitly asked.

```bash
pip install -r requirements.txt
streamlit run app.py
```

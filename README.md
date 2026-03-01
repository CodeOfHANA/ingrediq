# 🌿 IngredIQ — Personal Ingredient Intelligence

> Know what's in your food. Instantly. Personally.

IngredIQ is an AI-powered ingredient safety platform that cross-references any product's ingredient list against your unique health profile — allergies, medications, medical conditions, dietary restrictions, and lab values — and returns an instant, explainable **SAFE / CAUTION / AVOID** verdict.

Built for the **100x Engineers GenAI Mini-Hackathon**.

---

## ✨ Features

### Three ways to scan
| Mode | How it works |
|---|---|
| 🏷️ **Barcode** | Upload or photograph a product barcode — we decode it and look up the ingredient list via Open Food Facts automatically |
| 📸 **Photo OCR** | Photograph the ingredient label — text is extracted locally in the browser via Tesseract WASM (no server upload needed) |
| ✏️ **Manual** | Paste the ingredient list directly for instant analysis |

### Personalised verdict
- **SAFE / CAUTION / AVOID** verdict powered by Llama 3.3 70B
- **Confidence badge** — `HIGH` (barcode), `MEDIUM` (OCR), `LOW` (manual) shown on every result
- **Explainable flags** — every flagged ingredient shows the reason, severity, and which profile rule triggered it
- **Alternative suggestion** — AI recommends a safer product type when verdict is AVOID

### Health profile awareness
- **12+ dietary & religious presets** — Halal, Kosher, Jain, Hindu Vegetarian, Buddhist Strict, Vegan, Vegetarian, Pescatarian, Keto, Gluten-Free, Dairy-Free, Low-FODMAP
- **Medical conditions** — Diabetes, Hypertension, Kidney Disease
- **Custom allergies & intolerances** — free-text, any number
- **Medications** — AI checks for food-drug interactions (Warfarin, Statins, MAOIs, SSRIs, Metformin, ACE inhibitors and more)
- **Lab values** — blood sugar, cholesterol, sodium, creatinine, potassium — AI upgrades severity of flags based on your actual numbers

### Smart UX
- **Auto-OCR fallback** — if a barcode isn't in Open Food Facts, an inline banner appears with a one-click "📸 Use Photo OCR →" redirect instead of a dead end
- **AI chat follow-up** — ask questions about the verdict after a scan (max 8 turns, collapsible)
- **Share result** — native share sheet on mobile, clipboard copy on desktop with a toast confirmation
- **Scan history** — last 50 scans with stats (total / safe / caution / avoid)
- **Progressive onboarding** — 2-step wizard for new users; returning users go straight to the home dashboard

### Responsive design
- Full sidebar navigation on desktop
- Icon-only collapsed sidebar on tablet
- Fixed bottom navigation bar on mobile
- "Fresh Market" food-themed design — herb green, turmeric gold, warm parchment

---

## 🏗️ Architecture

```
Browser (Next.js)
       │
       ├── /scan, /profile, /history, /     ← React client components
       │
       └── /api/* (Next.js Route Handlers — server-side only)
               │
               ├── /api/analyze ──────────────► Supabase Edge Function (Deno)
               │                                       │
               ├── /api/chat ─────────────────────────►│ Groq llama-3.3-70b-versatile
               │                                       │ GROQ_API_KEY in Supabase Vault
               ├── /api/profile ──────────────► Supabase DB (profiles table)
               ├── /api/history ──────────────► Supabase DB (scan_history table)
               ├── /api/barcode/decode ───────► ZBar WASM (server-side image processing)
               └── /api/barcode/lookup ───────► Open Food Facts API
```

### Key architectural decisions

**Security boundary** — `lib/supabase/server.ts` uses `import 'server-only'`. The Supabase service key and GROQ_API_KEY never reach the browser bundle. Build fails if violated.

**LLM prompt design** — the system prompt has four layers: core rules, preset ruleset, medication-food interaction checks, and lab-value-aware severity upgrading. The LLM always returns structured JSON — never free text.

**Stale data prevention** — every API route returns `Cache-Control: no-store` and every fetch call uses `cache: 'no-store'`, ensuring profile changes reflect immediately across all pages.

**Confidence tracking** — scan source is tracked through the full pipeline (barcode → HIGH, OCR → MEDIUM, manual → LOW) and rendered as a badge on the verdict card.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, App Router, Turbopack |
| Styling | Custom CSS with design tokens — no component library |
| LLM | Groq `llama-3.3-70b-versatile` |
| LLM runtime | Supabase Edge Functions (Deno) |
| OCR | `tesseract.js` — browser WASM, works deployed with no server binary |
| Barcode decode | `@undecaf/zbar-wasm` — server-side API route |
| Barcode data | Open Food Facts API (free, open-source, no key required) |
| Database | Supabase (PostgreSQL, Frankfurt region) |
| Language | TypeScript |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Groq](https://console.groq.com) API key (set as a Supabase Vault secret — see below)

### 1. Clone and install

```bash
git clone https://github.com/CodeOfHANA/ingrediq.git
cd ingrediq/frontend
npm install
```

### 2. Environment variables

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
```

> **Never commit `.env.local`** — it is gitignored.

### 3. Supabase database tables

Run this SQL in your Supabase SQL editor:

```sql
-- User health profiles
CREATE TABLE profiles (
  user_id         TEXT PRIMARY KEY,
  name            TEXT,
  presets         TEXT[],
  medical_conditions TEXT[],
  allergies       TEXT[],
  medications     TEXT[],
  lab_values      JSONB DEFAULT '{}',
  preferences     TEXT[],
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

-- Scan history
CREATE TABLE scan_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  product_name    TEXT,
  ingredients_text TEXT,
  source          TEXT,
  verdict         TEXT,
  flags           JSONB DEFAULT '[]',
  summary         TEXT,
  llm_response    JSONB,
  scanned_at      TIMESTAMP DEFAULT now()
);

-- Open Food Facts cache
CREATE TABLE products_cache (
  barcode         TEXT PRIMARY KEY,
  product_name    TEXT,
  ingredients_text TEXT,
  fetched_at      TIMESTAMP DEFAULT now()
);
```

### 4. Deploy the Edge Function

```bash
# From repo root — store your access token in root .env
SUPABASE_ACCESS_TOKEN=your_token \
  npx supabase functions deploy analyze-ingredients \
  --project-ref your-project-ref
```

Set your Groq API key as a Supabase secret (never stored in any file):

```bash
SUPABASE_ACCESS_TOKEN=your_token \
  npx supabase secrets set GROQ_API_KEY=gsk_... \
  --project-ref your-project-ref
```

### 5. Run

```bash
cd frontend
npm run dev
# → http://localhost:3000
```

---

## 📁 Project Structure

```
ingrediq/
├── frontend/                          # Active Next.js app
│   ├── app/
│   │   ├── page.tsx                   # Home / onboarding wizard
│   │   ├── scan/page.tsx              # Scan interface (3 tabs)
│   │   ├── profile/page.tsx           # Profile editor
│   │   ├── history/page.tsx           # Scan history
│   │   ├── globals.css                # All styles + design tokens
│   │   └── api/
│   │       ├── analyze/route.ts       # LLM analysis proxy
│   │       ├── chat/route.ts          # AI chat proxy
│   │       ├── profile/route.ts       # Profile CRUD
│   │       ├── history/route.ts       # History CRUD
│   │       └── barcode/
│   │           ├── decode/route.ts    # Barcode image → code
│   │           └── lookup/route.ts    # Barcode → product data
│   ├── components/
│   │   ├── VerdictCard.tsx            # Result card + confidence + share
│   │   ├── FlagList.tsx               # Expandable ingredient flags
│   │   ├── Sidebar.tsx                # Desktop navigation
│   │   ├── BottomNav.tsx              # Mobile navigation
│   │   └── PresetGrid.tsx             # Dietary preset selector
│   └── lib/
│       ├── types.ts                   # Shared TypeScript types
│       ├── presets.ts                 # All preset definitions
│       ├── supabase/server.ts         # Server-only Supabase client
│       └── supabase/client.ts         # Browser Supabase client
├── supabase/
│   └── functions/analyze-ingredients/ # Deno Edge Function
│       ├── index.ts                   # LLM analysis + chat mode
│       └── cors.ts                    # CORS headers
└── README.md
```

---

## 🧠 How the AI Analysis Works

Every scan — regardless of input method — produces the same ingredient text string, which is sent to the Supabase Edge Function along with the user's full health profile.

The LLM system prompt is structured in four layers:

1. **Core rules** — never diagnose, flag ingredient aliases, flag E-numbers, most restrictive preset wins
2. **Preset rulesets** — full exclusion lists for all active dietary/religious profiles
3. **Medication-food interactions** — checks for known interactions based on the user's medication list:
   - Warfarin → Vitamin K rich foods
   - Statins → Grapefruit
   - MAOIs → Tyramine-rich foods
   - Metformin → Alcohol
   - ACE inhibitors → High potassium (if kidney disease present)
   - SSRIs → St. John's Wort
4. **Lab-value-aware severity** — upgrades flag severity based on actual numbers:
   - Blood sugar > 7.0 mmol/L → sugar flags upgraded to AVOID
   - Cholesterol > 5.2 mmol/L → saturated fat flags upgraded to HIGH
   - Sodium > 145 mmol/L → salt/MSG flags upgraded to HIGH
   - Potassium > 5.0 mmol/L → all potassium-rich foods flagged at HIGH

The LLM returns structured JSON only — verdict, flags array, summary, optional alternative suggestion.

---

## 🔒 Security

| Concern | Approach |
|---|---|
| GROQ_API_KEY | Stored in Supabase Vault only — never in any file |
| Supabase service key | Server-only via `import 'server-only'` — never reaches browser |
| `.env.local` | Gitignored — inject via Vercel environment variables in production |
| File uploads | 10 MB size limit + MIME type validation on barcode decode endpoint |
| Error messages | Internal errors logged server-side only — generic messages returned to client |
| Third-party data | Barcodes sent to Open Food Facts; health profile sent to Groq API for analysis |

> ⚠️ This app currently uses anonymous UUIDs (no login). For production use with real health data, Supabase Auth with Row Level Security should be implemented.

---

## ⚠️ Disclaimer

IngredIQ is not a medical device. Analysis results are based on your stated profile and general ingredient knowledge. Always consult your doctor or dietitian before making health decisions based on this information.

---

## 📄 License

MIT

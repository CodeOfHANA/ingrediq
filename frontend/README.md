# IngredIQ — Frontend

Next.js 16 App Router frontend for IngredIQ. See the [root README](../README.md) for full project documentation.

## Dev

```bash
npm install
npm run dev        # http://localhost:3000
npx tsc --noEmit   # type-check (pre-existing errors in barcode/decode/route.ts are known)
```

## Environment

Create `.env.local` (never commit this file):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
```

## Key conventions

- All styles in `app/globals.css` — no component library
- Server-only Supabase client: `lib/supabase/server.ts` — use `getServerSupabase()` in API routes only
- Browser Supabase client: `lib/supabase/client.ts` — use `getBrowserSupabase()` in components
- Every API route must return `Cache-Control: no-store` on all response paths
- Confidence values: barcode → `HIGH`, OCR → `MEDIUM`, manual → `LOW`

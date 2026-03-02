# IngredIQ — Supabase Integration Skill File

## Project Details
- Project name: ingrediq
- Region: Frankfurt (eu-central-1)
- URL: https://agomwlvmhstadcpldwbm.supabase.co
- Project ref: agomwlvmhstadcpldwbm

---

## Next.js Patterns (Active App)

### Client split — CRITICAL
```typescript
// lib/supabase/server.ts — server-only, uses service key
import 'server-only'
import { createClient } from '@supabase/supabase-js'
export function getServerSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!   // no NEXT_PUBLIC_ prefix — never reaches browser
    )
}

// lib/supabase/client.ts — browser-safe, uses anon key
import { createClient } from '@supabase/supabase-js'
export function getBrowserSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
```

### API Route pattern
```typescript
// All API routes must:
// 1. Use getServerSupabase() — never inline createClient with service key
// 2. Return Cache-Control: no-store on ALL response paths (including errors)
import { getServerSupabase } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    const sb = getServerSupabase()
    const noStore = { headers: { 'Cache-Control': 'no-store' } }
    const { data, error } = await sb.from('profiles').select('*').eq('user_id', userId).single()
    if (error) return NextResponse.json(null, noStore)
    return NextResponse.json(data, noStore)
}
```

### Profile save — insert-catch-then-update (CRITICAL)
```typescript
// ⚠️ Supabase upsert with onConflict does NOT reliably work with RLS.
// Use this pattern instead: try INSERT first, catch 23505 (duplicate),
// then fall back to UPDATE. This is immune to RLS blocking reads.

// Step 1: Try UPDATE first
const { error: updateErr } = await sb
    .from('profiles')
    .update(row)
    .eq('user_id', profile.user_id)

// Step 2: Check if row exists (SELECT)
const { data: check } = await sb
    .from('profiles')
    .select('user_id')
    .eq('user_id', profile.user_id)
    .maybeSingle()

if (check) return NextResponse.json({ ok: true })  // UPDATE worked

// Step 3: Row doesn't exist — INSERT
const { error: insertErr } = await sb
    .from('profiles')
    .insert({ user_id: profile.user_id, ...row })

if (insertErr) {
    // 23505 race condition — retry UPDATE
    const { error: retryErr } = await sb
        .from('profiles')
        .update(row)
        .eq('user_id', profile.user_id)
    if (retryErr) return NextResponse.json({ error: retryErr.message }, { status: 500 })
}
return NextResponse.json({ ok: true })
```

### Server Supabase client — bypass RLS
```typescript
// lib/supabase/server.ts — must include auth options to bypass RLS
export function getServerSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}
```

### Loading profile — strip database-only columns
```typescript
// When loading profile data, always strip database columns
// before storing in component state. Otherwise `id` leaks into
// the POST payload and can cause conflicts.
const { user_id: _, id: _id, created_at: __, updated_at: ___, ...rest } = data
setForm(rest)
```

### Calling Edge Functions from API routes
```typescript
const { data, error } = await getServerSupabase().functions.invoke('analyze-ingredients', {
    body: { ingredientsText, profile }
})
```

---

## Python Patterns (Legacy Streamlit App)

## Environment Variables
```
SUPABASE_URL=https://agomwlvmhstadcpldwbm.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
```

## Client Initialization
```python
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    return create_client(url, key)

# Initialize once and reuse
supabase = get_supabase_client()
```

## Tables

### profiles (11 columns)
```sql
id              uuid primary key (auto)
user_id         text unique not null
name            text
presets         text[]
medical_conditions text[]
allergies       text[]
medications     text[]
lab_values      jsonb
preferences     text[]
created_at      timestamp
updated_at      timestamp
```

### scan_history (11 columns)
```sql
id              uuid primary key (auto)
user_id         text not null
product_name    text
ingredients_text text
source          text (barcode | ocr | manual)
confidence      text (HIGH | MEDIUM | LOW)
verdict         text (SAFE | CAUTION | AVOID)
flags           jsonb
summary         text
llm_response    jsonb
scanned_at      timestamp
```

### products_cache (4 columns)
```sql
barcode         text primary key
product_name    text
ingredients_text text
fetched_at      timestamp
```

## All Database Operations

### Save or Update Profile
```python
def save_profile(profile: dict) -> bool:
    try:
        supabase.table("profiles").upsert({
            "user_id": profile["user_id"],
            "name": profile.get("name"),
            "presets": profile.get("presets", []),
            "medical_conditions": profile.get("medical_conditions", []),
            "allergies": profile.get("allergies", []),
            "medications": profile.get("medications", []),
            "lab_values": profile.get("lab_values", {}),
            "preferences": profile.get("preferences", []),
            "updated_at": "now()"
        }).execute()
        return True
    except Exception as e:
        print(f"Supabase save_profile error: {e}")
        return False
```

### Load Profile
```python
def load_profile(user_id: str) -> dict | None:
    try:
        result = supabase.table("profiles")\
            .select("*")\
            .eq("user_id", user_id)\
            .execute()
        if result.data:
            return result.data[0]
    except Exception as e:
        print(f"Supabase load_profile error: {e}")
    return None
```

### Save Scan Result
```python
def save_scan(user_id: str, scan_data: dict, result: dict) -> bool:
    try:
        supabase.table("scan_history").insert({
            "user_id": user_id,
            "product_name": scan_data.get("product_name"),
            "ingredients_text": scan_data.get("ingredients_text"),
            "source": scan_data.get("source"),
            "verdict": result.get("verdict"),
            "flags": result.get("flags", []),
            "summary": result.get("summary"),
            "llm_response": result,
            "scanned_at": "now()"
        }).execute()
        return True
    except Exception as e:
        print(f"Supabase save_scan error: {e}")
        return False
```

### Load Scan History
```python
def load_history(user_id: str, limit: int = 20) -> list:
    try:
        result = supabase.table("scan_history")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("scanned_at", desc=True)\
            .limit(limit)\
            .execute()
        return result.data or []
    except Exception as e:
        print(f"Supabase load_history error: {e}")
        return []
```

### Products Cache — Check Before API Call
```python
def get_cached_product(barcode: str) -> dict | None:
    try:
        result = supabase.table("products_cache")\
            .select("*")\
            .eq("barcode", barcode)\
            .execute()
        if result.data:
            return result.data[0]
    except Exception as e:
        print(f"Supabase cache lookup error: {e}")
    return None

def cache_product(barcode: str, product_name: str, ingredients_text: str) -> None:
    try:
        supabase.table("products_cache").upsert({
            "barcode": barcode,
            "product_name": product_name,
            "ingredients_text": ingredients_text,
            "fetched_at": "now()"
        }).execute()
    except Exception as e:
        print(f"Supabase cache write error: {e}")
```

## Local JSON Fallback — Critical for Demo Safety
Always implement fallback. Demo WiFi can be unreliable.

```python
import json
import os
from pathlib import Path

PROFILE_PATH = Path("data/profiles/local.json")
HISTORY_PATH = Path("data/history/local.json")

def save_profile_local(profile: dict) -> None:
    PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(PROFILE_PATH, "w") as f:
        json.dump(profile, f, indent=2)

def load_profile_local() -> dict | None:
    if PROFILE_PATH.exists():
        with open(PROFILE_PATH) as f:
            return json.load(f)
    return None

def save_history_local(scan: dict) -> None:
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    history = load_history_local()
    history.insert(0, scan)
    history = history[:50]  # Keep last 50 scans
    with open(HISTORY_PATH, "w") as f:
        json.dump(history, f, indent=2)

def load_history_local() -> list:
    if HISTORY_PATH.exists():
        with open(HISTORY_PATH) as f:
            return json.load(f)
    return []
```

## Combined Save Pattern — Always Use This
```python
def save_profile_everywhere(profile: dict) -> None:
    save_profile_local(profile)      # Always save locally first
    save_profile(profile)            # Then try Supabase

def load_profile_smart(user_id: str) -> dict | None:
    # Try Supabase first
    profile = load_profile(user_id)
    if profile:
        save_profile_local(profile)  # Keep local in sync
        return profile
    # Fall back to local
    return load_profile_local()
```

## User ID Management
```python
USER_ID_PATH = Path("data/user_id.txt")

def get_or_create_user_id() -> str:
    USER_ID_PATH.parent.mkdir(parents=True, exist_ok=True)
    if USER_ID_PATH.exists():
        return USER_ID_PATH.read_text().strip()
    import uuid
    user_id = str(uuid.uuid4())
    USER_ID_PATH.write_text(user_id)
    return user_id
```

## Fallback Priority
1. Try Supabase
2. On any exception → use local JSON
3. Never raise exceptions to UI layer
4. Always log errors to console
5. Show "offline mode" notice in sidebar if Supabase unavailable

import { createClient } from '@supabase/supabase-js'

// Browser-safe client — uses anon key only, protected by Supabase RLS
export function getBrowserSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    return createClient(url, key)
}

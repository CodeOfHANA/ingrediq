import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'
import { Profile } from '@/lib/types'

export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const sb = getServerSupabase()
    try {
        const { data, error } = await sb
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single()

        const noStore = { headers: { 'Cache-Control': 'no-store' } }
        if (error || !data) return NextResponse.json(null, noStore)
        return NextResponse.json(data, noStore)
    } catch (e) {
        console.error('Profile GET error:', e)
        return NextResponse.json(null, { headers: { 'Cache-Control': 'no-store' } })
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json()
    const profile = body as Profile & { id?: string }
    if (!profile?.user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

    console.log('[profile:POST] user_id:', profile.user_id, 'keys:', Object.keys(body))

    const sb = getServerSupabase()
    const row = {
        name: profile.name,
        presets: profile.presets ?? [],
        medical_conditions: profile.medical_conditions ?? [],
        allergies: profile.allergies ?? [],
        medications: profile.medications ?? [],
        lab_values: profile.lab_values ?? {},
        preferences: profile.preferences ?? [],
        updated_at: new Date().toISOString(),
    }

    // Step 1: Always try UPDATE first (safe even if row doesn't exist)
    const { error: updateErr, count } = await sb
        .from('profiles')
        .update(row)
        .eq('user_id', profile.user_id)

    console.log('[profile:POST] UPDATE result:', { updateErr, count })

    if (!updateErr) {
        // UPDATE succeeded (may have matched 0 rows — that's fine, we'll insert below)
        // Check if the row actually exists now by trying SELECT
        const { data: check } = await sb
            .from('profiles')
            .select('user_id')
            .eq('user_id', profile.user_id)
            .maybeSingle()

        console.log('[profile:POST] SELECT check:', check)

        if (check) {
            // Row exists — UPDATE worked
            return NextResponse.json({ ok: true })
        }
    }

    // Step 2: Row doesn't exist — INSERT
    console.log('[profile:POST] Inserting new row for:', profile.user_id)
    const { error: insertErr } = await sb
        .from('profiles')
        .insert({ user_id: profile.user_id, ...row })

    if (insertErr) {
        // If INSERT also fails (23505 race, RLS, etc.) — try UPDATE one more time
        console.log('[profile:POST] INSERT failed:', insertErr.code, insertErr.message, '— retrying UPDATE')
        const { error: retryErr } = await sb
            .from('profiles')
            .update(row)
            .eq('user_id', profile.user_id)

        if (retryErr) {
            console.error('[profile:POST] FINAL FAIL:', JSON.stringify(retryErr))
            return NextResponse.json({ error: retryErr.message || 'Save failed' }, { status: 500 })
        }
    }

    return NextResponse.json({ ok: true })
}

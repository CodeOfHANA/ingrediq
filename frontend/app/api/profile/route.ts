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
    const profile = (await req.json()) as Profile & { id?: string }
    if (!profile?.user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

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

    try {
        // Strategy: try UPDATE first. If it matches 0 rows, INSERT.
        // This avoids the 23505 race condition entirely.
        const { data: updated, error: updateErr } = await sb
            .from('profiles')
            .update(row)
            .eq('user_id', profile.user_id)
            .select('user_id')

        console.log('[profile] UPDATE result:', { updated, updateErr })

        if (updateErr) {
            // UPDATE itself errored — throw
            throw updateErr
        }

        if (updated && updated.length > 0) {
            // Row existed and was updated
            return NextResponse.json({ ok: true })
        }

        // No row existed — INSERT
        console.log('[profile] No existing row, inserting for:', profile.user_id)
        const { error: insertErr } = await sb
            .from('profiles')
            .insert({ user_id: profile.user_id, ...row })

        if (insertErr) throw insertErr
        return NextResponse.json({ ok: true })

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e)
        console.error('Profile POST error:', msg)
        return NextResponse.json({ error: msg || 'Save failed' }, { status: 500 })
    }
}

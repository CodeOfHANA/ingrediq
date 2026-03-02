import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'
import { ScanRecord } from '@/lib/types'

export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json([], { status: 400 })

    const id = req.nextUrl.searchParams.get('id')
    const sb = getServerSupabase()
    const noStore = { headers: { 'Cache-Control': 'no-store' } }

    try {
        if (id) {
            const { data, error } = await sb
                .from('scan_history')
                .select('*')
                .eq('user_id', userId)
                .eq('id', id)
                .single()
            if (error) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore.headers })
            return NextResponse.json(data, noStore)
        }

        const { data, error } = await sb
            .from('scan_history')
            .select('*')
            .eq('user_id', userId)
            .order('scanned_at', { ascending: false })
            .limit(50)

        if (error) throw error
        return NextResponse.json(data ?? [], noStore)
    } catch (e) {
        console.error('History GET error:', e)
        return NextResponse.json([], noStore)
    }
}

export async function POST(req: NextRequest) {
    const { userId, scan } = (await req.json()) as { userId: string; scan: ScanRecord }
    if (!userId || !scan) return NextResponse.json({ error: 'userId and scan required' }, { status: 400 })

    const sb = getServerSupabase()
    try {
        const { error } = await sb.from('scan_history').insert({
            user_id: userId,
            product_name: scan.product_name ?? null,
            ingredients_text: scan.ingredients_text,
            source: scan.source,
            verdict: scan.verdict,
            flags: scan.flags ?? [],
            summary: scan.summary,
            llm_response: scan,
            scanned_at: scan.scanned_at ?? new Date().toISOString(),
        })
        if (error) throw error
        return NextResponse.json({ ok: true })
    } catch (e) {
        console.error('History POST error:', e)
        return NextResponse.json({ error: 'Save failed' }, { status: 500 })
    }
}

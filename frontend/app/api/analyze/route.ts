import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

// Thin proxy — all Groq logic and the API key have moved to the
// Supabase Edge Function `analyze-ingredients`.
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => null)
        if (!body) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const { ingredientsText, profile } = body as {
            ingredientsText?: string
            profile?: unknown
        }

        if (!ingredientsText?.trim()) {
            return NextResponse.json({ error: 'ingredientsText is required' }, { status: 400 })
        }
        if (!profile) {
            return NextResponse.json({ error: 'profile is required' }, { status: 400 })
        }

        const { data, error } = await getServerSupabase().functions.invoke('analyze-ingredients', {
            body: { ingredientsText, profile },
        })

        if (error) {
            console.error('[/api/analyze] edge function error:', error)
            return NextResponse.json(
                { error: 'Analysis temporarily unavailable. Please try again.' },
                { status: 502 }
            )
        }

        return NextResponse.json(data)

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[/api/analyze] error:', msg)
        return NextResponse.json(
            { error: 'Analysis temporarily unavailable. Please try again.' },
            { status: 500 }
        )
    }
}

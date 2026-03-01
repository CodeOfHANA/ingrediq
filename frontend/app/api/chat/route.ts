import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null)
    if (!body?.messages || !body?.ingredientsText || !body?.profile) {
        return NextResponse.json({ error: 'messages, ingredientsText, and profile are required' }, { status: 400 })
    }

    const sb = getServerSupabase()
    const { data, error } = await sb.functions.invoke('analyze-ingredients', {
        body: {
            mode: 'chat',
            messages: body.messages,
            ingredientsText: body.ingredientsText,
            profile: body.profile,
        },
    })

    if (error) {
        console.error('Chat function error:', error)
        return NextResponse.json({ error: 'Chat temporarily unavailable. Please try again.' }, { status: 500 })
    }

    return NextResponse.json(data)
}

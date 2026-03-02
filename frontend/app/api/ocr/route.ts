import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export const runtime = 'nodejs'

const MAX_SIZE = 10 * 1024 * 1024   // 10 MB
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Vision-capable model on Groq free tier
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('image') as File | null
        if (!file) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 })
        }
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'Image too large. Please use a photo under 10 MB.' }, { status: 413 })
        }

        const apiKey = process.env.GROQ_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'OCR service not configured.' }, { status: 500 })
        }

        // Read raw bytes and preprocess with sharp:
        // - Auto-rotate (EXIF), resize to max 1600px, convert HEIC→JPEG, normalize contrast
        const arrayBuffer = await file.arrayBuffer()
        const inputBuffer = Buffer.from(arrayBuffer)

        const processedBuffer = await sharp(inputBuffer)
            .rotate()                                         // auto-correct EXIF orientation
            .resize({ width: 1600, withoutEnlargement: true }) // cap resolution
            .jpeg({ quality: 85 })                            // normalize to JPEG (handles HEIC)
            .toBuffer()

        const base64Image = processedBuffer.toString('base64')

        // Call Groq Vision API for OCR
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: VISION_MODEL,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: { url: `data:image/jpeg;base64,${base64Image}` },
                            },
                            {
                                type: 'text',
                                text: 'Extract all ingredient text from this product label image. Return ONLY the raw ingredient list exactly as written, with no additional commentary, formatting, or explanation. If you cannot find ingredient text, respond with: NO_TEXT_FOUND',
                            },
                        ],
                    },
                ],
                temperature: 0,
                max_tokens: 1000,
            }),
        })

        if (!response.ok) {
            const errText = await response.text()
            console.error('[ocr:POST] Groq error:', errText)
            return NextResponse.json({ error: 'OCR service temporarily unavailable. Please try Manual Input.' }, { status: 502 })
        }

        const data = await response.json() as { choices: Array<{ message: { content: string } }> }
        const extracted = data.choices?.[0]?.message?.content?.trim() ?? ''

        if (!extracted || extracted === 'NO_TEXT_FOUND') {
            return NextResponse.json(
                { error: 'No ingredient text found in this image. Try a clearer photo of the ingredient label.' },
                { status: 422 }
            )
        }

        return NextResponse.json({ text: extracted })
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error('[ocr:POST] error:', msg)
        return NextResponse.json({ error: `OCR failed: ${msg}` }, { status: 500 })
    }
}

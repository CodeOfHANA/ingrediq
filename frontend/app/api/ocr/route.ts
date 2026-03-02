import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export const runtime = 'nodejs'

const MAX_SIZE = 10 * 1024 * 1024   // 10 MB

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

        // Read raw bytes
        const arrayBuffer = await file.arrayBuffer()
        const inputBuffer = Buffer.from(arrayBuffer)

        // Preprocess with sharp: HEIC→PNG, resize, grayscale, normalize contrast
        const processed = await sharp(inputBuffer)
            .rotate()                      // auto-rotate using EXIF orientation
            .resize({ width: 2000, withoutEnlargement: true })  // cap at 2000px wide
            .grayscale()                   // better OCR contrast
            .normalize()                   // auto-level contrast
            .sharpen()                     // sharpen edges for text
            .png()                         // output as PNG (tesseract-friendly)
            .toBuffer()

        // Run tesseract.js server-side (Node.js — more memory than mobile browser WASM)
        const { createWorker } = await import('tesseract.js')
        const worker = await createWorker('eng', 1, {
            logger: () => { },
        })
        const { data: { text } } = await worker.recognize(processed)
        await worker.terminate()

        const cleaned = text.trim()
        if (!cleaned) {
            return NextResponse.json(
                { error: 'No text could be extracted from this image. Try a clearer photo of the ingredient label.' },
                { status: 422 }
            )
        }

        return NextResponse.json({ text: cleaned })
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error('[ocr:POST] error:', msg)
        return NextResponse.json(
            { error: `OCR processing failed: ${msg}` },
            { status: 500 }
        )
    }
}

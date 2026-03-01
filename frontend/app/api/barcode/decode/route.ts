import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('image') as File | null
        if (!file) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 })
        }

        // Guard against oversized uploads (max 10 MB)
        const MAX_BYTES = 10 * 1024 * 1024
        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: 'Image too large. Please use a photo under 10 MB.' }, { status: 413 })
        }

        // Only accept image MIME types
        const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']
        if (!VALID_TYPES.includes(file.type)) {
            return NextResponse.json({ error: 'Unsupported file type. Use JPG, PNG, or WEBP.' }, { status: 415 })
        }

        // Read file bytes robustly
        const arrayBuffer = await file.arrayBuffer()
        const inputBuffer = Buffer.from(arrayBuffer)

        // Preprocess: extract raw RGBA pixels via sharp
        const { data: rawPixels, info } = await sharp(inputBuffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true })

        const { width, height } = info
        const uint8clamped = new Uint8ClampedArray(rawPixels.buffer, rawPixels.byteOffset, rawPixels.byteLength)

        // Locate the WASM binary using an absolute path so Next.js can find it
        // regardless of working directory changes
        const wasmPath = path.resolve(
            process.cwd(),
            'node_modules/@undecaf/zbar-wasm/dist/zbar.wasm'
        )

        if (!fs.existsSync(wasmPath)) {
            console.error('[barcode-decode] zbar.wasm not found at:', wasmPath)
            return NextResponse.json({ error: 'Barcode scanner not available — WASM file missing.' }, { status: 500 })
        }

        // Load wasmBinary manually so the package doesn't try to find it via require()
        const wasmBinary = fs.readFileSync(wasmPath)

        // Init zbar-wasm with the manually provided binary
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const zbarWasm = await import('@undecaf/zbar-wasm') as any
        if (typeof zbarWasm.setZbarModuleFactoryOptions === 'function') {
            zbarWasm.setZbarModuleFactoryOptions({ wasmBinary })
        }

        const imageData = { data: uint8clamped, width, height }
        let symbols = await zbarWasm.scanImageData(imageData)

        // Grayscale fallback if colour decode failed
        if (!symbols || symbols.length === 0) {
            const { data: grayRaw, info: grayInfo } = await sharp(inputBuffer)
                .grayscale()
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true })
            const grayUint8 = new Uint8ClampedArray(grayRaw.buffer, grayRaw.byteOffset, grayRaw.byteLength)
            symbols = await zbarWasm.scanImageData({ data: grayUint8, width: grayInfo.width, height: grayInfo.height })
        }

        if (!symbols || symbols.length === 0) {
            return NextResponse.json(
                { error: 'Barcode not detected. Try a clearer, well-lit photo or enter the number manually.' },
                { status: 422 }
            )
        }

        const code = symbols[0].decode()
        return NextResponse.json({ code })

    } catch (err: unknown) {
        console.error('[barcode-decode]', err instanceof Error ? err.message : String(err))
        return NextResponse.json({ error: 'Barcode processing failed. Please try again or enter the number manually.' }, { status: 500 })
    }
}

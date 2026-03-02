# IngredIQ — Scanning & Input Skill File

## Active App: Next.js Frontend

The active scanning implementation lives in `frontend/app/scan/page.tsx` with server-side API routes.

### Confidence Levels (Next.js)
| Source | Confidence | Rationale |
|---|---|---|
| Barcode lookup (Open Food Facts hit) | `HIGH` | Structured database data |
| Photo OCR (Groq Vision API) | `MEDIUM` | AI-read, very accurate but still a photo |
| Manual text entry | `LOW` | User-typed, could be incomplete |

### Barcode decode: `@undecaf/zbar-wasm`
Server-side API route at `/api/barcode/decode/route.ts`.
- Uses `sharp` for image preprocessing (RGBA extraction, grayscale fallback)
- Uses `@undecaf/zbar-wasm` — WebAssembly port of the same zbar C library that Python's pyzbar uses
- **WASM path fix**: Must resolve `zbar.wasm` with `process.cwd()` because Next.js API routes change the working directory
- File size guard: max 10 MB
- **Accepted formats**: image/jpeg, image/png, image/webp, image/gif, image/bmp, **image/heic, image/heif** + extension-based fallback for mobile browsers that send empty MIME types
- **Mobile UX**: Two separate file inputs per tab — "📷 Take Photo" (with `capture="environment"` for direct camera access) and "📁 Choose from Gallery" (without `capture`, opens file picker)

### OCR: Groq Vision API (`meta-llama/llama-4-scout-17b-16e-instruct`)
Server-side API route at `/api/ocr/route.ts` (Node.js runtime on Vercel).

**Why not tesseract.js?**
- `tesseract.js` uses worker threads that resolve file paths from `node_modules` — these paths don't exist in Vercel's `/ROOT/` serverless filesystem.
- Groq Vision API runs over HTTP — no filesystem dependencies, works anywhere.
- Quality is significantly better than Tesseract for real-world product label photos.

**Pipeline:**
1. Client detects HEIC/HEIF by MIME type or file extension
2. If HEIC → convert to JPEG client-side using `heic2any` (browser lib, dynamic import)
3. Upload JPEG/PNG to `/api/ocr` as `multipart/form-data`
4. Server uses `sharp` to: auto-rotate (EXIF), resize to max 1600px, normalize to JPEG
5. Preprocessed image sent as `base64` to Groq Vision API
6. LLM extracts ingredient text, returns raw text
7. Text populated into the ingredients field for analysis

**Key env var:** `GROQ_API_KEY` must exist in `frontend/.env.local` AND as a Vercel environment variable.

**heic2any**: `npm install heic2any` — dynamically imported in browser only. Not used server-side.

### Auto-OCR fallback
When Open Food Facts returns 404 for a barcode, the scan page shows a `barcodeNotFound` banner with a "📸 Use Photo OCR →" button. Users are never left at a dead end.

---

## Output Contract (TypeScript — Next.js)

All three input modes produce this structure before the LLM analysis call:
```typescript
{
  ingredientsText: string    // clean ingredient list
  productName?: string       // from barcode lookup or OCR; omit for manual
  source: 'barcode' | 'ocr' | 'manual'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}
```
Never pass raw unprocessed text directly to the LLM.

---

## Mode 3: Manual Text Input (Next.js)

No API call needed. Client-side only:
- Strip leading/trailing whitespace
- Normalise line-breaks → commas
- Set `confidence: 'LOW'`

---

## Error Handling (Next.js)

| Scenario | HTTP | User-facing action |
|---|---|---|
| No image in form data | 400 | Show inline error |
| Image > 10 MB | 413 | "Please use a photo under 10 MB" |
| `GROQ_API_KEY` missing | 500 | "OCR service not configured" |
| Groq API error | 502 | "OCR service temporarily unavailable. Please try Manual Input." |
| No text found in image | 422 | "No ingredient text found. Try a clearer photo." |
| Barcode 404 (Open Food Facts) | — | Show auto-OCR fallback banner with "📸 Use Photo OCR →" button |

---

## Environment Variables for OCR (Next.js)

`GROQ_API_KEY` must be available in **two separate places**:
1. `frontend/.env.local` — for local development (`process.env.GROQ_API_KEY` in the Node.js OCR route)
2. Vercel environment variables — for production deployment
3. Supabase Vault secrets — for the Deno edge function (`analyze-ingredients`), separate from above

Never commit `GROQ_API_KEY` to git in any file.

---

## Legacy: Python/Streamlit Patterns (Reference Only)

> **IMPORTANT:** The patterns below describe the **legacy Streamlit app** (repo root `app.py`).
> The **active Next.js app** uses **Groq Vision API** for OCR — `tesseract.js` / `pytesseract` are
> NOT used and must NOT be added to the Next.js app.
> Tesseract was replaced because its worker thread path resolution fails on Vercel serverless.

### Legacy Output Contract (Python)
```python
{
    "ingredients_text": "string — clean comma separated ingredient list",
    "product_name": "string or None",
    "source": "barcode" | "ocr" | "manual",
    "confidence": "HIGH" | "MEDIUM" | "LOW"
}
```

### Legacy Mode 1: Barcode (pyzbar + Open Food Facts)
```python
from pyzbar.pyzbar import decode
from PIL import Image
import numpy as np, cv2, requests

def decode_barcode(image_file) -> str | None:
    img_array = np.array(Image.open(image_file))
    barcodes = decode(img_array) or decode(cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY))
    return barcodes[0].data.decode("utf-8") if barcodes else None

def fetch_from_openfoodfacts(barcode: str) -> dict | None:
    data = requests.get(f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json", timeout=5).json()
    if data.get("status") == 1:
        p = data["product"]
        return {"ingredients_text": p.get("ingredients_text",""), "product_name": p.get("product_name"), "source":"barcode","confidence":"HIGH"}
    return None
```

### Legacy Mode 2: OCR (Tesseract — REPLACED by Groq Vision in Next.js)
```python
# DO NOT USE in Next.js — for Streamlit legacy app only
import pytesseract
pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_PATH")
# TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe

# Preprocessing: grayscale → blur → adaptive threshold → denoise
# Then: pytesseract.image_to_string(processed, config="--oem 3 --psm 6")
# Multilingual: config="--oem 3 --psm 6 -l eng+deu"
```

### Legacy Mode 3: Manual (Python)
```python
def process_manual_input(text: str) -> dict:
    cleaned = text.strip().replace("\n", ", ").replace("  ", " ")
    return {"ingredients_text": cleaned, "product_name": None, "source": "manual", "confidence": "HIGH"}
```

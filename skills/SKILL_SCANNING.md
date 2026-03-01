# IngredIQ — Scanning & Input Skill File

## Output Contract
All three input modes MUST return this identical structure before LLM call:
```python
{
    "ingredients_text": "string — clean comma separated ingredient list",
    "product_name": "string or None",
    "source": "barcode" | "ocr" | "manual",
    "confidence": "HIGH" | "MEDIUM" | "LOW"  # OCR confidence, HIGH for barcode/manual
}
```
Never pass raw unprocessed text to the LLM analyzer.

---

## Mode 1: Barcode Scanning

### Flow
1. User uploads image containing barcode OR uses camera input
2. pyzbar decodes barcode number from image
3. Check Supabase products_cache first — if hit, return cached ingredients
4. If cache miss → call Open Food Facts API
5. Extract ingredients_text from response
6. Cache result in Supabase products_cache
7. Return output contract dict

### Barcode Decoding
```python
import cv2
from pyzbar.pyzbar import decode
from PIL import Image
import numpy as np

def decode_barcode(image_file) -> str | None:
    img = Image.open(image_file)
    img_array = np.array(img)
    
    # Try color first
    barcodes = decode(img_array)
    
    # If not found, try grayscale
    if not barcodes:
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        barcodes = decode(gray)
    
    if barcodes:
        return barcodes[0].data.decode("utf-8")
    return None
```

### Open Food Facts API Call
```python
import requests

def fetch_from_openfoodfacts(barcode: str) -> dict | None:
    url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
    try:
        response = requests.get(url, timeout=5)
        data = response.json()
        if data.get("status") == 1:
            product = data.get("product", {})
            return {
                "ingredients_text": product.get("ingredients_text", ""),
                "product_name": product.get("product_name", None),
                "source": "barcode",
                "confidence": "HIGH"
            }
    except Exception as e:
        print(f"Open Food Facts error: {e}")
    return None
```

### Fallback if Barcode Not Found
If Open Food Facts returns no result:
- Show message: "Product not found in database"
- Automatically switch UI to OCR or manual input mode
- Do NOT crash or show error page

---

## Mode 2: OCR — Photo of Ingredient Label

### Flow
1. User uploads photo of ingredient label
2. Preprocess image (critical — never skip)
3. Run Tesseract OCR
4. Clean raw OCR text using Groq utility model (llama-3.1-8b-instant)
5. Show extracted text to user for correction if confidence is LOW
6. Return output contract dict

### Tesseract Setup (Windows)
```python
import pytesseract
import os
from dotenv import load_dotenv

load_dotenv()
pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_PATH")
# TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe
```

### Image Preprocessing — Always Apply In This Order
```python
import cv2
import numpy as np
from PIL import Image

def preprocess_image(image_file) -> np.ndarray:
    # Load image
    img = Image.open(image_file)
    img_array = np.array(img)
    
    # Step 1: Convert to grayscale
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    
    # Step 2: Apply Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    
    # Step 3: Apply adaptive threshold for better text extraction
    threshold = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )
    
    # Step 4: Denoise
    denoised = cv2.fastNlMeansDenoising(threshold, h=10)
    
    return denoised
```

### OCR Extraction
```python
def extract_text_from_image(image_file) -> dict:
    processed = preprocess_image(image_file)
    
    # Run Tesseract with best config for ingredient labels
    config = "--oem 3 --psm 6"
    raw_text = pytesseract.image_to_string(processed, config=config)
    
    # Get confidence data
    data = pytesseract.image_to_data(processed, output_type=pytesseract.Output.DICT)
    confidences = [int(c) for c in data["conf"] if c != "-1"]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0
    
    confidence_level = "HIGH" if avg_confidence > 70 else "MEDIUM" if avg_confidence > 40 else "LOW"
    
    return {
        "raw_text": raw_text,
        "confidence": confidence_level,
        "avg_confidence_score": avg_confidence
    }
```

### OCR Text Cleanup
After OCR extraction, always clean using Groq utility model:
```python
# Pass raw_text to clean_ocr_text() from SKILL_LLM.md
# Then return cleaned text as ingredients_text in output contract
```

### Low Confidence Handling
If confidence == "LOW":
- Show extracted text in an editable st.text_area
- Show message: "Label was difficult to read. Please check and correct the text below."
- Let user edit before analysis
- This is better than silently sending bad OCR output to LLM

---

## Mode 3: Manual Text Input

### Flow
1. User pastes or types ingredient list into st.text_area
2. Minimal cleanup (strip whitespace, normalize commas)
3. Return output contract dict directly

```python
def process_manual_input(text: str) -> dict:
    cleaned = text.strip().replace("\n", ", ").replace("  ", " ")
    return {
        "ingredients_text": cleaned,
        "product_name": None,
        "source": "manual",
        "confidence": "HIGH"
    }
```

---

## UI Input Mode Selection
Show three tabs or radio buttons at top of Scan page:
```
[ 📷 Scan Barcode ] [ 📸 Photo OCR ] [ ✍️ Manual Input ]
```
All three tabs lead to the same analysis function after producing the output contract.

## Supported Languages for OCR
Tesseract supports multilingual OCR. For IngredIQ add:
- English (default)
- German (common in Hamburg / EU products)
- Arabic (common on Halal products)
Add language parameter: `config = "--oem 3 --psm 6 -l eng+deu"`

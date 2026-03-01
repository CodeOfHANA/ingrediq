import os

import cv2
import numpy as np
import pytesseract
from dotenv import load_dotenv
from groq import Groq
from PIL import Image

load_dotenv()

pytesseract.pytesseract.tesseract_cmd = os.getenv(
    "TESSERACT_PATH", r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

UTILITY_MODEL = "llama-3.1-8b-instant"

_groq_client: Groq | None = None


def _get_groq() -> Groq:
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _groq_client


def preprocess_image(image_file) -> np.ndarray:
    img = Image.open(image_file)
    img_array = np.array(img)

    # Step 1: Convert to grayscale
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

    # Step 2: Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)

    # Step 3: Adaptive threshold for better text extraction
    threshold = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )

    # Step 4: Denoise
    denoised = cv2.fastNlMeansDenoising(threshold, h=10)

    return denoised


def extract_text_from_image(image_file) -> dict:
    processed = preprocess_image(image_file)

    config = "--oem 3 --psm 6 -l eng+deu"
    raw_text = pytesseract.image_to_string(processed, config=config)

    data = pytesseract.image_to_data(processed, output_type=pytesseract.Output.DICT)
    confidences = [int(c) for c in data["conf"] if c != "-1"]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0

    confidence_level = "HIGH" if avg_confidence > 70 else "MEDIUM" if avg_confidence > 40 else "LOW"

    return {
        "raw_text": raw_text,
        "confidence": confidence_level,
        "avg_confidence_score": avg_confidence
    }


def clean_ocr_text(raw_text: str) -> str:
    try:
        client = _get_groq()
        response = client.chat.completions.create(
            model=UTILITY_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a text cleanup assistant. "
                        "You will receive raw OCR text extracted from a product ingredient label. "
                        "Clean it up: fix obvious OCR errors, remove page numbers or irrelevant text, "
                        "format as a clean comma-separated ingredient list. "
                        "Return ONLY the cleaned ingredient list. Nothing else."
                    )
                },
                {"role": "user", "content": raw_text}
            ],
            temperature=0.0,
            max_tokens=500
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"OCR cleanup LLM error: {e}")
        return raw_text.strip()


def process_ocr(image_file) -> dict:
    ocr_result = extract_text_from_image(image_file)
    raw_text = ocr_result["raw_text"]
    confidence = ocr_result["confidence"]

    cleaned = clean_ocr_text(raw_text)

    return {
        "ingredients_text": cleaned,
        "product_name": None,
        "source": "ocr",
        "confidence": confidence,
        "raw_text": raw_text,
        "avg_confidence_score": ocr_result["avg_confidence_score"]
    }

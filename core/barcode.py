import cv2
import numpy as np
import requests
from PIL import Image
from pyzbar.pyzbar import decode

from core.supabase_client import get_cached_product, cache_product


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


def process_barcode(image_file) -> dict | None:
    barcode = decode_barcode(image_file)
    if not barcode:
        return None

    # Check Supabase cache first
    cached = get_cached_product(barcode)
    if cached:
        return {
            "ingredients_text": cached.get("ingredients_text", ""),
            "product_name": cached.get("product_name"),
            "source": "barcode",
            "confidence": "HIGH"
        }

    # Fetch from Open Food Facts
    result = fetch_from_openfoodfacts(barcode)
    if result:
        cache_product(
            barcode,
            result.get("product_name", ""),
            result.get("ingredients_text", "")
        )
        return result

    return None

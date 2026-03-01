import json
import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

PROFILE_PATH = Path("data/profiles/local.json")
HISTORY_PATH = Path("data/history/local.json")
USER_ID_PATH = Path("data/user_id.txt")


# ── User ID ───────────────────────────────────────────────────────────────────

def get_or_create_user_id() -> str:
    USER_ID_PATH.parent.mkdir(parents=True, exist_ok=True)
    if USER_ID_PATH.exists():
        uid = USER_ID_PATH.read_text().strip()
        if uid:
            return uid
    user_id = str(uuid.uuid4())
    USER_ID_PATH.write_text(user_id)
    return user_id


# ── Supabase client ───────────────────────────────────────────────────────────

def get_supabase_client() -> Client | None:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        return None
    try:
        return create_client(url, key)
    except Exception as e:
        print(f"Supabase client init error: {e}")
        return None


_supabase: Client | None = None


def _client() -> Client | None:
    global _supabase
    if _supabase is None:
        _supabase = get_supabase_client()
    return _supabase


# ── Profiles — Supabase ───────────────────────────────────────────────────────

def save_profile(profile: dict) -> bool:
    sb = _client()
    if sb is None:
        return False
    try:
        sb.table("profiles").upsert({
            "user_id": profile["user_id"],
            "name": profile.get("name"),
            "presets": profile.get("presets", []),
            "medical_conditions": profile.get("medical_conditions", []),
            "allergies": profile.get("allergies", []),
            "medications": profile.get("medications", []),
            "lab_values": profile.get("lab_values", {}),
            "preferences": profile.get("preferences", []),
            "updated_at": "now()"
        }).execute()
        return True
    except Exception as e:
        print(f"Supabase save_profile error: {e}")
        return False


def load_profile(user_id: str) -> dict | None:
    sb = _client()
    if sb is None:
        return None
    try:
        result = sb.table("profiles").select("*").eq("user_id", user_id).execute()
        if result.data:
            return result.data[0]
    except Exception as e:
        print(f"Supabase load_profile error: {e}")
    return None


# ── Profiles — Local fallback ─────────────────────────────────────────────────

def save_profile_local(profile: dict) -> None:
    try:
        PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(PROFILE_PATH, "w") as f:
            json.dump(profile, f, indent=2)
    except Exception as e:
        print(f"Local save_profile error: {e}")


def load_profile_local() -> dict | None:
    try:
        if PROFILE_PATH.exists():
            with open(PROFILE_PATH) as f:
                data = json.load(f)
                return data if data else None
    except Exception as e:
        print(f"Local load_profile error: {e}")
    return None


# ── Combined profile pattern ──────────────────────────────────────────────────

def save_profile_everywhere(profile: dict) -> None:
    save_profile_local(profile)   # Always local first
    save_profile(profile)         # Then Supabase


def load_profile_smart(user_id: str) -> dict | None:
    profile = load_profile(user_id)
    if profile:
        save_profile_local(profile)   # Keep local in sync
        return profile
    return load_profile_local()


# ── Scan history — Supabase ───────────────────────────────────────────────────

def save_scan(user_id: str, scan_data: dict, result: dict) -> bool:
    sb = _client()
    if sb is None:
        return False
    try:
        sb.table("scan_history").insert({
            "user_id": user_id,
            "product_name": scan_data.get("product_name"),
            "ingredients_text": scan_data.get("ingredients_text"),
            "source": scan_data.get("source"),
            "verdict": result.get("verdict"),
            "flags": result.get("flags", []),
            "summary": result.get("summary"),
            "llm_response": result,
            "scanned_at": "now()"
        }).execute()
        return True
    except Exception as e:
        print(f"Supabase save_scan error: {e}")
        return False


def load_history(user_id: str, limit: int = 20) -> list:
    sb = _client()
    if sb is None:
        return []
    try:
        result = sb.table("scan_history").select("*").eq("user_id", user_id)\
            .order("scanned_at", desc=True).limit(limit).execute()
        return result.data or []
    except Exception as e:
        print(f"Supabase load_history error: {e}")
        return []


# ── Scan history — Local fallback ─────────────────────────────────────────────

def save_history_local(scan: dict) -> None:
    try:
        HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        history = load_history_local()
        history.insert(0, scan)
        history = history[:50]
        with open(HISTORY_PATH, "w") as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        print(f"Local save_history error: {e}")


def load_history_local() -> list:
    try:
        if HISTORY_PATH.exists():
            with open(HISTORY_PATH) as f:
                return json.load(f)
    except Exception as e:
        print(f"Local load_history error: {e}")
    return []


# ── Products cache ────────────────────────────────────────────────────────────

def get_cached_product(barcode: str) -> dict | None:
    sb = _client()
    if sb is None:
        return None
    try:
        result = sb.table("products_cache").select("*").eq("barcode", barcode).execute()
        if result.data:
            return result.data[0]
    except Exception as e:
        print(f"Supabase cache lookup error: {e}")
    return None


def cache_product(barcode: str, product_name: str, ingredients_text: str) -> None:
    sb = _client()
    if sb is None:
        return
    try:
        sb.table("products_cache").upsert({
            "barcode": barcode,
            "product_name": product_name,
            "ingredients_text": ingredients_text,
            "fetched_at": "now()"
        }).execute()
    except Exception as e:
        print(f"Supabase cache write error: {e}")

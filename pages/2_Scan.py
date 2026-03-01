from datetime import datetime, timezone

import streamlit as st

from core.analyzer import analyze_ingredients, process_manual_input
from core.barcode import process_barcode
from core.ocr import process_ocr
from core.presets import PRESET_PROFILES, MEDICAL_PRESETS
from core.supabase_client import (
    get_or_create_user_id,
    load_profile_smart,
    save_scan,
    save_history_local,
)
from core.ui_style import inject_css

inject_css()

COLOR = {
    "safe":     "#059669",
    "caution":  "#d97706",
    "avoid":    "#dc2626",
    "primary":  "#4f46e5",
    "bg_light": "#f0f0ff",
    "border":   "#d1d5db",
}

VERDICT_COLOR = {"SAFE": COLOR["safe"], "CAUTION": COLOR["caution"], "AVOID": COLOR["avoid"]}
VERDICT_EMOJI = {"SAFE": "🟢", "CAUTION": "🟡", "AVOID": "🔴"}
VERDICT_LABEL = {"SAFE": "Safe to consume", "CAUTION": "Consume with caution", "AVOID": "Avoid this product"}

ERROR_MESSAGES = {
    "barcode_not_found": "Product not found in database. Try scanning the label or enter ingredients manually.",
    "ocr_failed":        "Could not read the label clearly. Please try manual input.",
    "llm_failed":        "Analysis temporarily unavailable. Please try again.",
    "supabase_failed":   "Sync unavailable — working in offline mode.",
    "no_profile":        "Please set up your profile first to get personalised results.",
}

# ── Session state guard ───────────────────────────────────────────────────────

if "user_id" not in st.session_state:
    st.session_state.user_id = get_or_create_user_id()

if "profile" not in st.session_state:
    st.session_state.profile = load_profile_smart(st.session_state.user_id) or {}

if "scan_history" not in st.session_state:
    st.session_state.scan_history = []

if "last_scan" not in st.session_state:
    st.session_state.last_scan = None

profile = st.session_state.profile

# ── Sidebar ───────────────────────────────────────────────────────────────────

with st.sidebar:
    st.markdown("### 🔍 IngredIQ")
    st.markdown("---")
    if profile.get("name"):
        st.caption(f"👤  {profile['name']}")
    active_presets = profile.get("presets", [])
    if active_presets:
        badges = "  ".join(PRESET_PROFILES[p]["emoji"] for p in active_presets if p in PRESET_PROFILES)
        st.caption(f"Active:  {badges}")
    active_medical = profile.get("medical_conditions", [])
    if active_medical:
        med_badges = "  ".join(MEDICAL_PRESETS[m]["emoji"] for m in active_medical if m in MEDICAL_PRESETS)
        st.caption(f"Medical:  {med_badges}")
    st.markdown("---")
    st.page_link("app.py",             label="🏠  Home")
    st.page_link("pages/1_Profile.py", label="👤  Profile")
    st.page_link("pages/3_History.py", label="📋  History")

# ── Profile guard ─────────────────────────────────────────────────────────────

st.markdown("""
<div style="padding: 32px 0 16px 0;">
    <h1 style="font-size:2rem; font-weight:800; margin:0 0 6px 0;">🔍 Scan Product</h1>
    <p style="color:#6b7280; font-size:0.9rem; margin:0;">
        Upload a barcode image, photograph the label, or paste ingredients manually.
    </p>
</div>
""", unsafe_allow_html=True)

if not profile.get("name") and not profile.get("presets") and not profile.get("medical_conditions"):
    st.error(ERROR_MESSAGES["no_profile"])
    st.page_link("pages/1_Profile.py", label="👤  Set up your profile →")
    st.stop()

# ── Helper functions ──────────────────────────────────────────────────────────

def show_verdict(result: dict):
    verdict = result.get("verdict", "CAUTION")
    color   = VERDICT_COLOR.get(verdict, COLOR["caution"])
    emoji   = VERDICT_EMOJI.get(verdict, "🟡")
    label   = VERDICT_LABEL.get(verdict, verdict)
    st.markdown(f"""
    <div style="
        background: {color}0d;
        border: 1.5px solid {color}60;
        border-radius: 14px;
        padding: 28px 32px;
        text-align: center;
        margin-bottom: 20px;
    ">
        <div style="font-size: 44px; margin-bottom: 8px;">{emoji}</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: {color}; margin-bottom: 6px; letter-spacing:-0.02em;">
            {verdict}
        </div>
        <div style="font-size: 0.85rem; font-weight: 500; color: {color}99; margin-bottom: 14px; text-transform:uppercase; letter-spacing:0.06em;">
            {label}
        </div>
        <p style="color: #374151; font-size:0.95rem; max-width:520px; margin:0 auto; line-height:1.65;">
            {result.get('summary', '')}
        </p>
    </div>
    """, unsafe_allow_html=True)


def show_flags(flags: list):
    if not flags:
        st.success("✓  No conflicts found with your profile.")
        return
    st.markdown(f"**{len(flags)} Issue(s) Found**")
    severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    sorted_flags   = sorted(flags, key=lambda x: severity_order.get(x.get("severity", "LOW"), 3))
    for flag in sorted_flags:
        sev = flag.get("severity", "LOW")
        severity_color = {"HIGH": "#dc2626", "MEDIUM": "#d97706", "LOW": "#2563eb"}.get(sev, "#6b7280")
        icon = "🔴" if sev == "HIGH" else "🟡" if sev == "MEDIUM" else "🔵"
        with st.expander(f"{icon}  {flag.get('ingredient', 'Unknown')}"):
            st.markdown(f"**Reason:** {flag.get('reason', '')}")
            st.markdown(f"**Conflicts with:** {flag.get('conflicts_with', '')}")
            st.markdown(
                f"<span style='background:{severity_color};color:white;padding:3px 10px;"
                f"border-radius:99px;font-size:11px;font-weight:600;letter-spacing:0.05em;'>"
                f"{sev}</span>",
                unsafe_allow_html=True
            )


def save_result(scan_data: dict, result: dict):
    user_id     = st.session_state.user_id
    scan_record = {**scan_data, **result, "scanned_at": datetime.now(timezone.utc).isoformat()}
    ok = save_scan(user_id, scan_data, result)
    if not ok:
        st.caption(f"⚠️ {ERROR_MESSAGES['supabase_failed']}")
    save_history_local(scan_record)
    st.session_state.scan_history.insert(0, scan_record)
    st.session_state.last_scan = result


def run_analysis(scan_data: dict):
    ingredients_text = scan_data.get("ingredients_text", "").strip()
    if not ingredients_text:
        st.warning("No ingredients text found. Please try another input method.")
        return

    if scan_data.get("product_name"):
        st.info(f"Product: **{scan_data['product_name']}**")

    with st.spinner("Analysing ingredients against your profile…"):
        result = analyze_ingredients(ingredients_text, profile)

    if not result:
        st.error(ERROR_MESSAGES["llm_failed"])
        return

    show_verdict(result)
    show_flags(result.get("flags", []))

    if result.get("alternative_suggestion"):
        st.info(f"💡 **Try instead:** {result['alternative_suggestion']}")

    save_result(scan_data, result)

    st.markdown("---")
    st.caption(
        "⚠️ IngredIQ is not a medical device. This analysis is based on your profile "
        "and general ingredient knowledge. Always consult your doctor or dietitian "
        "before making health decisions based on this information."
    )


# ── Input tabs ────────────────────────────────────────────────────────────────

tab1, tab2, tab3 = st.tabs(["📷  Barcode", "📸  Photo OCR", "✍️  Manual Input"])

# Tab 1: Barcode
with tab1:
    st.caption("Upload an image containing a product barcode.")
    uploaded_barcode = st.file_uploader(
        "Upload image", type=["jpg", "jpeg", "png"], key="barcode_upload"
    )
    if uploaded_barcode and st.button("🔍  Analyse Barcode", key="btn_barcode"):
        with st.spinner("Decoding barcode…"):
            scan_data = process_barcode(uploaded_barcode)
        if scan_data is None:
            st.warning(ERROR_MESSAGES["barcode_not_found"])
            st.info("Try the Photo OCR or Manual Input tabs instead.")
        else:
            run_analysis(scan_data)

# Tab 2: OCR
with tab2:
    st.caption("Upload a clear photo of the product's ingredient label.")
    uploaded_ocr = st.file_uploader(
        "Upload photo", type=["jpg", "jpeg", "png"], key="ocr_upload"
    )
    if uploaded_ocr and st.button("🔍  Extract & Analyse", key="btn_ocr"):
        with st.spinner("Reading label with OCR…"):
            try:
                scan_data = process_ocr(uploaded_ocr)
            except Exception as e:
                st.error(ERROR_MESSAGES["ocr_failed"])
                st.caption(str(e))
                scan_data = None

        if scan_data:
            if scan_data.get("confidence") == "LOW":
                st.warning("Label was difficult to read. Please check and correct the text below.")
                corrected = st.text_area(
                    "Extracted text (edit if needed)",
                    value=scan_data["ingredients_text"],
                    height=150,
                    key="ocr_corrected"
                )
                scan_data["ingredients_text"] = corrected
            run_analysis(scan_data)

# Tab 3: Manual
with tab3:
    st.caption("Paste or type the ingredient list from the product packaging.")
    manual_text = st.text_area(
        "Ingredient list",
        placeholder="e.g. Water, sugar, pork gelatin, sodium benzoate, wheat flour",
        height=150,
        key="manual_text"
    )
    if st.button("🔍  Analyse Ingredients", key="btn_manual") and manual_text.strip():
        scan_data = process_manual_input(manual_text)
        run_analysis(scan_data)

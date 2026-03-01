import streamlit as st

st.set_page_config(
    page_title="IngredIQ",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)

from core.supabase_client import get_or_create_user_id, load_profile_smart, load_history, load_history_local
from core.presets import PRESET_PROFILES, MEDICAL_PRESETS
from core.ui_style import inject_css

inject_css()

COLOR = {
    "safe":      "#059669",
    "caution":   "#d97706",
    "avoid":     "#dc2626",
    "primary":   "#4f46e5",
    "bg_light":  "#f0f0ff",
}

# ── Session state initialisation ──────────────────────────────────────────────

if "user_id" not in st.session_state:
    st.session_state.user_id = get_or_create_user_id()

if "profile" not in st.session_state:
    st.session_state.profile = load_profile_smart(st.session_state.user_id) or {}

if "scan_history" not in st.session_state:
    history = load_history(st.session_state.user_id)
    if not history:
        history = load_history_local()
    st.session_state.scan_history = history

if "last_scan" not in st.session_state:
    st.session_state.last_scan = None

# ── Sidebar ───────────────────────────────────────────────────────────────────

with st.sidebar:
    st.markdown("### 🔍 IngredIQ")
    st.markdown("---")
    profile = st.session_state.profile
    if profile.get("name"):
        st.caption(f"👤  {profile['name']}")
    else:
        st.caption("No profile set")

    active_presets = profile.get("presets", [])
    if active_presets:
        badges = "  ".join(PRESET_PROFILES[p]["emoji"] for p in active_presets if p in PRESET_PROFILES)
        st.caption(f"Active:  {badges}")

    active_medical = profile.get("medical_conditions", [])
    if active_medical:
        med_badges = "  ".join(MEDICAL_PRESETS[m]["emoji"] for m in active_medical if m in MEDICAL_PRESETS)
        st.caption(f"Medical:  {med_badges}")

    st.markdown("---")
    st.page_link("pages/1_Profile.py", label="👤  Profile")
    st.page_link("pages/2_Scan.py",    label="🔍  Scan")
    st.page_link("pages/3_History.py", label="📋  History")

# ── Hero ──────────────────────────────────────────────────────────────────────

st.markdown(f"""
<div style="padding: 48px 0 24px 0;">
    <div style="display:inline-block; background:{COLOR['primary']}12; border:1px solid {COLOR['primary']}30;
         border-radius:99px; padding:4px 14px; font-size:12px; font-weight:600;
         color:{COLOR['primary']}; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:16px;">
        Ingredient Intelligence
    </div>
    <h1 style="font-size:2.8rem; font-weight:800; color:#0d0d14; margin:0 0 12px 0; letter-spacing:-0.03em;">
        Know what's in your food.
    </h1>
    <p style="font-size:1.05rem; color:#6b7280; max-width:540px; margin:0; line-height:1.7;">
        Scan any product — barcode, label photo, or ingredient list — and get an instant,
        personalised safety verdict matched to your health profile.
    </p>
</div>
""", unsafe_allow_html=True)

# Stats row
col1, col2, col3 = st.columns(3)

with col1:
    preset_count  = len(st.session_state.profile.get("presets", []))
    medical_count = len(st.session_state.profile.get("medical_conditions", []))
    st.metric("Active Rules", preset_count + medical_count, help="Dietary presets + medical conditions")

with col2:
    st.metric("Scans Done", len(st.session_state.scan_history))

with col3:
    st.metric("Profile", st.session_state.profile.get("name", "—"))

st.markdown("---")

# ── Navigation cards ──────────────────────────────────────────────────────────

st.markdown("#### Get started")
c1, c2, c3 = st.columns(3)

_card_style = (
    "background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; "
    "padding:28px 24px; text-align:center; "
    "box-shadow:0 1px 4px rgba(0,0,0,0.04); "
    "transition:box-shadow 0.2s ease;"
)

with c1:
    st.markdown(f"""
    <div style="{_card_style}">
        <div style="font-size:32px; margin-bottom:10px;">👤</div>
        <div style="font-weight:600; font-size:0.95rem; color:#0d0d14; margin-bottom:6px;">Set Up Profile</div>
        <div style="font-size:0.8rem; color:#9ca3af; line-height:1.5;">
            Dietary presets, allergies, medical conditions &amp; lab values.
        </div>
    </div>
    """, unsafe_allow_html=True)
    st.page_link("pages/1_Profile.py", label="Go to Profile →")

with c2:
    st.markdown(f"""
    <div style="{_card_style}">
        <div style="font-size:32px; margin-bottom:10px;">🔍</div>
        <div style="font-weight:600; font-size:0.95rem; color:#0d0d14; margin-bottom:6px;">Scan a Product</div>
        <div style="font-size:0.8rem; color:#9ca3af; line-height:1.5;">
            Upload a barcode, photograph the label, or paste ingredients.
        </div>
    </div>
    """, unsafe_allow_html=True)
    st.page_link("pages/2_Scan.py", label="Go to Scan →")

with c3:
    st.markdown(f"""
    <div style="{_card_style}">
        <div style="font-size:32px; margin-bottom:10px;">📋</div>
        <div style="font-weight:600; font-size:0.95rem; color:#0d0d14; margin-bottom:6px;">View History</div>
        <div style="font-size:0.8rem; color:#9ca3af; line-height:1.5;">
            Review all your past scans and verdicts in one place.
        </div>
    </div>
    """, unsafe_allow_html=True)
    st.page_link("pages/3_History.py", label="Go to History →")

st.markdown("---")
st.caption(
    "⚠️ IngredIQ is not a medical device. Always consult your doctor or dietitian "
    "before making health decisions based on this information."
)

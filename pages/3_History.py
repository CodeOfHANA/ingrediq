import streamlit as st
from pathlib import Path
import json

from core.presets import PRESET_PROFILES, MEDICAL_PRESETS
from core.supabase_client import get_or_create_user_id, load_profile_smart, load_history_local
from core.ui_style import inject_css

inject_css()

VERDICT_COLOR = {
    "SAFE":    "#059669",
    "CAUTION": "#d97706",
    "AVOID":   "#dc2626",
}
VERDICT_EMOJI = {
    "SAFE":    "🟢",
    "CAUTION": "🟡",
    "AVOID":   "🔴",
}

# ── Session state guard ───────────────────────────────────────────────────────

if "user_id" not in st.session_state:
    st.session_state.user_id = get_or_create_user_id()

if "profile" not in st.session_state:
    st.session_state.profile = load_profile_smart(st.session_state.user_id) or {}

if "scan_history" not in st.session_state:
    st.session_state.scan_history = load_history_local()

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
    st.page_link("pages/2_Scan.py",    label="🔍  Scan")

# ── Page ──────────────────────────────────────────────────────────────────────

st.markdown("""
<div style="padding: 32px 0 16px 0;">
    <h1 style="font-size:2rem; font-weight:800; margin:0 0 6px 0;">📋 Scan History</h1>
    <p style="color:#6b7280; font-size:0.9rem; margin:0;">
        All your past ingredient analyses, newest first.
    </p>
</div>
""", unsafe_allow_html=True)

history = st.session_state.scan_history

if not history:
    st.info("No scans yet. Go to Scan to analyse your first product.")
    st.page_link("pages/2_Scan.py", label="🔍  Go to Scan →")
    st.stop()

# ── Stats ─────────────────────────────────────────────────────────────────────

verdicts = [s.get("verdict", "") for s in history]
col_a, col_b, col_c = st.columns(3)
with col_a:
    st.metric("Total Scans", len(history))
with col_b:
    st.metric("✅  Safe", verdicts.count("SAFE"))
with col_c:
    st.metric("🚫  Avoid", verdicts.count("AVOID"))

st.markdown("---")

# ── Clear button ──────────────────────────────────────────────────────────────

if st.button("🗑️  Clear History", type="secondary"):
    HISTORY_PATH = Path("data/history/local.json")
    try:
        with open(HISTORY_PATH, "w") as f:
            json.dump([], f)
    except Exception:
        pass
    st.session_state.scan_history = []
    st.rerun()

st.markdown("---")

# ── History list ──────────────────────────────────────────────────────────────

for scan in history:
    col1, col2, col3 = st.columns([3, 1, 1])
    with col1:
        product = scan.get("product_name") or "Unknown Product"
        st.markdown(f"**{product}**")
        scanned_at = scan.get("scanned_at", "")
        if scanned_at:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(scanned_at.replace("Z", "+00:00"))
                st.caption(dt.strftime("%d %b %Y, %H:%M"))
            except Exception:
                st.caption(scanned_at[:16])
        else:
            st.caption("—")
    with col2:
        verdict = scan.get("verdict", "")
        color   = VERDICT_COLOR.get(verdict, "#6b7280")
        emoji   = VERDICT_EMOJI.get(verdict, "⚪")
        st.markdown(
            f"<span style='color:{color}; font-weight:600; font-size:0.9rem;'>"
            f"{emoji}  {verdict}</span>",
            unsafe_allow_html=True
        )
    with col3:
        source = scan.get("source", "").upper()
        st.caption(source)
    st.divider()

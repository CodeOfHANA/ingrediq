import streamlit as st
from datetime import datetime, timezone

from core.presets import PRESET_PROFILES, MEDICAL_PRESETS
from core.supabase_client import save_profile_everywhere, get_or_create_user_id, load_profile_smart
from core.ui_style import inject_css

inject_css()

COLOR = {
    "primary":  "#4f46e5",
    "bg_light": "#f0f0ff",
    "border":   "#d1d5db",
}

# ── Session state guard ───────────────────────────────────────────────────────

if "user_id" not in st.session_state:
    st.session_state.user_id = get_or_create_user_id()

if "profile" not in st.session_state:
    st.session_state.profile = load_profile_smart(st.session_state.user_id) or {}

profile = st.session_state.profile


def _init_profile_field(key, default):
    if key not in profile:
        profile[key] = default


_init_profile_field("name", "")
_init_profile_field("presets", [])
_init_profile_field("medical_conditions", [])
_init_profile_field("allergies", [])
_init_profile_field("medications", [])
_init_profile_field("lab_values", {
    "blood_sugar_mmol":  None,
    "cholesterol_mmol":  None,
    "sodium_mmol":       None,
    "creatinine_umol":   None,
    "potassium_mmol":    None
})
_init_profile_field("preferences", [])

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
    st.page_link("pages/2_Scan.py",    label="🔍  Scan")
    st.page_link("pages/3_History.py", label="📋  History")

# ── Page header ───────────────────────────────────────────────────────────────

st.markdown("""
<div style="padding: 32px 0 8px 0;">
    <h1 style="font-size:2rem; font-weight:800; margin:0 0 6px 0;">👤 Your Profile</h1>
    <p style="color:#6b7280; font-size:0.9rem; margin:0;">
        Set your dietary, religious, and medical profile to get personalised ingredient analysis.
    </p>
</div>
""", unsafe_allow_html=True)

st.markdown("---")

# ── Name ──────────────────────────────────────────────────────────────────────

st.markdown("**Name**")
name_val = st.text_input("Your name", value=profile.get("name", ""), placeholder="e.g. Sarah", label_visibility="collapsed")
profile["name"] = name_val

st.markdown("---")

# ── Dietary & Religious Presets ───────────────────────────────────────────────

st.markdown("**Dietary & Religious Presets**")
st.caption("Select all that apply — most restrictive rule always wins when multiple are active.")


def toggle_preset(key: str):
    presets = profile.get("presets", [])
    if key in presets:
        presets.remove(key)
    else:
        presets.append(key)
    profile["presets"] = presets


presets_list = list(PRESET_PROFILES.items())
cols = st.columns(4)
for i, (key, preset) in enumerate(presets_list):
    with cols[i % 4]:
        selected = key in profile.get("presets", [])
        border_color = preset["color"] if selected else "#e5e7eb"
        checkmark = "✓ " if selected else ""
        st.markdown(
            f"""<div style="border:2px solid {border_color};border-radius:8px;
            padding:3px;margin-bottom:4px;transition:border-color 0.15s ease;"></div>""",
            unsafe_allow_html=True
        )
        if st.button(
            f"{preset['emoji']} {checkmark}{preset['label']}",
            key=f"preset_{key}",
            use_container_width=True
        ):
            toggle_preset(key)
            st.rerun()

st.markdown("---")

# ── Medical Conditions ────────────────────────────────────────────────────────

st.markdown("**Medical Conditions**")
medical_options = list(MEDICAL_PRESETS.keys())
selected_medical = st.multiselect(
    "Select your medical conditions",
    options=medical_options,
    default=[m for m in profile.get("medical_conditions", []) if m in MEDICAL_PRESETS],
    format_func=lambda x: f"{MEDICAL_PRESETS[x]['emoji']} {MEDICAL_PRESETS[x]['label']}",
    label_visibility="collapsed"
)
profile["medical_conditions"] = selected_medical

st.markdown("---")

# ── Allergies ─────────────────────────────────────────────────────────────────

st.markdown("**Allergies & Intolerances**")

col_in, col_btn = st.columns([4, 1])
with col_in:
    allergy_input = st.text_input(
        "Add allergy", placeholder="e.g. peanuts",
        label_visibility="collapsed", key="allergy_input"
    )
with col_btn:
    if st.button("Add", key="add_allergy") and allergy_input.strip():
        allergy = allergy_input.strip().lower()
        if allergy not in profile["allergies"]:
            profile["allergies"].append(allergy)
        st.rerun()

if profile["allergies"]:
    tag_cols = st.columns(min(len(profile["allergies"]), 6))
    to_remove = None
    for i, allergy in enumerate(profile["allergies"]):
        with tag_cols[i % 6]:
            if st.button(f"✕ {allergy}", key=f"rm_allergy_{i}"):
                to_remove = allergy
    if to_remove:
        profile["allergies"].remove(to_remove)
        st.rerun()
else:
    st.caption("No allergies added yet.")

st.markdown("---")

# ── Medications ───────────────────────────────────────────────────────────────

st.markdown("**Medications**")

col_med, col_medbtn = st.columns([4, 1])
with col_med:
    med_input = st.text_input(
        "Add medication", placeholder="e.g. warfarin",
        label_visibility="collapsed", key="med_input"
    )
with col_medbtn:
    if st.button("Add", key="add_med") and med_input.strip():
        med = med_input.strip()
        if med not in profile["medications"]:
            profile["medications"].append(med)
        st.rerun()

if profile["medications"]:
    med_cols = st.columns(min(len(profile["medications"]), 6))
    to_remove_med = None
    for i, med in enumerate(profile["medications"]):
        with med_cols[i % 6]:
            if st.button(f"✕ {med}", key=f"rm_med_{i}"):
                to_remove_med = med
    if to_remove_med:
        profile["medications"].remove(to_remove_med)
        st.rerun()
else:
    st.caption("No medications added yet.")

st.markdown("---")

# ── Lab Values ────────────────────────────────────────────────────────────────

st.markdown("**Lab Values** *(optional)*")
st.caption("Leave blank if not applicable. These help personalise the analysis.")

lab = profile.get("lab_values", {})

lc1, lc2 = st.columns(2)
with lc1:
    bs   = lab.get("blood_sugar_mmol")
    lab["blood_sugar_mmol"] = st.number_input(
        "Blood Sugar (mmol/L)", min_value=0.0, max_value=50.0, step=0.1,
        value=float(bs) if bs is not None else 0.0, help="Fasting blood glucose"
    ) or None

    chol = lab.get("cholesterol_mmol")
    lab["cholesterol_mmol"] = st.number_input(
        "Total Cholesterol (mmol/L)", min_value=0.0, max_value=20.0, step=0.1,
        value=float(chol) if chol is not None else 0.0,
    ) or None

    sodium = lab.get("sodium_mmol")
    lab["sodium_mmol"] = st.number_input(
        "Sodium (mmol/L)", min_value=0.0, max_value=200.0, step=0.1,
        value=float(sodium) if sodium is not None else 0.0,
    ) or None

with lc2:
    creat = lab.get("creatinine_umol")
    lab["creatinine_umol"] = st.number_input(
        "Creatinine (μmol/L)", min_value=0.0, max_value=2000.0, step=1.0,
        value=float(creat) if creat is not None else 0.0,
    ) or None

    pot = lab.get("potassium_mmol")
    lab["potassium_mmol"] = st.number_input(
        "Potassium (mmol/L)", min_value=0.0, max_value=20.0, step=0.1,
        value=float(pot) if pot is not None else 0.0,
    ) or None

profile["lab_values"] = lab

st.markdown("---")

# ── Save ──────────────────────────────────────────────────────────────────────

if st.button("💾 Save Profile", type="primary", use_container_width=True):
    profile["user_id"]    = st.session_state.user_id
    profile["updated_at"] = datetime.now(timezone.utc).isoformat()
    if "created_at" not in profile:
        profile["created_at"] = profile["updated_at"]

    st.session_state.profile = profile
    save_profile_everywhere(profile)
    st.success("✓  Profile saved successfully.")
    st.balloons()

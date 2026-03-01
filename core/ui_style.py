import streamlit as st


def inject_css():
    """Inject global CSS for the IngredIQ app — call once at the top of every page."""
    st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

/* ── Global reset ──────────────────────────────────────────────────────────── */
html, body, [class*="css"] {
    font-family: 'Inter', sans-serif !important;
}

/* ── Hide default Streamlit chrome ─────────────────────────────────────────── */
#MainMenu { visibility: hidden; }
footer { visibility: hidden; }
header { visibility: hidden; }

/* ── Hide auto-generated Streamlit sidebar navigation ───────────────────────── */
[data-testid="stSidebarNavItems"],
[data-testid="stSidebarNavSeparator"],
[data-testid="collapsedControl"] ~ div [data-testid="stSidebarNavItems"],
section[data-testid="stSidebar"] ul {
    display: none !important;
}

/* ── Main content area ─────────────────────────────────────────────────────── */
.block-container {
    padding-top: 2rem !important;
    padding-bottom: 3rem !important;
    max-width: 900px !important;
}

/* ── Dark sidebar ──────────────────────────────────────────────────────────── */
[data-testid="stSidebar"] {
    background-color: #0d0d14 !important;
    border-right: 1px solid #1e1e2e !important;
}
[data-testid="stSidebar"] * {
    color: #c9c9d6 !important;
}
[data-testid="stSidebar"] .stMarkdown h1,
[data-testid="stSidebar"] .stMarkdown h2,
[data-testid="stSidebar"] .stMarkdown h3 {
    color: #ffffff !important;
    font-size: 1.1rem !important;
    font-weight: 700 !important;
    letter-spacing: 0.03em !important;
}
[data-testid="stSidebar"] hr {
    border-color: #1e1e2e !important;
}
[data-testid="stSidebar"] [data-testid="stPageLink"] {
    border-radius: 8px !important;
    padding: 6px 10px !important;
    transition: background 0.15s ease !important;
}
[data-testid="stSidebar"] [data-testid="stPageLink"]:hover {
    background: #1e1e30 !important;
}
[data-testid="stSidebar"] [data-testid="stPageLink"] p {
    font-size: 0.88rem !important;
    font-weight: 500 !important;
}
[data-testid="stSidebar"] [data-testid="stCaptionContainer"] p {
    font-size: 0.78rem !important;
    color: #6b6b80 !important;
}

/* ── Typography ────────────────────────────────────────────────────────────── */
h1 { font-weight: 700 !important; letter-spacing: -0.02em !important; color: #0d0d14 !important; }
h2 { font-weight: 600 !important; letter-spacing: -0.01em !important; color: #1a1a2e !important; }
h3 { font-weight: 600 !important; color: #1a1a2e !important; }
p, li { color: #374151 !important; line-height: 1.65 !important; }

/* ── Metric cards ──────────────────────────────────────────────────────────── */
[data-testid="stMetric"] {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 16px 20px !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: box-shadow 0.2s ease;
}
[data-testid="stMetric"]:hover {
    box-shadow: 0 4px 12px rgba(79,70,229,0.08);
}
[data-testid="stMetricLabel"] {
    font-size: 0.75rem !important;
    font-weight: 600 !important;
    letter-spacing: 0.06em !important;
    text-transform: uppercase !important;
    color: #9ca3af !important;
}
[data-testid="stMetricValue"] {
    font-size: 1.6rem !important;
    font-weight: 700 !important;
    color: #0d0d14 !important;
}

/* ── Buttons ───────────────────────────────────────────────────────────────── */
.stButton > button {
    font-family: 'Inter', sans-serif !important;
    font-weight: 500 !important;
    font-size: 0.875rem !important;
    border-radius: 8px !important;
    transition: all 0.15s ease !important;
    border: 1px solid #e5e7eb !important;
}
.stButton > button[kind="primary"] {
    background: #4f46e5 !important;
    border-color: #4f46e5 !important;
    color: #ffffff !important;
}
.stButton > button[kind="primary"]:hover {
    background: #4338ca !important;
    border-color: #4338ca !important;
    box-shadow: 0 4px 12px rgba(79,70,229,0.3) !important;
    transform: translateY(-1px) !important;
}
.stButton > button:not([kind="primary"]):hover {
    border-color: #4f46e5 !important;
    color: #4f46e5 !important;
}

/* ── Tabs ──────────────────────────────────────────────────────────────────── */
[data-testid="stTabs"] [role="tab"] {
    font-family: 'Inter', sans-serif !important;
    font-size: 0.875rem !important;
    font-weight: 500 !important;
    padding: 8px 16px !important;
    border-radius: 6px 6px 0 0 !important;
    color: #6b7280 !important;
}
[data-testid="stTabs"] [role="tab"][aria-selected="true"] {
    color: #4f46e5 !important;
    font-weight: 600 !important;
}

/* ── Text inputs & text areas ──────────────────────────────────────────────── */
.stTextInput > div > div > input,
.stTextArea > div > div > textarea {
    font-family: 'Inter', sans-serif !important;
    font-size: 0.9rem !important;
    border-radius: 8px !important;
    border-color: #e5e7eb !important;
    background: #fafafa !important;
}
.stTextInput > div > div > input:focus,
.stTextArea > div > div > textarea:focus {
    border-color: #4f46e5 !important;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.1) !important;
}

/* ── Number inputs ─────────────────────────────────────────────────────────── */
.stNumberInput > div > div > input {
    border-radius: 8px !important;
    border-color: #e5e7eb !important;
}

/* ── Multiselect ───────────────────────────────────────────────────────────── */
[data-testid="stMultiSelect"] > div > div {
    border-radius: 8px !important;
    border-color: #e5e7eb !important;
}

/* ── Expanders ─────────────────────────────────────────────────────────────── */
[data-testid="stExpander"] {
    border: 1px solid #e5e7eb !important;
    border-radius: 10px !important;
    background: #fafafa !important;
    margin-bottom: 8px !important;
}
[data-testid="stExpander"] summary {
    font-weight: 500 !important;
    font-size: 0.9rem !important;
    padding: 10px 14px !important;
}

/* ── File uploader ─────────────────────────────────────────────────────────── */
[data-testid="stFileUploader"] {
    border: 2px dashed #e5e7eb !important;
    border-radius: 12px !important;
    background: #fafafa !important;
    padding: 12px !important;
    transition: border-color 0.2s ease !important;
}
[data-testid="stFileUploader"]:hover {
    border-color: #4f46e5 !important;
}

/* ── Dividers ──────────────────────────────────────────────────────────────── */
hr { border-color: #f3f4f6 !important; margin: 1.5rem 0 !important; }

/* ── Info / warning / error / success alerts ───────────────────────────────── */
[data-testid="stAlert"] {
    border-radius: 10px !important;
    font-size: 0.875rem !important;
}

/* ── Scrollbar (webkit) ────────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }
::-webkit-scrollbar-thumb:hover { background: #9ca3af; }

</style>
""", unsafe_allow_html=True)

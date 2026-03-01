# IngredIQ — UI Skill File

---

## Next.js / CSS Patterns (Active App)

### Styling approach
All styles live in `frontend/app/globals.css`. No component library — pure custom CSS with design tokens.

### Design tokens (CSS variables)
```css
--primary: #2d6a4f;        /* herb green */
--primary-lt: #40916c;     /* sage hover */
--primary-dk: #1b4332;     /* deep forest */
--accent: #d4a017;         /* turmeric gold */
--safe: #1b7a4a; --safe-bg: #d8f3e3;
--caution: #c77c1a; --caution-bg: #fdefd3;
--avoid: #a82c2c; --avoid-bg: #fde0e0;
--bg: #faf8f3;             /* warm parchment */
--surface: #ffffff;
--surface-warm: #f5f0e8;
--text: #1a1a14;
--text-muted: #6b6b55;
--border: #e0dbd0;
--radius: 12px;
```

### Key CSS classes
| Class | Purpose |
|---|---|
| `.verdict-card.safe/caution/avoid` | Verdict result card |
| `.confidence-badge` | Pill under verdict label (HIGH/MEDIUM/LOW) |
| `.share-btn` / `.share-toast` | Share button + clipboard toast |
| `.flag-item` / `.flag-toggle` / `.flag-body` | Expandable flag accordion |
| `.chat-section` / `.chat-bubble-user` / `.chat-bubble-assistant` | AI chat UI |
| `.chat-input-row` | Chat input + send button row |
| `.onboarding-card` / `.onboarding-step-indicator` | 2-step onboarding wizard |
| `.preset-btn` / `.preset-btn--active` | Dietary preset toggle buttons |
| `.alert-error` / `.alert-warn` / `.alert-info` | Alert banners |
| `.btn` / `.btn-primary` / `.btn-full` / `.btn-sm` | Buttons |
| `.spinner` / `.spinner-wrap` | Loading states |

### Component patterns

#### VerdictCard
Accepts `result: ScanResult`, `confidence?: Confidence`, `productName?: string`.
Renders verdict + confidence badge + share button (navigator.share on mobile, clipboard on desktop).

#### FlagList
Accepts `flags: Flag[]`. Each flag is an expandable accordion item showing ingredient, reason, severity pill, conflicts_with.

#### Sidebar
Self-fetches profile — re-fetches on every `pathname` change (usePathname as useEffect dependency). Do NOT pass profile as prop.

#### Onboarding wizard (app/page.tsx)
- Checks if profile exists on mount
- New users → 2-step wizard (name + presets → allergies + medical) → saves → redirects to /scan
- Returning users → normal home page

### Adding new CSS classes
Always add to `globals.css`, in the relevant section before the `/* ── Scrollbar */` comment.
Follow the existing naming: `.component-name`, `.component-name--modifier`.

### Mobile responsive
- ≤1024px: sidebar collapses to icon-only (64px)
- ≤640px: sidebar hidden, bottom nav shown (`BottomNav.tsx`)
- Add mobile overrides in the `@media (max-width: 640px)` block at the bottom of globals.css

---

## Legacy: Streamlit UI Patterns

### App Structure
Multipage Streamlit app. Entry point is app.py.

```
app.py              → Home / landing page with app intro
pages/
├── 1_Profile.py   → Profile setup and management
├── 2_Scan.py      → Product scanning (barcode + OCR + manual)
└── 3_History.py   → Past scan history
```

## Color System — Always Use These Exact Values
```python
COLOR = {
    "safe":       "#059669",   # Green — SAFE verdict
    "caution":    "#d97706",   # Amber — CAUTION verdict
    "avoid":      "#dc2626",   # Red — AVOID verdict
    "primary":    "#4f46e5",   # Indigo — primary accent
    "bg_light":   "#f0f0ff",   # Light indigo — card backgrounds
    "text_dark":  "#1a1a2e",   # Dark navy — headings
    "text_gray":  "#6b7280",   # Gray — secondary text
    "white":      "#ffffff",
    "border":     "#d1d5db"    # Light gray — borders
}

VERDICT_COLOR = {
    "SAFE":    COLOR["safe"],
    "CAUTION": COLOR["caution"],
    "AVOID":   COLOR["avoid"]
}

VERDICT_EMOJI = {
    "SAFE":    "🟢",
    "CAUTION": "🟡",
    "AVOID":   "🔴"
}
```

## Streamlit Page Config — Always Set This in app.py
```python
st.set_page_config(
    page_title="IngredIQ",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)
```

## Sidebar — Always Show
```python
# In every page, show in sidebar:
# - IngredIQ logo/title
# - Active profile name
# - Active preset badges (small)
# - Navigation links
with st.sidebar:
    st.title("🔍 IngredIQ")
    if st.session_state.get("profile"):
        st.caption(f"Profile: {st.session_state.profile['name']}")
        presets = st.session_state.profile.get("presets", [])
        if presets:
            st.caption("Active: " + " ".join([PRESET_PROFILES[p]["emoji"] for p in presets]))
```

## Session State Keys — Always Use These Names
```python
st.session_state.user_id        # string UUID
st.session_state.profile        # dict — full user profile
st.session_state.last_scan      # dict — last scan result
st.session_state.scan_history   # list of past scan result dicts
```

## Profile Page UI Pattern

### Preset Badge Grid
```python
# Show presets as clickable cards in 4-column grid
presets_list = list(PRESET_PROFILES.items())
cols = st.columns(4)
for i, (key, preset) in enumerate(presets_list):
    with cols[i % 4]:
        selected = key in st.session_state.profile.get("presets", [])
        border_color = preset["color"] if selected else COLOR["border"]
        checkmark = "✓ " if selected else ""
        if st.button(
            f"{preset['emoji']} {checkmark}{preset['label']}",
            key=f"preset_{key}",
            use_container_width=True
        ):
            # Toggle preset selection
            toggle_preset(key)
```

### Medical Conditions — Use Multiselect
```python
st.multiselect(
    "Medical Conditions",
    options=["diabetes", "hypertension", "kidney_disease"],
    format_func=lambda x: MEDICAL_PRESETS[x]["label"],
    key="medical_conditions"
)
```

### Allergies — Use Text Input + Tag Display
```python
allergy_input = st.text_input("Add allergy (press Enter)")
# Show existing allergies as removable tags below
```

## Scan Page UI Pattern

### Input Mode Tabs
```python
tab1, tab2, tab3 = st.tabs(["📷 Scan Barcode", "📸 Photo OCR", "✍️ Manual Input"])

with tab1:
    uploaded = st.file_uploader("Upload image with barcode", type=["jpg","jpeg","png"])
    
with tab2:
    uploaded = st.file_uploader("Upload photo of ingredient label", type=["jpg","jpeg","png"])
    
with tab3:
    text = st.text_area("Paste ingredient list here", height=150)
```

## Verdict Display — Always Use This Layout

### Large Verdict Card at Top
```python
def show_verdict(result: dict):
    verdict = result["verdict"]
    color = VERDICT_COLOR[verdict]
    emoji = VERDICT_EMOJI[verdict]
    
    st.markdown(f"""
    <div style="
        background-color: {color}15;
        border: 3px solid {color};
        border-radius: 12px;
        padding: 24px;
        text-align: center;
        margin-bottom: 20px;
    ">
        <h1 style="color: {color}; margin: 0; font-size: 48px;">{emoji}</h1>
        <h2 style="color: {color}; margin: 8px 0;">{verdict}</h2>
        <p style="color: #374151; margin: 0;">{result['summary']}</p>
    </div>
    """, unsafe_allow_html=True)
```

### Flags as Expandable Accordion
```python
def show_flags(flags: list):
    if not flags:
        st.success("No conflicts found with your profile.")
        return
    
    st.subheader(f"⚠️ {len(flags)} Issue(s) Found")
    
    severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    sorted_flags = sorted(flags, key=lambda x: severity_order.get(x["severity"], 3))
    
    for flag in sorted_flags:
        severity_color = {
            "HIGH": "#dc2626",
            "MEDIUM": "#d97706", 
            "LOW": "#2563eb"
        }.get(flag["severity"], "#6b7280")
        
        with st.expander(f"🔴 {flag['ingredient']}" if flag['severity'] == 'HIGH' 
                        else f"🟡 {flag['ingredient']}" if flag['severity'] == 'MEDIUM'
                        else f"🔵 {flag['ingredient']}"):
            st.markdown(f"**Reason:** {flag['reason']}")
            st.markdown(f"**Conflicts with:** {flag['conflicts_with']}")
            st.markdown(
                f"<span style='background:{severity_color};color:white;padding:2px 8px;"
                f"border-radius:4px;font-size:12px;'>{flag['severity']}</span>",
                unsafe_allow_html=True
            )
```

### Alternative Suggestion
```python
if result.get("alternative_suggestion"):
    st.info(f"💡 **Try instead:** {result['alternative_suggestion']}")
```

### Disclaimer — Always Show at Bottom
```python
st.caption(
    "⚠️ IngredIQ is not a medical device. This analysis is based on your profile "
    "and general ingredient knowledge. Always consult your doctor or dietitian "
    "before making health decisions based on this information."
)
```

## History Page UI Pattern
```python
# Show scan history as cards in reverse chronological order
for scan in reversed(st.session_state.scan_history):
    col1, col2, col3 = st.columns([3, 1, 1])
    with col1:
        st.write(f"**{scan.get('product_name', 'Unknown Product')}**")
        st.caption(scan.get('scanned_at', ''))
    with col2:
        verdict = scan.get('verdict', '')
        color = VERDICT_COLOR.get(verdict, '#6b7280')
        emoji = VERDICT_EMOJI.get(verdict, '⚪')
        st.markdown(f"<span style='color:{color}'>{emoji} {verdict}</span>", 
                   unsafe_allow_html=True)
    with col3:
        st.caption(scan.get('source', '').upper())
    st.divider()
```

## Error State Messages — Always User Friendly
```python
ERROR_MESSAGES = {
    "barcode_not_found": "Product not found in database. Try scanning the label or enter ingredients manually.",
    "ocr_failed": "Could not read the label clearly. Please try manual input.",
    "llm_failed": "Analysis temporarily unavailable. Please try again.",
    "supabase_failed": "Sync unavailable — working in offline mode.",
    "no_profile": "Please set up your profile first to get personalized results."
}
```

## Loading States
Always show spinner during:
- Barcode API lookup
- OCR processing
- LLM analysis

```python
with st.spinner("Analyzing ingredients against your profile..."):
    result = analyze_ingredients(ingredients_text, profile)
```

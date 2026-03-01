'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PresetGrid } from '@/components/PresetGrid'
import { MEDICAL_PRESETS } from '@/lib/presets'

const USER_ID_KEY = 'ingrediq_user_id'
function getUserId(): string {
    if (typeof window === 'undefined') return ''
    let id = localStorage.getItem(USER_ID_KEY)
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(USER_ID_KEY, id) }
    return id
}

const stats = [
    { label: 'AI Analysis Engine', value: 'AI', desc: 'Powered by Llama 3.3 70B' },
    { label: 'Dietary Presets', value: '12+', desc: 'Halal, Vegan, Kosher, Jain & more' },
    { label: 'Input Methods', value: '3', desc: 'Barcode · Photo OCR · Manual' },
]

const cards = [
    {
        href: '/profile',
        icon: '🥗',
        title: 'Build Your Food Profile',
        desc: 'Set dietary presets, allergies, medical conditions & lab values so every scan is personalised.',
        cta: 'Set up profile →',
    },
    {
        href: '/scan',
        icon: '🔬',
        title: 'Scan an Ingredient Label',
        desc: 'Barcode lookup, photograph the ingredient list with OCR, or paste text directly.',
        cta: 'Start scanning →',
    },
    {
        href: '/history',
        icon: '📊',
        title: 'Review Scan History',
        desc: 'Your last 50 ingredient analyses — verdicts, flags, and summaries at a glance.',
        cta: 'View history →',
    },
]

// ── Onboarding wizard (shown only to new users) ───────────────────────────────

function OnboardingWizard() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [name, setName] = useState('')
    const [presets, setPresets] = useState<string[]>([])
    const [allergies, setAllergies] = useState<string[]>([])
    const [allergyInput, setAllergyInput] = useState('')
    const [medical, setMedical] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const addAllergy = () => {
        const t = allergyInput.trim()
        if (t && !allergies.includes(t)) setAllergies(a => [...a, t])
        setAllergyInput('')
    }

    const toggleMedical = (key: string) =>
        setMedical(m => m.includes(key) ? m.filter(k => k !== key) : [...m, key])

    const save = async () => {
        if (!name.trim()) { setError('Please enter your name to continue.'); return }
        setSaving(true); setError(null)
        try {
            const userId = getUserId()
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    name: name.trim(),
                    presets,
                    medical_conditions: medical,
                    allergies,
                    medications: [],
                    lab_values: {},
                    preferences: [],
                }),
            })
            const data = await res.json()
            if (!data.ok) throw new Error(data.error)
            router.push('/scan')
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Save failed. Please try again.')
            setSaving(false)
        }
    }

    return (
        <>
            <div className="page-header">
                <h1>🌿 Welcome to IngredIQ</h1>
                <p>Let&apos;s set up your health profile in 2 quick steps so every scan is personalised.</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="onboarding-card">
                <div className="onboarding-step-indicator">Step {step} of 2</div>

                {step === 1 && (
                    <>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1rem' }}>
                            Who are you? &amp; Dietary preferences
                        </h2>

                        <div className="form-section">
                            <label className="form-label">Your Name</label>
                            <input
                                className="input"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Aisha"
                                autoFocus
                            />
                        </div>

                        <div className="form-section">
                            <label className="form-label">Dietary &amp; Religious Restrictions</label>
                            <p className="form-hint">Select all that apply — you can change these later.</p>
                            <PresetGrid selected={presets} onChange={setPresets} />
                        </div>

                        <div className="onboarding-nav">
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>You can edit this anytime in Profile</span>
                            <button
                                className="btn btn-primary"
                                onClick={() => { if (!name.trim()) { setError('Please enter your name.'); return }; setError(null); setStep(2) }}
                            >
                                Next →
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1rem' }}>
                            Allergies &amp; Medical Conditions
                        </h2>

                        <div className="form-section">
                            <label className="form-label">Allergies &amp; Intolerances</label>
                            <div className="input-row">
                                <input
                                    className="input"
                                    value={allergyInput}
                                    onChange={e => setAllergyInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAllergy())}
                                    placeholder="e.g. peanuts, sesame (press Enter)"
                                />
                                <button type="button" className="btn" onClick={addAllergy}>Add</button>
                            </div>
                            {allergies.length > 0 && (
                                <div className="tags" style={{ marginTop: 8 }}>
                                    {allergies.map(a => (
                                        <span key={a} className="tag">
                                            {a}
                                            <button onClick={() => setAllergies(prev => prev.filter(x => x !== a))}>✕</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="form-section">
                            <label className="form-label">Medical Conditions</label>
                            <div className="preset-grid">
                                {Object.entries(MEDICAL_PRESETS).map(([key, mc]) => {
                                    const active = medical.includes(key)
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => toggleMedical(key)}
                                            className={`preset-btn${active ? ' preset-btn--active' : ''}`}
                                            style={active ? { borderColor: '#6366f1', background: '#6366f114', color: '#6366f1' } : undefined}
                                        >
                                            <span className="preset-emoji">{mc.emoji}</span>
                                            <span className="preset-label">{active ? '✓ ' : ''}{mc.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="onboarding-nav">
                            <button className="btn" onClick={() => setStep(1)}>← Back</button>
                            <button className="btn btn-primary" onClick={save} disabled={saving}>
                                {saving ? 'Saving…' : '🚀 Start Scanning →'}
                            </button>
                        </div>
                    </>
                )}
            </div>

            <p className="disclaimer">
                ⚠️ IngredIQ is not a medical device. Always consult your doctor or dietitian before making
                health decisions based on this information.
            </p>
        </>
    )
}

// ── Normal home page (returning users) ───────────────────────────────────────

function HomePage() {
    return (
        <>
            <section className="hero">
                <div className="hero-tag">🌿 Ingredient Intelligence</div>
                <h1>
                    Know what&apos;s in
                    <br />
                    your food.{' '}
                    <span style={{ color: 'var(--primary)', display: 'inline-block' }}>🥦</span>
                </h1>
                <p>
                    Scan any product — barcode, label photo, or ingredient list — and get an instant,
                    personalised safety verdict matched to your health profile. No guesswork, no jargon.
                </p>
            </section>

            <div className="stat-row">
                {stats.map(s => (
                    <div key={s.label} className="stat-card">
                        <div className="stat-label">{s.label}</div>
                        <div className="stat-value">{s.value}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{s.desc}</div>
                    </div>
                ))}
            </div>

            <hr className="divider" />

            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text)' }}>
                Get started
            </h2>
            <div className="nav-cards">
                {cards.map(c => (
                    <Link key={c.href} href={c.href} className="nav-card">
                        <div className="nav-card-icon">{c.icon}</div>
                        <div className="nav-card-title">{c.title}</div>
                        <div className="nav-card-desc">{c.desc}</div>
                        <div className="nav-card-cta">{c.cta}</div>
                    </Link>
                ))}
            </div>

            <p className="disclaimer">
                ⚠️ IngredIQ is not a medical device. Always consult your doctor or dietitian before making
                health decisions based on this information.
            </p>
        </>
    )
}

// ── Root page — decides which to render ─────────────────────────────────────

export default function RootPage() {
    const [hasProfile, setHasProfile] = useState<boolean | null>(null)

    useEffect(() => {
        const userId = getUserId()
        fetch(`/api/profile?userId=${userId}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(d => setHasProfile(!!(d && d.name)))
            .catch(() => setHasProfile(true)) // on error, show normal home (fail safe)
    }, [])

    if (hasProfile === null) {
        return <div className="spinner-wrap"><div className="spinner" /> Loading…</div>
    }

    return hasProfile ? <HomePage /> : <OnboardingWizard />
}

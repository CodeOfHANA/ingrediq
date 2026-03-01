'use client'
import { useState, useEffect } from 'react'
import { Profile, LabValues } from '@/lib/types'
import { PRESET_PROFILES, MEDICAL_PRESETS } from '@/lib/presets'
import { PresetGrid } from '@/components/PresetGrid'

const EMPTY_PROFILE: Omit<Profile, 'user_id'> = {
    name: '',
    presets: [],
    medical_conditions: [],
    allergies: [],
    medications: [],
    lab_values: {},
    preferences: [],
}

const USER_ID_KEY = 'ingrediq_user_id'

function getUserId(): string {
    if (typeof window === 'undefined') return ''
    let id = localStorage.getItem(USER_ID_KEY)
    if (!id) {
        id = crypto.randomUUID()
        localStorage.setItem(USER_ID_KEY, id)
    }
    return id
}

function TagInput({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
    const [val, setVal] = useState('')
    const add = () => {
        const t = val.trim()
        if (t && !items.includes(t)) onChange([...items, t])
        setVal('')
    }
    return (
        <>
            <div className="input-row">
                <input className="input" value={val} onChange={e => setVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
                    placeholder={placeholder} />
                <button type="button" className="btn" onClick={add}>Add</button>
            </div>
            <div className="tags">
                {items.map(item => (
                    <span key={item} className="tag">
                        {item}
                        <button onClick={() => onChange(items.filter(i => i !== item))}>✕</button>
                    </span>
                ))}
            </div>
        </>
    )
}

export default function ProfilePage() {
    const [form, setForm] = useState<Omit<Profile, 'user_id'>>(EMPTY_PROFILE)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const userId = getUserId()
        fetch(`/api/profile?userId=${userId}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                if (data && data.name) {
                    const { user_id: _, created_at: __, updated_at: ___, ...rest } = data
                    setForm(rest)
                }
            })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [])

    const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
        setForm(f => ({ ...f, [key]: val }))

    const setLab = (key: keyof LabValues, val: string) => {
        const n = parseFloat(val)
        setForm(f => ({ ...f, lab_values: { ...f.lab_values, [key]: isNaN(n) ? null : n } }))
    }

    const save = async () => {
        const userId = getUserId()
        if (!form.name.trim()) { setMsg({ type: 'err', text: 'Please enter your name.' }); return }
        setSaving(true); setMsg(null)
        try {
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, ...form }),
            })
            const data = await res.json()
            if (data.ok) setMsg({ type: 'ok', text: 'Profile saved ✓' })
            else throw new Error(data.error)
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error'
            setMsg({ type: 'err', text: `Save failed: ${errorMessage}` })
        } finally { setSaving(false) }
    }

    const toggleMedical = (key: string) => {
        set('medical_conditions',
            form.medical_conditions.includes(key)
                ? form.medical_conditions.filter(m => m !== key)
                : [...form.medical_conditions, key]
        )
    }

    if (loading) return <div className="spinner-wrap"><div className="spinner" /> Loading profile…</div>

    return (
        <>
            <div className="page-header">
                <h1>👤 Your Profile</h1>
                <p>Your profile is used to personalise every ingredient assessment.</p>
            </div>

            {msg && <div className={`alert ${msg.type === 'ok' ? 'alert-info' : 'alert-error'}`}>{msg.text}</div>}

            {/* Name */}
            <div className="form-section">
                <label className="form-label">Name</label>
                <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your name" />
            </div>

            <hr className="divider" />

            {/* Dietary presets */}
            <div className="form-section">
                <label className="form-label">Dietary & Religious Restrictions</label>
                <p className="form-hint">Select all that apply — multiple can be active simultaneously.</p>
                <PresetGrid selected={form.presets} onChange={v => set('presets', v)} />
            </div>

            <hr className="divider" />

            {/* Medical conditions */}
            <div className="form-section">
                <label className="form-label">Medical Conditions</label>
                <div className="preset-grid">
                    {Object.entries(MEDICAL_PRESETS).map(([key, mc]) => {
                        const active = form.medical_conditions.includes(key)
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

            <hr className="divider" />

            {/* Allergies */}
            <div className="form-section">
                <label className="form-label">Allergies & Intolerances</label>
                <TagInput items={form.allergies} onChange={v => set('allergies', v)} placeholder="e.g. peanuts, sesame (press Enter)" />
            </div>

            {/* Medications */}
            <div className="form-section">
                <label className="form-label">Medications</label>
                <p className="form-hint">The AI checks for ingredient–drug interactions.</p>
                <TagInput items={form.medications} onChange={v => set('medications', v)} placeholder="e.g. Metformin, Lisinopril (press Enter)" />
            </div>

            <hr className="divider" />

            {/* Lab values */}
            <div className="form-section">
                <label className="form-label">Lab Values (Optional)</label>
                <p className="form-hint">Provide recent results to enable context-aware analysis.</p>
                <div className="lab-grid" style={{ marginTop: '0.75rem' }}>
                    {([
                        ['blood_sugar_mmol', 'Blood Sugar (mmol/L)', '5.5'],
                        ['cholesterol_mmol', 'Cholesterol (mmol/L)', '5.2'],
                        ['sodium_mmol', 'Sodium (mmol/L)', '140'],
                        ['creatinine_umol', 'Creatinine (µmol/L)', '80'],
                        ['potassium_mmol', 'Potassium (mmol/L)', '4.0'],
                    ] as [keyof LabValues, string, string][]).map(([key, label, ph]) => (
                        <div key={key}>
                            <label className="form-label" style={{ fontWeight: 500 }}>{label}</label>
                            <input
                                className="input"
                                type="number"
                                step="0.1"
                                placeholder={ph}
                                value={form.lab_values?.[key] ?? ''}
                                onChange={e => setLab(key, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <hr className="divider" />

            <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : '💾  Save Profile'}
            </button>

            <p className="disclaimer">
                ⚠️ This is not medical advice. Profile data is stored securely and used only for ingredient analysis.
            </p>
        </>
    )
}

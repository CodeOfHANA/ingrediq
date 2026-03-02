'use client'
import { useState, useEffect, useRef } from 'react'
import { Profile, ScanResult, Confidence } from '@/lib/types'
import { VerdictCard } from '@/components/VerdictCard'
import { FlagList } from '@/components/FlagList'

const USER_ID_KEY = 'ingrediq_user_id'
function getUserId() {
    if (typeof window === 'undefined') return ''
    let id = localStorage.getItem(USER_ID_KEY)
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(USER_ID_KEY, id) }
    return id
}

type Tab = 'manual' | 'barcode' | 'ocr'
type ChatMessage = { role: 'user' | 'assistant'; content: string }

const MAX_CHAT_TURNS = 8

export default function ScanPage() {
    const [tab, setTab] = useState<Tab>('manual')
    const [text, setText] = useState('')
    const [barcodeInput, setBarcodeInput] = useState('')
    const [productName, setProductName] = useState('')
    const [profile, setProfile] = useState<Profile | null>(null)
    const [result, setResult] = useState<ScanResult | null>(null)
    const [confidence, setConfidence] = useState<Confidence>('LOW')
    const [loading, setLoading] = useState(false)
    const [fetchingBarcode, setFetchingBarcode] = useState(false)
    const [decodingBarcode, setDecodingBarcode] = useState(false)
    const [ocrLoading, setOcrLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [barcodePreview, setBarcodePreview] = useState<string | null>(null)
    const [barcodeNotFound, setBarcodeNotFound] = useState(false)

    // Chat state
    const [chatOpen, setChatOpen] = useState(false)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)

    // Separate file inputs: camera + gallery for each tab
    const ocrFileRef = useRef<HTMLInputElement>(null)
    const ocrCameraRef = useRef<HTMLInputElement>(null)
    const barcodeFileRef = useRef<HTMLInputElement>(null)
    const barcodeCameraRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const userId = getUserId()
        fetch(`/api/profile?userId=${userId}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(d => { if (d && d.name) setProfile(d) })
            .catch(() => { })
    }, [])

    useEffect(() => {
        if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages, chatOpen])

    /* ── Barcode: decode from uploaded photo ── */
    const handleBarcodePhoto = async (file: File) => {
        setDecodingBarcode(true)
        setError(null)
        setBarcodeNotFound(false)
        setBarcodeInput('')
        setText('')
        setProductName('')
        setBarcodePreview(URL.createObjectURL(file))
        try {
            const formData = new FormData()
            formData.append('image', file)
            const res = await fetch('/api/barcode/decode', { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok || !data.code) {
                setError(data.error ?? 'Barcode not detected. Try a clearer, well-lit photo or enter the number manually.')
                return
            }
            setBarcodeInput(data.code)
            await lookupBarcodeCode(data.code)
        } catch {
            setError('Could not reach the server. Check your connection and try again.')
        } finally {
            setDecodingBarcode(false)
        }
    }

    /* ── Barcode: lookup a code against Open Food Facts ── */
    const lookupBarcodeCode = async (code: string) => {
        if (!code.trim()) return
        setFetchingBarcode(true)
        setError(null)
        setBarcodeNotFound(false)
        try {
            const res = await fetch(`/api/barcode/lookup?code=${encodeURIComponent(code.trim())}`)
            const data = await res.json()
            if (!res.ok) {
                if (res.status === 404) {
                    setBarcodeNotFound(true)
                } else {
                    setError(data.error ?? 'Lookup failed. Try entering the barcode manually.')
                }
                return
            }
            setProductName(data.productName ?? '')
            setText(data.ingredientsText ?? '')
            setConfidence('HIGH')
        } catch {
            setError('Could not reach Open Food Facts. Check your connection.')
        } finally {
            setFetchingBarcode(false)
        }
    }

    const lookupBarcode = () => lookupBarcodeCode(barcodeInput)

    /* ── OCR: extract text from ingredient label photo (server-side) ── */
    const handleOcr = async (file: File) => {
        setOcrLoading(true)
        setError(null)
        setText('')
        try {
            // Convert HEIC/HEIF to JPEG client-side before upload
            // (Vercel's sharp binary lacks libheif, so HEIC must be pre-converted)
            let uploadFile: File = file
            const isHeic = file.type === 'image/heic' || file.type === 'image/heif'
                || file.name.toLowerCase().endsWith('.heic')
                || file.name.toLowerCase().endsWith('.heif')
            if (isHeic) {
                const heic2any = (await import('heic2any')).default
                const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
                const blob = Array.isArray(converted) ? converted[0] : converted
                uploadFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), { type: 'image/jpeg' })
            }

            const formData = new FormData()
            formData.append('image', uploadFile)
            const res = await fetch('/api/ocr', { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'OCR failed. Please try Manual Input.')
                return
            }
            setText(data.text)
            setConfidence('MEDIUM')
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            setError(`OCR failed: ${msg}. Please try Manual Input.`)
        } finally {
            setOcrLoading(false)
        }
    }

    /* ── Analysis ── */
    const analyze = async () => {
        if (!text.trim()) { setError('Please enter or extract ingredients first.'); return }
        if (!profile) { setError('Set up your profile before scanning.'); return }
        // If manual tab and no confidence set yet, keep LOW
        if (tab === 'manual') setConfidence('LOW')
        setLoading(true); setError(null); setResult(null)
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ingredientsText: text, profile }),
            })
            const data: ScanResult = await res.json()
            if (!res.ok) throw new Error((data as unknown as { error: string }).error)
            setResult(data)
            setChatMessages([])
            setChatOpen(false)

            const userId = getUserId()
            const finalConfidence: Confidence = tab === 'barcode' ? 'HIGH' : tab === 'ocr' ? 'MEDIUM' : 'LOW'
            await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    scan: {
                        ...data,
                        product_name: productName || null,
                        ingredients_text: text,
                        source: tab,
                        confidence: finalConfidence,
                        scanned_at: new Date().toISOString(),
                    },
                }),
            })
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            setError(msg)
        } finally { setLoading(false) }
    }

    /* ── Chat follow-up ── */
    const sendChat = async () => {
        if (!chatInput.trim() || chatLoading) return
        if (chatMessages.length >= MAX_CHAT_TURNS * 2) return

        const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() }
        const next = [...chatMessages, userMsg]
        setChatMessages(next)
        setChatInput('')
        setChatLoading(true)

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: next, ingredientsText: text, profile }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? 'Chat failed')
            setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
        } catch {
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I could not reach the server. Please try again.' }])
        } finally {
            setChatLoading(false)
        }
    }

    const reset = () => {
        setText(''); setResult(null); setError(null)
        setProductName(''); setBarcodeInput(''); setBarcodePreview(null)
        setBarcodeNotFound(false); setConfidence('LOW')
        setChatMessages([]); setChatOpen(false); setChatInput('')
        if (ocrFileRef.current) ocrFileRef.current.value = ''
        if (ocrCameraRef.current) ocrCameraRef.current.value = ''
        if (barcodeFileRef.current) barcodeFileRef.current.value = ''
        if (barcodeCameraRef.current) barcodeCameraRef.current.value = ''
    }

    /* ── Profile guard ── */
    if (!profile) {
        return (
            <>
                <div className="page-header">
                    <h1>🔬 Scan Product</h1>
                    <p>Upload a barcode image, photograph the label, or paste ingredients manually.</p>
                </div>
                <div className="alert alert-warn">
                    ⚠️ Please <a href="/profile" style={{ color: 'inherit', fontWeight: 700 }}>set up your profile</a> first so we can personalise the analysis.
                </div>
            </>
        )
    }

    /* ── Results view ── */
    if (result) {
        const displayConfidence: Confidence = tab === 'barcode' ? 'HIGH' : tab === 'ocr' ? 'MEDIUM' : 'LOW'
        return (
            <>
                <div className="page-header">
                    <h1>🔬 Scan Result</h1>
                    <p>Analysed as: <strong>{profile.name}</strong></p>
                </div>
                {productName && <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>📦 {productName}</div>}
                <VerdictCard result={result} confidence={displayConfidence} productName={productName} />
                <FlagList flags={result.flags} />

                {/* AI Chat follow-up */}
                <div className="chat-section">
                    <div className="chat-section-header" onClick={() => setChatOpen(o => !o)}>
                        <span>💬 Ask a follow-up question</span>
                        <span>{chatOpen ? '▲' : '▼'}</span>
                    </div>

                    {chatOpen && (
                        <>
                            <div className="chat-thread">
                                {chatMessages.length === 0 && (
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0.25rem 0' }}>
                                        Ask anything about this ingredient list or verdict.
                                    </div>
                                )}
                                {chatMessages.map((m, i) => (
                                    <div key={i} className={m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}>
                                        {m.content}
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div className="chat-bubble-assistant" style={{ opacity: 0.6 }}>
                                        <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, display: 'inline-block', marginRight: 6 }} />
                                        Thinking…
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {chatMessages.length < MAX_CHAT_TURNS * 2 ? (
                                <div className="chat-input-row">
                                    <input
                                        className="input"
                                        value={chatInput}
                                        onChange={e => setChatInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && sendChat()}
                                        placeholder="e.g. Why is sodium benzoate flagged?"
                                        disabled={chatLoading}
                                    />
                                    <button className="btn btn-primary btn-sm" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                                        Send
                                    </button>
                                </div>
                            ) : (
                                <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                                    Max 8 turns reached. Scan another product to start a new session.
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                    <button className="btn" onClick={reset}>← Scan Another</button>
                </div>
                <p className="disclaimer">⚠️ This is not medical advice. Always consult your healthcare provider.</p>
            </>
        )
    }

    /* ── Scan input view ── */
    return (
        <>
            <div className="page-header">
                <h1>🔬 Scan Product</h1>
                <p>Analysing as: <strong>{profile.name}</strong> · {profile.presets.length} preset{profile.presets.length !== 1 ? 's' : ''} active</p>
            </div>

            {/* Tabs */}
            <div className="tabs">
                {(['manual', 'barcode', 'ocr'] as Tab[]).map(t => (
                    <button
                        key={t}
                        className={`tab-btn${tab === t ? ' tab-btn--active' : ''}`}
                        onClick={() => { setTab(t); setError(null) }}
                    >
                        {{ manual: '✏️ Manual', barcode: '🏷️ Barcode', ocr: '📸 Photo OCR' }[t]}
                    </button>
                ))}
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* ── Manual tab ── */}
            {tab === 'manual' && (
                <>
                    <div className="form-section">
                        <label className="form-label">Product Name (optional)</label>
                        <input className="input" value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Nutella 400g" />
                    </div>
                    <div className="form-section">
                        <label className="form-label">Ingredients List</label>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                            Paste the full ingredients list from the product packaging.
                        </p>
                        <textarea
                            className="textarea"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder="e.g. Water, sugar, pork gelatin, sodium benzoate, wheat flour…"
                        />
                    </div>
                </>
            )}

            {/* ── Barcode tab ── */}
            {tab === 'barcode' && (
                <div className="form-section">
                    <label className="form-label">Upload Barcode Photo</label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                        Take a photo of the barcode or choose one from your gallery.
                    </p>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <label
                            htmlFor="barcode-camera-input"
                            className="btn"
                            style={{ cursor: 'pointer' }}
                        >
                            {decodingBarcode ? '🔍 Reading…' : '📷 Take Photo'}
                        </label>
                        <input
                            id="barcode-camera-input"
                            ref={barcodeCameraRef}
                            type="file"
                            accept="image/*, .heic, .heif"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={e => e.target.files?.[0] && handleBarcodePhoto(e.target.files[0])}
                            disabled={decodingBarcode || fetchingBarcode}
                        />
                        <label
                            htmlFor="barcode-file-input"
                            className="btn"
                            style={{ cursor: 'pointer' }}
                        >
                            {decodingBarcode ? '🔍 Reading…' : '📁 Choose from Gallery'}
                        </label>
                        <input
                            id="barcode-file-input"
                            ref={barcodeFileRef}
                            type="file"
                            accept="image/*, .heic, .heif"
                            style={{ display: 'none' }}
                            onChange={e => e.target.files?.[0] && handleBarcodePhoto(e.target.files[0])}
                            disabled={decodingBarcode || fetchingBarcode}
                        />
                        {barcodePreview && (
                            <img src={barcodePreview} alt="Barcode preview" style={{ height: 44, borderRadius: 6, border: '1px solid var(--border)' }} />
                        )}
                    </div>

                    {/* Auto-OCR fallback banner */}
                    {barcodeNotFound && (
                        <div className="alert alert-warn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                            <span>📭 Product not in Open Food Facts database — photograph the ingredient list instead.</span>
                            <button
                                className="btn btn-sm"
                                onClick={() => { setBarcodeNotFound(false); setError(null); setTab('ocr') }}
                                style={{ whiteSpace: 'nowrap' }}
                            >
                                📸 Use Photo OCR →
                            </button>
                        </div>
                    )}

                    {/* Manual barcode number fallback */}
                    <label className="form-label">Or Enter Barcode Number Manually</label>
                    <div className="input-row" style={{ marginBottom: '0.75rem' }}>
                        <input
                            className="input"
                            value={barcodeInput}
                            onChange={e => setBarcodeInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && lookupBarcode()}
                            placeholder="e.g. 5449000131805"
                            disabled={fetchingBarcode || decodingBarcode}
                        />
                        <button className="btn btn-primary" onClick={lookupBarcode} disabled={fetchingBarcode || decodingBarcode || !barcodeInput.trim()}>
                            {fetchingBarcode ? 'Looking up…' : 'Look Up'}
                        </button>
                    </div>

                    {(fetchingBarcode || decodingBarcode) && (
                        <div className="spinner-wrap">
                            <div className="spinner" />
                            {decodingBarcode ? 'Decoding barcode from image…' : 'Fetching from Open Food Facts…'}
                        </div>
                    )}

                    {text && !fetchingBarcode && (
                        <div style={{ marginTop: '0.5rem' }}>
                            {productName && <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>📦 {productName}</div>}
                            <label className="form-label">Ingredients (editable)</label>
                            <textarea className="textarea" value={text} onChange={e => setText(e.target.value)} style={{ minHeight: 120 }} />
                        </div>
                    )}
                </div>
            )}

            {/* ── Photo OCR tab ── */}
            {tab === 'ocr' && (
                <div className="form-section">
                    <label className="form-label">Upload Ingredient Label Photo</label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                        Take or upload a clear photo of the ingredient list on the product&apos;s packaging.
                    </p>

                    {ocrLoading ? (
                        <div className="spinner-wrap">
                            <div className="spinner" />
                            Extracting text from image… this may take 10–30 seconds.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            <label
                                htmlFor="ocr-camera-input"
                                className="btn"
                                style={{ cursor: 'pointer' }}
                            >
                                📷 Take Photo
                            </label>
                            <input
                                id="ocr-camera-input"
                                ref={ocrCameraRef}
                                type="file"
                                accept="image/*, .heic, .heif"
                                capture="environment"
                                style={{ display: 'none' }}
                                onChange={e => {
                                    if (e.target.files?.[0]) {
                                        setText('')
                                        handleOcr(e.target.files[0])
                                    }
                                }}
                            />
                            <label
                                htmlFor="ocr-file-input"
                                className="btn"
                                style={{ cursor: 'pointer' }}
                            >
                                📁 Choose from Gallery
                            </label>
                            <input
                                id="ocr-file-input"
                                ref={ocrFileRef}
                                type="file"
                                accept="image/*, .heic, .heif"
                                style={{ display: 'none' }}
                                onChange={e => {
                                    if (e.target.files?.[0]) {
                                        setText('')
                                        handleOcr(e.target.files[0])
                                    }
                                }}
                            />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>JPG, PNG, WEBP, HEIC accepted</span>
                        </div>
                    )}

                    {text && !ocrLoading && (
                        <div>
                            <label className="form-label">Extracted Text — review and edit before analysing</label>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 6px' }}>
                                OCR isn&apos;t perfect — check for errors then click Analyse.
                            </p>
                            <textarea className="textarea" value={text} onChange={e => setText(e.target.value)} style={{ minHeight: 160 }} />
                        </div>
                    )}
                </div>
            )}

            {/* ── Analyse button ── */}
            {text.trim() && (
                <button
                    className="btn btn-primary btn-full"
                    onClick={analyze}
                    disabled={loading}
                    style={{ marginTop: '0.5rem' }}
                >
                    {loading ? (
                        <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Analysing…</>
                    ) : '🔬 Analyse Ingredients'}
                </button>
            )}
        </>
    )
}

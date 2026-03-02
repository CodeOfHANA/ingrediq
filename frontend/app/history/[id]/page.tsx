'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ScanRecord, Profile, Confidence } from '@/lib/types'
import { VerdictCard } from '@/components/VerdictCard'
import { FlagList } from '@/components/FlagList'

const USER_ID_KEY = 'ingrediq_user_id'
function getUserId() {
    if (typeof window === 'undefined') return ''
    let id = localStorage.getItem(USER_ID_KEY)
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(USER_ID_KEY, id) }
    return id
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }
const MAX_CHAT_TURNS = 8

export default function HistoryDetailPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string

    const [record, setRecord] = useState<ScanRecord | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    // Chat state
    const [chatOpen, setChatOpen] = useState(false)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const userId = getUserId()
        Promise.all([
            fetch(`/api/history?userId=${userId}&id=${id}`, { cache: 'no-store' }).then(r => {
                if (r.status === 404) { setNotFound(true); return null }
                return r.json()
            }),
            fetch(`/api/profile?userId=${userId}`, { cache: 'no-store' }).then(r => r.json()),
        ])
            .then(([rec, prof]) => {
                if (rec) setRecord(rec)
                if (prof && prof.name) setProfile(prof)
            })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [id])

    useEffect(() => {
        if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages, chatOpen])

    const sendChat = async () => {
        if (!chatInput.trim() || chatLoading || !record || !profile) return
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
                body: JSON.stringify({ messages: next, ingredientsText: record.ingredients_text, profile }),
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

    if (loading) {
        return <div className="spinner-wrap"><div className="spinner" /> Loading scan…</div>
    }

    if (notFound || !record) {
        return (
            <>
                <div className="page-header"><h1>Scan Not Found</h1></div>
                <div className="alert alert-error">This scan record could not be found.</div>
                <button className="btn" onClick={() => router.push('/history')}>← Back to History</button>
            </>
        )
    }

    const date = new Date(record.scanned_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    const sourceLabel: Record<string, string> = { barcode: '🏷️ Barcode', ocr: '📸 Photo OCR', manual: '✏️ Manual' }

    // Build a ScanResult-shaped object for VerdictCard (omit ScanRecord-only fields)
    const scanResult = {
        verdict: record.verdict,
        flags: record.flags,
        summary: record.summary,
        alternative_suggestion: record.alternative_suggestion,
        confidence: record.confidence,
    }

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button className="btn btn-sm" onClick={() => router.push('/history')}>← Back to History</button>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {sourceLabel[record.source] ?? record.source} · {date}
                </div>
            </div>

            <div className="page-header" style={{ marginBottom: '0.75rem' }}>
                <h1>📋 Scan Detail</h1>
                {record.product_name && <p>📦 {record.product_name}</p>}
            </div>

            <VerdictCard result={scanResult} confidence={record.confidence as Confidence} productName={record.product_name ?? ''} />
            <FlagList flags={record.flags} />

            {/* AI Chat follow-up */}
            <div className="chat-section">
                <div className="chat-section-header" onClick={() => setChatOpen(o => !o)}>
                    <span>💬 Ask a follow-up question</span>
                    <span>{chatOpen ? '▲' : '▼'}</span>
                </div>

                {chatOpen && (
                    <>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.5rem 1rem 0', borderTop: '1px solid var(--border)' }}>
                            ℹ️ Chatting about this historical scan with your current profile.
                        </div>
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
                                    disabled={chatLoading || !profile}
                                />
                                <button className="btn btn-primary btn-sm" onClick={sendChat} disabled={chatLoading || !chatInput.trim() || !profile}>
                                    Send
                                </button>
                            </div>
                        ) : (
                            <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                                Max 8 turns reached.
                            </div>
                        )}
                    </>
                )}
            </div>

            <p className="disclaimer">⚠️ This is not medical advice. Scan results are based on your stated profile.</p>
        </>
    )
}

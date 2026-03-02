'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ScanRecord, Verdict } from '@/lib/types'

const USER_ID_KEY = 'ingrediq_user_id'
function getUserId() {
    if (typeof window === 'undefined') return ''
    let id = localStorage.getItem(USER_ID_KEY)
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(USER_ID_KEY, id) }
    return id
}

const VERDICT_STYLE: Record<Verdict, { color: string; emoji: string }> = {
    SAFE: { color: '#059669', emoji: '🟢' },
    CAUTION: { color: '#d97706', emoji: '🟡' },
    AVOID: { color: '#dc2626', emoji: '🔴' },
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="stat-card" style={{ textAlign: 'center' }}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
        </div>
    )
}

export default function HistoryPage() {
    const [records, setRecords] = useState<ScanRecord[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const userId = getUserId()
        fetch(`/api/history?userId=${userId}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(setRecords)
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [])

    const safe = records.filter(r => r.verdict === 'SAFE').length
    const caution = records.filter(r => r.verdict === 'CAUTION').length
    const avoid = records.filter(r => r.verdict === 'AVOID').length

    return (
        <>
            <div className="page-header">
                <h1>📋 Scan History</h1>
                <p>Your last 50 ingredient analyses.</p>
            </div>

            {!loading && records.length > 0 && (
                <div className="stat-row">
                    <StatPill label="Total" value={records.length} color="var(--text)" />
                    <StatPill label="Safe" value={safe} color="var(--safe)" />
                    <StatPill label="Caution" value={caution} color="var(--caution)" />
                    <StatPill label="Avoid" value={avoid} color="var(--avoid)" />
                </div>
            )}

            {loading && <div className="spinner-wrap"><div className="spinner" /> Loading history…</div>}

            {!loading && records.length === 0 && (
                <div className="alert alert-info">
                    No scans yet. <a href="/scan" style={{ color: 'inherit', fontWeight: 600 }}>Scan your first product →</a>
                </div>
            )}

            {!loading && records.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0 1.25rem' }}>
                    {records.map((rec, i) => {
                        const meta = VERDICT_STYLE[rec.verdict] ?? VERDICT_STYLE.CAUTION
                        const date = new Date(rec.scanned_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })
                        const row = (
                            <div className="history-row">
                                <div>
                                    <div className="history-product">
                                        {meta.emoji}  {rec.product_name || rec.ingredients_text.slice(0, 50) + '…'}
                                    </div>
                                    <div className="history-date">{date}</div>
                                </div>
                                <div className="history-source">{rec.source}</div>
                                <div className="history-verdict" style={{ color: meta.color }}>
                                    {rec.verdict}
                                    {rec.flags?.length > 0 && (
                                        <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                            {rec.flags.length} issue{rec.flags.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                        return rec.id ? (
                            <Link key={rec.id} href={`/history/${rec.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                                {row}
                            </Link>
                        ) : (
                            <div key={i}>{row}</div>
                        )
                    })}
                </div>
            )}

            <p className="disclaimer">⚠️ This is not medical advice. Scan results are based on your stated profile.</p>
        </>
    )
}

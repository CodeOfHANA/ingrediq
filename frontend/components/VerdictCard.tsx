'use client'
import { useState } from 'react'
import { ScanResult, Confidence } from '@/lib/types'

const VERDICT_META = {
    SAFE: { color: '#059669', bg: '#05966912', label: 'Safe to consume', emoji: '🟢' },
    CAUTION: { color: '#d97706', bg: '#d9770612', label: 'Consume with caution', emoji: '🟡' },
    AVOID: { color: '#dc2626', bg: '#dc262612', label: 'Avoid this product', emoji: '🔴' },
} as const

const CONFIDENCE_META: Record<Confidence, { label: string; dot: string }> = {
    HIGH:   { label: 'HIGH confidence — barcode match',   dot: '#059669' },
    MEDIUM: { label: 'MEDIUM confidence — OCR scan',      dot: '#d97706' },
    LOW:    { label: 'LOW confidence — manual entry',     dot: '#9ca3af' },
}

interface VerdictCardProps {
    result: ScanResult
    confidence?: Confidence
    productName?: string
}

export function VerdictCard({ result, confidence, productName }: VerdictCardProps) {
    const meta = VERDICT_META[result.verdict] ?? VERDICT_META.CAUTION
    const confMeta = confidence ? CONFIDENCE_META[confidence] : null
    const [toast, setToast] = useState(false)

    const handleShare = async () => {
        const topFlag = result.flags?.[0]
        const text = [
            productName ? `📦 ${productName}` : null,
            `${meta.emoji} ${result.verdict} — ${meta.label}`,
            topFlag ? `⚠️ ${topFlag.ingredient}: ${topFlag.reason}` : null,
            result.summary,
            '\nChecked with IngredIQ 🌿',
        ].filter(Boolean).join('\n')

        if (navigator.share) {
            try {
                await navigator.share({ title: 'IngredIQ Result', text })
            } catch {
                /* user cancelled */
            }
        } else {
            await navigator.clipboard.writeText(text)
            setToast(true)
            setTimeout(() => setToast(false), 2000)
        }
    }

    return (
        <>
            <div
                className="verdict-card"
                style={{ background: meta.bg, borderColor: `${meta.color}60` }}
            >
                <div className="verdict-emoji">{meta.emoji}</div>
                <div className="verdict-label" style={{ color: meta.color }}>{result.verdict}</div>
                <div className="verdict-sublabel" style={{ color: `${meta.color}99` }}>
                    {meta.label}
                </div>

                {confMeta && (
                    <div className="confidence-badge" style={{ color: confMeta.dot }}>
                        <span style={{ fontSize: '0.5rem' }}>●</span>
                        {confMeta.label}
                    </div>
                )}

                <p className="verdict-summary">{result.summary}</p>

                {result.alternative_suggestion && (
                    <div className="verdict-suggestion">
                        💡 <strong>Try instead:</strong> {result.alternative_suggestion}
                    </div>
                )}

                <button className="share-btn" onClick={handleShare}>
                    📤 Share result
                </button>
            </div>

            {toast && <div className="share-toast">✓ Copied to clipboard</div>}
        </>
    )
}

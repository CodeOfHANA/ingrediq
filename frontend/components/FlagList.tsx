'use client'
import { useState } from 'react'
import { Flag } from '@/lib/types'

const SEV_META = {
    HIGH: { icon: '🔴', color: '#dc2626', bg: '#dc262618' },
    MEDIUM: { icon: '🟡', color: '#d97706', bg: '#d9770618' },
    LOW: { icon: '🔵', color: '#2563eb', bg: '#2563eb18' },
} as const

const SEV_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const

interface FlagListProps {
    flags: Flag[]
}

export function FlagList({ flags }: FlagListProps) {
    const [open, setOpen] = useState<number | null>(null)

    if (!flags || flags.length === 0) {
        return (
            <div className="flag-empty">
                <span>✓</span> No conflicts found with your profile.
            </div>
        )
    }

    const sorted = [...flags].sort(
        (a, b) => (SEV_ORDER[a.severity] ?? 3) - (SEV_ORDER[b.severity] ?? 3)
    )

    return (
        <div className="flag-list">
            <div className="flag-list-header">{flags.length} Issue{flags.length !== 1 ? 's' : ''} Found</div>
            {sorted.map((flag, i) => {
                const meta = SEV_META[flag.severity] ?? SEV_META.LOW
                const isOpen = open === i
                return (
                    <div key={i} className="flag-item">
                        <button
                            className="flag-toggle"
                            onClick={() => setOpen(isOpen ? null : i)}
                            aria-expanded={isOpen}
                        >
                            <span>{meta.icon}  {flag.ingredient}</span>
                            <span className="flag-pill" style={{ background: meta.bg, color: meta.color }}>
                                {flag.severity}
                            </span>
                        </button>
                        {isOpen && (
                            <div className="flag-body">
                                <div><strong>Reason:</strong> {flag.reason}</div>
                                <div><strong>Conflicts with:</strong> {flag.conflicts_with}</div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

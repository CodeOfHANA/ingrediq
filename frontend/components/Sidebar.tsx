'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Profile } from '@/lib/types'
import { PRESET_PROFILES, MEDICAL_PRESETS } from '@/lib/presets'

const USER_ID_KEY = 'ingrediq_user_id'
function getUserId() {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(USER_ID_KEY) ?? ''
}

const NAV = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/profile', label: 'Profile', icon: '👤' },
    { href: '/scan', label: 'Scan', icon: '🔍' },
    { href: '/history', label: 'History', icon: '📋' },
]

export function Sidebar() {
    const pathname = usePathname()
    const [profile, setProfile] = useState<Profile | null>(null)

    // Re-fetch on every navigation so the sidebar reflects saves immediately
    useEffect(() => {
        const userId = getUserId()
        if (!userId) return
        fetch(`/api/profile?userId=${userId}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(d => { if (d?.name) setProfile(d) })
            .catch(() => { })
    }, [pathname])

    const activePresets = profile?.presets ?? []
    const activeMedical = profile?.medical_conditions ?? []
    const presetBadges = activePresets.map(p => PRESET_PROFILES[p]?.emoji).filter(Boolean).join('  ')
    const medBadges = activeMedical.map(m => MEDICAL_PRESETS[m]?.emoji).filter(Boolean).join('  ')

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <span className="sidebar-logo-icon">🌿</span>
                <span className="sidebar-logo-text">IngredIQ</span>
            </div>

            <hr className="sidebar-divider" />

            <div className="sidebar-profile">
                {profile?.name ? (
                    <>
                        <div className="sidebar-profile-name">👤  {profile.name}</div>
                        {presetBadges && <div className="sidebar-badge">Active:  {presetBadges}</div>}
                        {medBadges && <div className="sidebar-badge">Medical: {medBadges}</div>}
                    </>
                ) : (
                    <div className="sidebar-badge">No profile set</div>
                )}
            </div>

            <hr className="sidebar-divider" />

            <nav className="sidebar-nav">
                {NAV.map(({ href, label, icon }) => {
                    const active = pathname === href
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`sidebar-link${active ? ' sidebar-link--active' : ''}`}
                        >
                            <span>{icon}</span>
                            <span>{label}</span>
                        </Link>
                    )
                })}
            </nav>
        </aside>
    )
}

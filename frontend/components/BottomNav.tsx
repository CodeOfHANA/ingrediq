'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/profile', label: 'Profile', icon: '👤' },
    { href: '/scan', label: 'Scan', icon: '🔍' },
    { href: '/history', label: 'History', icon: '📋' },
]

export function BottomNav() {
    const pathname = usePathname()
    return (
        <nav className="bottom-nav" aria-label="Mobile navigation">
            {NAV.map(({ href, label, icon }) => {
                const active = pathname === href
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`bottom-nav-link${active ? ' bottom-nav-link--active' : ''}`}
                    >
                        <span className="bottom-nav-icon">{icon}</span>
                        <span>{label}</span>
                    </Link>
                )
            })}
        </nav>
    )
}

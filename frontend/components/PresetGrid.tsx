'use client'
import { PRESET_PROFILES } from '@/lib/presets'

interface PresetGridProps {
    selected: string[]
    onChange: (presets: string[]) => void
}

export function PresetGrid({ selected, onChange }: PresetGridProps) {
    const toggle = (key: string) => {
        onChange(
            selected.includes(key)
                ? selected.filter(p => p !== key)
                : [...selected, key]
        )
    }

    return (
        <div className="preset-grid">
            {Object.entries(PRESET_PROFILES).map(([key, preset]) => {
                const active = selected.includes(key)
                return (
                    <button
                        key={key}
                        onClick={() => toggle(key)}
                        className={`preset-btn${active ? ' preset-btn--active' : ''}`}
                        style={active ? {
                            borderColor: preset.color,
                            background: `${preset.color}14`,
                            color: preset.color,
                        } : undefined}
                    >
                        <span className="preset-emoji">{preset.emoji}</span>
                        <span className="preset-label">{active ? '✓ ' : ''}{preset.label}</span>
                    </button>
                )
            })}
        </div>
    )
}

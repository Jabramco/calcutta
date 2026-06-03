'use client'

import { useMode, type AppMode } from './ModeContext'

const OPTIONS: { value: AppMode; label: string; icon: string }[] = [
  { value: 'worldcup', label: 'World Cup', icon: '⚽' },
  { value: 'marchmadness', label: 'March Madness', icon: '🏀' }
]

export default function ModeSegmentedControl() {
  const { mode, setMode } = useMode()

  return (
    <div
      role="tablist"
      aria-label="Select experience"
      className="inline-flex items-center gap-1 rounded-xl border border-[#2a2a38] bg-[#12121a]/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm"
    >
      {OPTIONS.map((opt) => {
        const active = mode === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setMode(opt.value)}
            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-lg leading-none transition-all ${
              active
                ? 'nav-tab-active font-semibold'
                : 'text-[#a0a0b8] hover:bg-[#1c1c28] hover:text-white'
            }`}
          >
            <span aria-hidden>{opt.icon}</span>
          </button>
        )
      })}
    </div>
  )
}

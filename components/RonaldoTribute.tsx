'use client'

import { useSyncExternalStore } from 'react'
import type { TournamentKey } from '@/lib/tournament'

/**
 * Dismissable Cristiano Ronaldo tribute hero card for the top of the World Cup dashboard,
 * marking his final World Cup. World-Cup-only (hidden in March Madness) and self-hides once
 * dismissed — the dismissal persists in localStorage under a stable key so it stays gone across
 * reloads/navigation (same localStorage convention as ModeContext).
 *
 * Hydration: dismissal state lives only in localStorage, so the dismissal is read via
 * useSyncExternalStore. The SERVER snapshot reports "dismissed" so the card is never in the SSR
 * markup — this prevents both a hydration mismatch and a flash of the card for users who already
 * dismissed it; the real localStorage value takes over right after hydration.
 *
 * No photo/likeness is used — the design is pure typography + CSS (Portugal red/green with gold
 * accents, a big "7", 🇵🇹) to stay tasteful and avoid embedding a real person's image.
 */
const DISMISS_KEY = 'calcutta_dismiss_ronaldo_tribute'
const DISMISS_EVENT = 'calcutta:ronaldo-tribute-dismissed'

function subscribeDismissed(onChange: () => void): () => void {
  window.addEventListener(DISMISS_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function RonaldoTribute({ tournament }: { tournament: TournamentKey }) {
  // Server snapshot = `true` (dismissed) so nothing renders during SSR / first paint; the client
  // snapshot then reflects the real localStorage value once hydrated. `storage` + a custom event
  // keep it in sync across tabs and the in-tab dismiss click.
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => true)

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore persistence failure; the event below still hides it for this session.
    }
    window.dispatchEvent(new Event(DISMISS_EVENT))
  }

  // World-Cup-only tribute; render nothing in March Madness or once dismissed.
  if (tournament !== 'worldcup' || dismissed) return null

  return (
    <section aria-label="Cristiano Ronaldo tribute" className="mb-6">
      <div className="relative overflow-hidden glass-card rounded-2xl border border-[#d4af37]/30 bg-gradient-to-r from-[#4a0d16] via-[#12121a] to-[#0b3b25] shadow-[0_10px_40px_rgba(200,16,46,0.15)]">
        {/* Gold glow accents */}
        <div className="pointer-events-none absolute -top-16 -left-10 h-48 w-48 rounded-full bg-[#c8102e]/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 -right-8 h-48 w-48 rounded-full bg-[#046a38]/25 blur-3xl" aria-hidden />

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss tribute"
          className="absolute top-2.5 right-2.5 z-10 h-8 w-8 flex items-center justify-center rounded-full text-[#e8d9a8] hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4af37]/60"
        >
          <span aria-hidden className="text-lg leading-none">×</span>
        </button>

        <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-5 sm:p-6">
          {/* Big "7" motif */}
          <div className="shrink-0 flex items-center justify-center h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border border-[#d4af37]/40 bg-gradient-to-br from-[#c8102e]/25 to-[#046a38]/25">
            <span className="text-5xl sm:text-6xl font-black bg-gradient-to-b from-[#ffe89a] to-[#d4af37] bg-clip-text text-transparent tabular-nums drop-shadow">
              7
            </span>
          </div>

          <div className="min-w-0 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[#e8c860]">
                One last dance
              </span>
              <span aria-hidden>🇵🇹</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              Obrigado, <span className="bg-gradient-to-r from-[#ffe89a] via-[#f5d76e] to-[#d4af37] bg-clip-text text-transparent">Cristiano Ronaldo</span>
              <span className="text-[#e8c860]"> · CR7</span>
            </h2>
            <p className="mt-2 text-sm text-[#d8d8e4] max-w-2xl">
              Portugal&apos;s captain takes the pitch for his <span className="text-white font-semibold">final World Cup</span>.
              Five Ballons d&apos;Or, football&apos;s all-time leading international goalscorer, and a career of the
              impossible made routine. However this one ends — the GOAT, one last time. ⚽🐐
            </p>
            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
              {['5× Ballon d\u2019Or', 'All-time intl top scorer', '5 World Cups', 'GOAT'].map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-[#f0e2b0] bg-[#d4af37]/12 border border-[#d4af37]/25"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

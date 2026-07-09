'use client'

import { useSyncExternalStore } from 'react'
import type { TournamentKey } from '@/lib/tournament'

/**
 * Dismissable Tim Ream tribute hero card for the top of the World Cup dashboard, celebrating a
 * veteran USMNT defender as the USA co-hosts this World Cup. World-Cup-only (hidden in March
 * Madness) and self-hides once dismissed — the dismissal persists in localStorage under a stable
 * key so it stays gone across reloads/navigation (same localStorage convention as ModeContext).
 *
 * Hydration: dismissal state lives only in localStorage, so the dismissal is read via
 * useSyncExternalStore. The SERVER snapshot reports "dismissed" so the card is never in the SSR
 * markup — this prevents both a hydration mismatch and a flash of the card for users who already
 * dismissed it; the real localStorage value takes over right after hydration.
 *
 * No photo/likeness is used — the design is pure typography + CSS (USA red/white/navy with a
 * stars-and-stripes motif, 🇺🇸) to stay tasteful and avoid embedding a real person's image.
 * Copy is intentionally evergreen (no fabricated stats, clubs, caps, or "final World Cup" claims).
 */
const DISMISS_KEY = 'calcutta_dismiss_ream_tribute'
const DISMISS_EVENT = 'calcutta:ream-tribute-dismissed'

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

export function ReamTribute({ tournament }: { tournament: TournamentKey }) {
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
    <section aria-label="Tim Ream tribute" className="mb-6">
      <div className="relative overflow-hidden glass-card rounded-2xl border border-[#3a5fb0]/40 bg-gradient-to-r from-[#3a0d16] via-[#0d1830] to-[#0a1f52] shadow-[0_10px_40px_rgba(59,95,176,0.18)]">
        {/* Red / navy glow accents */}
        <div className="pointer-events-none absolute -top-16 -left-10 h-48 w-48 rounded-full bg-[#b22234]/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 -right-8 h-48 w-48 rounded-full bg-[#3c5ccf]/25 blur-3xl" aria-hidden />

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss tribute"
          className="absolute top-2.5 right-2.5 z-10 h-8 w-8 flex items-center justify-center rounded-full text-[#cdd7f0] hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#8aa4e8]/60"
        >
          <span aria-hidden className="text-lg leading-none">×</span>
        </button>

        <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-5 sm:p-6">
          {/* Stars-and-stripes crest motif */}
          <div className="shrink-0 flex items-center justify-center h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border border-[#8aa4e8]/40 bg-gradient-to-br from-[#b22234]/30 to-[#0a2a7a]/40">
            <span className="text-4xl sm:text-5xl font-black bg-gradient-to-b from-white to-[#9db6f0] bg-clip-text text-transparent drop-shadow" aria-hidden>
              ★
            </span>
          </div>

          <div className="min-w-0 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[#9db6f0]">
                Home soil
              </span>
              <span aria-hidden>🇺🇸</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              Salute to <span className="bg-gradient-to-r from-[#ff6b7a] via-white to-[#9db6f0] bg-clip-text text-transparent">Tim Ream</span>
              <span className="text-[#9db6f0]"> · USMNT</span>
            </h2>
            <p className="mt-2 text-sm text-[#d8ddef] max-w-2xl">
              A veteran leader at the back for the Stars and Stripes, marshalling the defense with the calm
              of a player who&apos;s seen it all. As the USA co-hosts this World Cup, here&apos;s to a defensive
              rock and the pride of playing on home soil. ⭐🛡️
            </p>
            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
              {['USMNT stalwart', 'Veteran leader', 'Defensive rock', 'Co-host pride'].map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-[#dbe3f7] bg-[#3c5ccf]/15 border border-[#8aa4e8]/25"
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

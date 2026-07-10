'use client'

import { useSyncExternalStore } from 'react'
import type { TournamentKey } from '@/lib/tournament'

/**
 * Dismissable "Good luck, Jared" hero card for the top of the World Cup dashboard, wishing Jared
 * (the owner of Belgium) luck in his match today. World-Cup-only (hidden in March Madness) and
 * self-hides once dismissed — the dismissal persists in localStorage under a stable key so it stays
 * gone across reloads/navigation (same localStorage convention as ModeContext).
 *
 * Hydration: dismissal state lives only in localStorage, so the dismissal is read via
 * useSyncExternalStore. The SERVER snapshot reports "dismissed" so the card is never in the SSR
 * markup — this prevents both a hydration mismatch and a flash of the card for users who already
 * dismissed it; the real localStorage value takes over right after hydration.
 *
 * No photo/likeness is used — the design is pure typography + CSS (Belgium black/gold/red with a
 * ⚽ motif, 🇧🇪) to stay tasteful.
 */
const DISMISS_KEY = 'calcutta_dismiss_goodluck_jared'
const DISMISS_EVENT = 'calcutta:goodluck-jared-dismissed'

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

export function GoodLuckHero({ tournament }: { tournament: TournamentKey }) {
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

  // World-Cup-only hero; render nothing in March Madness or once dismissed.
  if (tournament !== 'worldcup' || dismissed) return null

  return (
    <section aria-label="Good luck, Jared" className="mb-6">
      <div className="relative overflow-hidden glass-card rounded-2xl border border-[#f0c400]/35 bg-gradient-to-r from-[#1a1206] via-[#12100a] to-[#2a0a0d] shadow-[0_10px_40px_rgba(240,196,0,0.15)]">
        {/* Gold / red glow accents */}
        <div className="pointer-events-none absolute -top-16 -left-10 h-48 w-48 rounded-full bg-[#f0c400]/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 -right-8 h-48 w-48 rounded-full bg-[#c8102e]/25 blur-3xl" aria-hidden />

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-2.5 right-2.5 z-10 h-8 w-8 flex items-center justify-center rounded-full text-[#f0dca0] hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#f0c400]/60"
        >
          <span aria-hidden className="text-lg leading-none">×</span>
        </button>

        <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-5 sm:p-6">
          {/* Ball motif */}
          <div className="shrink-0 flex items-center justify-center h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border border-[#f0c400]/40 bg-gradient-to-br from-[#f0c400]/20 to-[#c8102e]/25">
            <span className="text-5xl sm:text-6xl drop-shadow" aria-hidden>⚽</span>
          </div>

          <div className="min-w-0 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[#f0c400]">
                Match day
              </span>
              <span aria-hidden>🇧🇪</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              Good luck, <span className="bg-gradient-to-r from-[#ffe27a] via-[#f0c400] to-[#c8102e] bg-clip-text text-transparent">Jared</span>
            </h2>
            <p className="mt-2 text-sm text-[#e6e0cf] max-w-2xl">
              All the best to Jared, owner of <span className="text-white font-semibold">Belgium</span> 🇧🇪, as the
              Red Devils take the pitch today. May the bounces go your way and the goals fall in your favor.
              <span className="text-[#ffe27a] font-semibold"> Praised be, he.</span> ⚽
            </p>
            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
              {['Belgium', 'Red Devils', 'Match day', 'Good luck'].map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-[#f3e6b8] bg-[#f0c400]/12 border border-[#f0c400]/25"
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

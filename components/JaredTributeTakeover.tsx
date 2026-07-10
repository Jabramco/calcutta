'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { TournamentKey } from '@/lib/tournament'
import { Avatar, avatarSrcForName } from '@/components/Avatar'

/**
 * Full-page takeover tribute to Jared (owner of Belgium = user jhorton24), shown once his
 * Calcutta run has ended. A fixed, full-viewport overlay above everything (incl. nav) with a
 * dimmed/blurred backdrop and a premium, animated tribute card.
 *
 * Close affordances: an × button, the Esc key, and a backdrop click — any of which dismiss it.
 * Body scroll is locked while open and restored on close/unmount.
 *
 * Dismissal persists in localStorage under a stable key so it stays closed across reloads. It's
 * read via useSyncExternalStore with a SERVER snapshot of "dismissed" so the takeover is never in
 * the SSR markup — no hydration flash and no takeover flashing for users who already closed it.
 *
 * World-Cup-only: because this is a full-page takeover, it must NEVER render in March Madness.
 * No photo/likeness beyond the app's shared Avatar image; copy is evergreen (no fabricated stats).
 */
const DISMISS_KEY = 'calcutta_dismiss_jared_tribute_takeover'
const DISMISS_EVENT = 'calcutta:jared-tribute-takeover-dismissed'

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

export function JaredTributeTakeover({ tournament }: { tournament: TournamentKey }) {
  // Server snapshot = `true` (dismissed) so nothing renders during SSR / first paint; the client
  // snapshot reflects the real localStorage value once hydrated.
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, () => true)

  // Only "live" (rendered + interactive) in World Cup mode and when not dismissed.
  const open = tournament === 'worldcup' && !dismissed

  const close = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore persistence failure; the event below still closes it for this session.
    }
    window.dispatchEvent(new Event(DISMISS_EVENT))
  }

  // Lock body scroll while open; restore on close/unmount. Also wire Esc-to-close.
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tribute to Jared"
      className="jared-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md"
      onClick={close}
    >
      <div
        className="jared-card relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#f0c400]/40 bg-gradient-to-br from-[#1a1206] via-[#12100a] to-[#2a0a0d] p-7 sm:p-9 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accents */}
        <div className="pointer-events-none absolute -top-20 -left-16 h-56 w-56 rounded-full bg-[#f0c400]/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-[#c8102e]/25 blur-3xl" aria-hidden />

        {/* Sparkles */}
        <span className="jared-sparkle pointer-events-none absolute top-6 left-8 text-lg" aria-hidden style={{ animationDelay: '0s' }}>✨</span>
        <span className="jared-sparkle pointer-events-none absolute top-10 right-12 text-base" aria-hidden style={{ animationDelay: '0.6s' }}>✨</span>
        <span className="jared-sparkle pointer-events-none absolute bottom-10 left-14 text-base" aria-hidden style={{ animationDelay: '1.2s' }}>⭐</span>

        <button
          type="button"
          onClick={close}
          aria-label="Close tribute"
          className="absolute top-3.5 right-3.5 z-10 h-9 w-9 flex items-center justify-center rounded-full text-[#f0dca0] hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#f0c400]/60"
        >
          <span aria-hidden className="text-xl leading-none">×</span>
        </button>

        <div className="relative flex flex-col items-center">
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[#f0c400] mb-4 flex items-center gap-2">
            <span aria-hidden>🇧🇪</span> The final whistle <span aria-hidden>⚽</span>
          </div>

          {/* Jared's avatar — shared Avatar guarantees a perfect circle; halo ring around it. */}
          <div className="jared-avatar-halo shrink-0 rounded-full p-[3px] bg-gradient-to-br from-[#f0c400] to-[#c8102e] mb-5">
            <Avatar src={avatarSrcForName('jhorton24')} alt="jhorton24" size={128} className="block" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-black leading-tight text-white">
            A <span className="bg-gradient-to-r from-[#ffe27a] via-[#f0c400] to-[#c8102e] bg-clip-text text-transparent">Calcutta Legend</span>
          </h1>
          <p className="mt-1 text-lg font-bold text-[#f0dca0]">Thank you, Jared</p>

          <p className="mt-4 text-sm sm:text-[15px] leading-relaxed text-[#e6e0cf] max-w-md">
            The <span className="text-white font-semibold">Belgium</span> 🇧🇪 campaign has reached the final whistle.
            Every auction bid, every nervy watch-along, every roar at a goal — this run mattered, and you
            played it with heart. The Red Devils bow out, but the memories from this Calcutta don&apos;t.
          </p>
          <p className="mt-3 text-sm sm:text-[15px] leading-relaxed text-[#e6e0cf] max-w-md">
            Here&apos;s to the competitor, the passion, and one unforgettable ride. Chin up, champion —
            the pitch will be waiting next time. <span className="text-[#ffe27a] font-semibold">Praised be, he.</span>
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['Belgium', 'Red Devils', 'True competitor', 'Calcutta legend'].map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold text-[#f3e6b8] bg-[#f0c400]/12 border border-[#f0c400]/25"
              >
                {chip}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={close}
            className="mt-7 inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-[#1a1206] bg-gradient-to-r from-[#ffe27a] to-[#f0c400] hover:from-[#ffe89a] hover:to-[#f7d21a] transition-colors focus:outline-none focus:ring-2 focus:ring-[#f0c400]/60"
          >
            Take a bow
          </button>
        </div>
      </div>
    </div>
  )
}

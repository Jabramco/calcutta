'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode
} from 'react'
import { TOURNAMENT_COOKIE } from '@/lib/tournament'

export type AppMode = 'marchmadness' | 'worldcup'

export const DEFAULT_MODE: AppMode = 'worldcup'
const STORAGE_KEY = 'calcutta:mode'

function isAppMode(value: unknown): value is AppMode {
  return value === 'marchmadness' || value === 'worldcup'
}

/**
 * Mirror the selected mode into a cookie. The mode is otherwise purely client-side
 * (localStorage), but the shared API routes need to know which tournament to scope to.
 * Because the cookie rides along with every same-origin fetch, the server stays generic
 * and no fetch call site needs a tournament param.
 */
function writeModeCookie(mode: AppMode): void {
  try {
    document.cookie = `${TOURNAMENT_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`
  } catch {
    // Ignore cookie write failures.
  }
}

// Simple localStorage-backed external store so the mode survives reloads and
// stays in sync across tabs, without calling setState inside an effect.
const listeners = new Set<() => void>()

function getSnapshot(): AppMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isAppMode(stored)) {
      return stored
    }
  } catch {
    // Ignore storage access errors (private mode, disabled storage, etc.).
  }
  return DEFAULT_MODE
}

// SSR / first paint always renders the default so hydration matches.
function getServerSnapshot(): AppMode {
  return DEFAULT_MODE
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      callback()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

function writeMode(next: AppMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Ignore storage write failures.
  }
  // Set the cookie BEFORE notifying listeners so the re-render's data fetches
  // (which run against the shared, tournament-scoped API) see the new tournament.
  writeModeCookie(next)
  listeners.forEach((listener) => listener())
}

// Set the tournament cookie at module-eval time — this runs during client bootstrap,
// BEFORE any component's mount effect fires a data fetch. Without this, a page's fetch
// effect (a deep child) can run before the provider's cookie effect (the parent), so the
// first /api/stats|teams|auction request would carry no cookie and the server would fall
// back to the default tournament — leaking e.g. NCAA "Round of 64" labels into World Cup.
if (typeof window !== 'undefined') {
  writeModeCookie(getSnapshot())
}

interface ModeContextValue {
  mode: AppMode
  setMode: (mode: AppMode) => void
}

const ModeContext = createContext<ModeContextValue | null>(null)

export function ModeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const setMode = useCallback((next: AppMode) => writeMode(next), [])

  // Keep the cookie in sync with the persisted mode on mount (e.g. first visit, where
  // the value comes from localStorage and writeMode was never called this session).
  useEffect(() => {
    writeModeCookie(mode)
  }, [mode])

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  )
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext)
  if (!ctx) {
    throw new Error('useMode must be used within a ModeProvider')
  }
  return ctx
}

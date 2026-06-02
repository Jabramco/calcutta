'use client'

import { usePathname } from 'next/navigation'
import { type ReactNode } from 'react'
import { useMode } from './ModeContext'

/** Public pages render their own content regardless of the selected experience. */
const ALWAYS_RENDER_PATHS = new Set(['/login', '/signup'])

/**
 * Both experiences render the EXACT SAME pages/components — only the underlying data
 * (teams/groups) and configuration (payouts) differ, scoped server-side by the
 * tournament cookie. We key the subtree by mode so switching tournaments in the header
 * remounts the current page and it refetches against the now-active tournament.
 */
export default function ModeContent({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { mode } = useMode()

  if (pathname && ALWAYS_RENDER_PATHS.has(pathname)) {
    return <>{children}</>
  }

  return <div key={mode}>{children}</div>
}

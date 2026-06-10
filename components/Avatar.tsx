import Image from 'next/image'

/**
 * Circular user/owner avatar shown to the left of a username or owner name.
 *
 * Phase 1 uses a single static placeholder image (`public/avatar-test.png`) for everyone.
 * The component is intentionally built so per-user images drop in with zero call-site
 * churn: when uploads land later, callers just pass the user's image URL via `src` and
 * nothing else changes — `src` falls back to the shared placeholder whenever it's
 * missing/empty.
 */
const DEFAULT_AVATAR_SRC = '/avatar-test.png'

/**
 * TEMPORARY per-user avatar override (test only).
 *
 * Maps specific display names to a distinct image so we can exercise the Avatar `src`
 * path before real per-user image uploads exist. Lookup is case-insensitive. Returns
 * `undefined` for everyone else, so the Avatar falls back to the shared placeholder.
 *
 * This whole map (and the `src={avatarSrcForName(name)}` props at call sites) should be
 * removed once real per-user images land — keys are kept lowercase for trivial matching.
 */
const TEST_AVATAR_OVERRIDES: Record<string, string> = {
  brianglover: '/avatar-test-2.png',
  mullard97: '/avatar-test-3.png',
  decoy: '/avatar-test-4.png',
  terryrozier: '/avatar-test-5.png',
  jhorton24: '/avatar-test-6.png',
  rockabyebrady: '/avatar-test-7.png',
  ryshawn: '/avatar-test-8.png',
  omgnofeet: '/avatar-test-9.png',
}

export function avatarSrcForName(name?: string | null): string | undefined {
  if (!name) return undefined
  return TEST_AVATAR_OVERRIDES[name.trim().toLowerCase()]
}

interface AvatarProps {
  /** Per-user image URL. Falls back to the shared placeholder when omitted or empty. */
  src?: string | null
  /** Person's name — used as the accessible alt text. */
  alt?: string
  /** Square pixel size (width === height). Defaults to a compact inline size. */
  size?: number
  /** Extra classes for spacing/positioning at the call site. */
  className?: string
}

export function Avatar({ src, alt = '', size = 26, className = '' }: AvatarProps) {
  const resolvedSrc = src && src.trim().length > 0 ? src : DEFAULT_AVATAR_SRC
  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={size}
      height={size}
      className={`inline-block shrink-0 rounded-full object-cover ring-1 ring-[#2a2a38] bg-[#1c1c28] ${className}`}
    />
  )
}

export default Avatar

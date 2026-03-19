/**
 * Read-only auction page (archive view after the auction ends).
 *
 * The auction page also goes read-only automatically when the API reports a finished
 * auction: inactive, no current team, and zero teams remaining (no .env needed).
 *
 * Optional: set `NEXT_PUBLIC_AUCTION_READONLY=true` in `.env` / Vercel to force
 * read-only even before that state (e.g. mid-season archive). Remove the var and
 * redeploy for the full live UI — no code paths are deleted.
 */
export const AUCTION_PAGE_READONLY =
  process.env.NEXT_PUBLIC_AUCTION_READONLY === 'true'

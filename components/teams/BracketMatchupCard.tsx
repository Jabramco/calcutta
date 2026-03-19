'use client'

import { formatCurrency } from '@/lib/calculations'
import type { TeamWithOwner } from '@/lib/types'
import type { BracketSlotDisplay } from '@/lib/bracket'

const ROUND_KEYS: (keyof TeamWithOwner)[] = [
  'round64',
  'round32',
  'sweet16',
  'elite8',
  'final4',
  'championship'
]

function TeamRow({
  slot,
  compact
}: {
  slot: BracketSlotDisplay
  compact?: boolean
}) {
  const t = slot.team

  if (compact) {
    return (
      <div className="px-2 py-1.5 flex items-start gap-2 min-w-0 min-h-[48px]">
        <span className="text-[#00ceb8] font-bold tabular-nums text-[10px] w-4 shrink-0 pt-0.5">{slot.seed}</span>
        <div className="min-w-0 flex-1">
          <div className="text-white font-medium text-[11px] leading-tight truncate" title={slot.name}>{slot.name}</div>
          <div className="text-[10px] text-[#c8c8d8] truncate mt-0.5 leading-snug" title={t?.owner?.name ?? 'Unassigned'}>
            {t?.owner?.name ?? <span className="text-[#9a9ab0]">Unassigned</span>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[#00ceb8] font-bold tabular-nums w-6 shrink-0">{slot.seed}</span>
          <span className="text-white font-medium text-sm leading-snug break-words">{slot.name}</span>
        </div>
        <div className="mt-1 text-xs text-[#a0a0b8] pl-8 sm:pl-0 sm:mt-0 sm:inline sm:ml-2">
          {t?.owner?.name ?? <span className="text-[#6a6a82]">Unassigned</span>}
        </div>
      </div>
      <div className="flex items-center gap-3 pl-8 sm:pl-0 shrink-0">
        <div className="text-sm font-semibold text-white tabular-nums w-16 text-right">
          {t ? formatCurrency(Number(t.cost)) : '—'}
        </div>
        <div className="flex gap-0.5" title="Tournament wins">
          {ROUND_KEYS.map((key) => (
            <span
              key={key}
              className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
                t && Boolean(t[key])
                  ? 'bg-[#2dce89]/25 text-[#2dce89]'
                  : 'bg-[#2a2a38]/80 text-[#4a4a58]'
              }`}
            >
              {t && t[key] ? '✓' : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BracketMatchupCard({
  top,
  bottom,
  pairIndex,
  compact = false
}: {
  top: BracketSlotDisplay
  bottom: BracketSlotDisplay
  pairIndex: number
  compact?: boolean
}) {
  return (
    <div
      className={`rounded-xl border border-[#2a2a38] bg-[#15151e]/90 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:border-[#00ceb8]/25 transition-colors overflow-hidden ${
        compact ? 'min-w-[128px] max-w-[200px] min-h-[96px]' : 'min-w-[200px]'
      }`}
    >
      {!compact && (
        <div className="px-2 py-1 bg-[#1c1c28]/90 border-b border-[#2a2a38] flex justify-between items-center">
          <span className="text-[10px] uppercase tracking-wider text-[#6a6a82] font-semibold">First round</span>
          <span className="text-[10px] text-[#00ceb8]/80 tabular-nums">#{pairIndex + 1}</span>
        </div>
      )}
      <div className="divide-y divide-[#2a2a38]">
        <TeamRow slot={top} compact={compact} />
        <TeamRow slot={bottom} compact={compact} />
      </div>
    </div>
  )
}

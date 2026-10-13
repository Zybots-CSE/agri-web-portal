import { cn } from '#/lib/utils'
import type { StatusLevel } from '#/lib/sensor-rules'

const LEVEL_STYLES: Record<StatusLevel, string> = {
  ok: 'bg-emerald-100 text-emerald-800 border-emerald-300/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  warn: 'bg-amber-100 text-amber-800 border-amber-300/60 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  critical:
    'bg-red-100 text-red-800 border-red-300/60 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
}

const DOT_STYLES: Record<StatusLevel, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  critical: 'bg-red-500',
}

export function StatusBadge({
  level,
  label,
  className,
}: {
  level: StatusLevel
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        LEVEL_STYLES[level],
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', DOT_STYLES[level])} />
      {label}
    </span>
  )
}

export const STATUS_DOT: Record<StatusLevel, string> = DOT_STYLES

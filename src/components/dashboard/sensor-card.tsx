import type { SensorParam, StatusLevel } from '#/lib/sensor-rules'
import { formatValue, statusForValue } from '#/lib/sensor-rules'
import { cn } from '#/lib/utils'
import { formatDateTime } from '#/lib/format'
import {
  TriangleAlert,
  Info,
  FlaskConical,
  Zap,
  Droplets,
  Thermometer,
  Leaf,
  Sprout,
  Flower2,
} from 'lucide-react'
import { StatusBadge } from './status-badge'

const ICONS: Record<
  SensorParam['key'],
  React.ComponentType<{ className?: string }>
> = {
  ph: FlaskConical,
  ec: Zap,
  moisture: Droplets,
  temperature: Thermometer,
  nitrogen: Leaf,
  phosphorus: Sprout,
  potassium: Flower2,
}

const ZONE_BG: Record<StatusLevel, string> = {
  ok: 'bg-emerald-500/70 dark:bg-emerald-600/70',
  warn: 'bg-amber-500/70 dark:bg-amber-600/70',
  critical: 'bg-red-500/70 dark:bg-red-600/70',
}

function ZoneBar({ param, value }: { param: SensorParam; value: number }) {
  const span = param.sensorMax - param.sensorMin
  const pct = (v: number) => ((v - param.sensorMin) / span) * 100
  const markerPct = Math.min(100, Math.max(0, pct(value)))

  return (
    <div className="relative">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {param.zones.map((zone) => (
          <div
            key={`${zone.from}-${zone.to}`}
            className={cn('h-full', ZONE_BG[zone.level])}
            style={{ width: `${pct(zone.to) - pct(zone.from)}%` }}
            title={`${zone.from}–${zone.to}: ${zone.label}`}
          />
        ))}
      </div>
      {/* Current value marker */}
      <div
        className="absolute -top-1 h-3.5 w-[2px] rounded-full bg-sea-ink shadow-sm dark:bg-sea-ink"
        style={{ left: `calc(${markerPct}% - 1px)` }}
      >
        <div className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sea-ink ring-2 ring-white dark:ring-0" />
      </div>
    </div>
  )
}

function Sparkline({
  values,
  level,
}: {
  values: number[]
  level: StatusLevel
}) {
  if (values.length < 2) return null
  const W = 120
  const H = 30
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W
      const y = H - 2 - ((v - min) / range) * (H - 4)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const color =
    level === 'ok'
      ? 'var(--palm)'
      : level === 'warn'
        ? 'var(--chart-4)'
        : 'var(--destructive)'

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-8 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function SensorCard({
  param,
  value,
  spark,
  recordedAt,
}: {
  param: SensorParam
  /** latest reading value — null when the device has no readings yet */
  value: number | null
  /** recent values (oldest → newest) for the mini trend */
  spark?: number[]
  recordedAt?: string
}) {
  const status = value !== null ? statusForValue(param, value) : null
  const Icon = ICONS[param.key]

  return (
    <div className="feature-card group relative flex flex-col gap-3 rounded-xl border border-line p-4 transition-transform">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex size-8 items-center justify-center rounded-lg',
              status?.level === 'ok' &&
                'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
              status?.level === 'warn' &&
                'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
              (status?.level === 'critical' || status === null) &&
                'bg-muted text-sea-ink-soft',
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{param.label}</div>
            <div className="text-[11px] text-sea-ink-soft">
              Target {param.targetLabel}
              {param.unit && ` ${param.unit}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            title={param.purpose}
            className="flex size-5 items-center justify-center rounded-full text-sea-ink-soft/70 transition-colors hover:bg-accent hover:text-sea-ink"
          >
            <Info className="size-3.5" />
          </span>
          {status ? (
            <StatusBadge
              level={status.level}
              label={
                status.level === 'ok'
                  ? 'OK'
                  : status.level === 'warn'
                    ? 'Watch'
                    : 'Alert'
              }
            />
          ) : (
            <StatusBadge level="ok" label="—" />
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        {value !== null ? (
          <span className="display-title text-3xl font-bold tracking-tight">
            {formatValue(param, value)}
          </span>
        ) : (
          <span className="display-title text-3xl font-bold tracking-tight text-sea-ink-soft/50">
            —
          </span>
        )}
        {param.unit && (
          <span className="text-sm font-medium text-sea-ink-soft">
            {param.unit}
          </span>
        )}
        {recordedAt && (
          <span className="ml-auto text-[11px] text-sea-ink-soft">
            {formatDateTime(recordedAt)}
          </span>
        )}
      </div>

      {value !== null ? (
        <>
          <ZoneBar param={param} value={value} />
          <div className="flex justify-between text-[10px] tabular-nums text-sea-ink-soft/80">
            <span>{param.sensorMin}</span>
            <span>{param.sensorMax}</span>
          </div>
          {spark && spark.length > 1 && (
            <Sparkline values={spark} level={status!.level} />
          )}
          {status!.level !== 'ok' && (
            <p
              className={cn(
                'flex items-start gap-1.5 text-xs font-medium',
                status!.level === 'warn'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-red-700 dark:text-red-300',
              )}
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              {status!.label}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-sea-ink-soft">
          Waiting for the first reading…
        </p>
      )}
    </div>
  )
}

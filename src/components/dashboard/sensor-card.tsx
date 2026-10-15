import type { SensorParam, StatusLevel } from '#/lib/sensor-rules'
import { formatValue, statusForValue } from '#/lib/sensor-rules'
import { cn } from '#/lib/utils'
import { formatDateTime } from '#/lib/format'
import { useSensorText } from '#/lib/i18n/sensor-text'
import { Trans, useLingui } from '@lingui/react/macro'
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
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '#/components/ui/popover'
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
  const tx = useSensorText()

  return (
    <div className="relative">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {param.zones.map((zone) => (
          <div
            key={`${zone.from}-${zone.to}`}
            className={cn('h-full', ZONE_BG[zone.level])}
            style={{ width: `${pct(zone.to) - pct(zone.from)}%` }}
            title={`${zone.from}–${zone.to}: ${tx.text(zone.label)}`}
          />
        ))}
      </div>
      {/* Current value marker */}
      <div
        className="absolute -top-1.5 h-5 w-[3px] rounded-full bg-sea-ink shadow-sm dark:bg-sea-ink"
        style={{ left: `calc(${markerPct}% - 1.5px)` }}
      >
        <div className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sea-ink ring-2 ring-white dark:ring-0" />
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
      className="h-12 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
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
  const { t, i18n } = useLingui()
  const tx = useSensorText()
  const status = value !== null ? statusForValue(param, value) : null
  const Icon = ICONS[param.key]
  const label = tx.label(param)
  const target = param.targetLabel

  return (
    <div className="feature-card group relative flex flex-col gap-5 rounded-2xl border border-line p-6 transition-transform">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex size-11 items-center justify-center rounded-xl',
              status?.level === 'ok' &&
                'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
              status?.level === 'warn' &&
                'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
              (status?.level === 'critical' || status === null) &&
                'bg-muted text-sea-ink-soft',
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="leading-tight">
            <div className="text-base font-semibold">{label}</div>
            <div className="text-xs text-sea-ink-soft">
              <Trans>Target {target}</Trans>
              {param.unit && ` ${param.unit}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t`About ${label}`}
                className="flex size-7 cursor-pointer items-center justify-center rounded-full text-sea-ink-soft/70 transition-colors hover:bg-accent hover:text-sea-ink focus-visible:ring-2 focus-visible:ring-lagoon focus-visible:outline-none data-[state=open]:bg-accent data-[state=open]:text-sea-ink"
              >
                <Info className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 text-sm">
              <PopoverHeader>
                <PopoverTitle className="font-semibold text-sea-ink">
                  {label}
                </PopoverTitle>
                <PopoverDescription className="text-sea-ink-soft">
                  {tx.purpose(param)}
                </PopoverDescription>
              </PopoverHeader>
              <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-sea-ink-soft">
                    <Trans>Target</Trans>
                  </span>
                  <span className="font-medium text-sea-ink">
                    {param.targetLabel}
                    {param.unit && ` ${param.unit}`}
                  </span>
                </div>
                {param.zones.map((zone) => (
                  <div
                    key={`${zone.from}-${zone.to}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-1.5 text-sea-ink-soft">
                      <span
                        className={cn(
                          'size-2 shrink-0 rounded-full',
                          ZONE_BG[zone.level],
                        )}
                      />
                      {tx.text(zone.label)}
                    </span>
                    <span className="tabular-nums text-sea-ink">
                      {zone.from}–{zone.to}
                    </span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {status ? (
            <StatusBadge
              level={status.level}
              label={
                status.level === 'ok'
                  ? t`OK`
                  : status.level === 'warn'
                    ? t`Watch`
                    : t`Alert`
              }
            />
          ) : (
            <StatusBadge level="ok" label="—" />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        {value !== null ? (
          <span className="display-title text-4xl font-bold tracking-tight xl:text-5xl">
            {formatValue(param, value)}
          </span>
        ) : (
          <span className="display-title text-4xl font-bold tracking-tight text-sea-ink-soft/50 xl:text-5xl">
            —
          </span>
        )}
        {param.unit && (
          <span className="text-base font-medium text-sea-ink-soft">
            {param.unit}
          </span>
        )}
        {recordedAt && (
          <span className="ml-auto text-xs text-sea-ink-soft">
            {formatDateTime(recordedAt, i18n.locale)}
          </span>
        )}
      </div>

      {value !== null ? (
        <>
          <ZoneBar param={param} value={value} />
          <div className="flex justify-between text-xs tabular-nums text-sea-ink-soft/80">
            <span>{param.sensorMin}</span>
            <span>{param.sensorMax}</span>
          </div>
          {spark && spark.length > 1 && (
            <Sparkline values={spark} level={status!.level} />
          )}
          {status!.level !== 'ok' && (
            <p
              className={cn(
                'flex items-start gap-2 text-sm font-medium',
                status!.level === 'warn'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-red-700 dark:text-red-300',
              )}
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {tx.text(status!.label)}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-sea-ink-soft">
          <Trans>Waiting for the first reading…</Trans>
        </p>
      )}
    </div>
  )
}

import { useRef, useState } from 'react'
import type { SensorParam, StatusLevel } from '#/lib/sensor-rules'
import { formatValue } from '#/lib/sensor-rules'
import { cn } from '#/lib/utils'
import { formatDayTime, formatTime } from '#/lib/format'

/**
 * Dependency-free SVG trend chart with:
 *  - faint hard-rule risk bands (warn/critical zones)
 *  - hover crosshair + tooltip
 *  - time axis in Asia/Colombo time
 */

export type ChartPoint = { t: number; v: number; label?: string }

const ZONE_FILL: Record<StatusLevel, string> = {
  ok: 'transparent',
  warn: 'rgba(245, 158, 11, 0.10)',
  critical: 'rgba(239, 68, 68, 0.10)',
}

const W = 800
const H = 300
const PAD = { top: 16, right: 14, bottom: 28, left: 48 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

function niceDomain(
  points: ChartPoint[],
  param: SensorParam,
): [number, number] {
  let min = Math.min(...points.map((p) => p.v))
  let max = Math.max(...points.map((p) => p.v))
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    min = min || 0
    max = min + 1
  }
  const pad = (max - min) * 0.18 || 1
  const lo = Math.max(param.sensorMin, min - pad)
  const hi = Math.min(param.sensorMax, max + pad)
  return [lo, hi]
}

export function TrendChart({
  param,
  points,
}: {
  param: SensorParam
  points: ChartPoint[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (points.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-sea-ink-soft">
        No readings in this range yet.
      </div>
    )
  }

  const [lo, hi] = niceDomain(points, param)
  const t0 = points[0]!.t
  const t1 = points[points.length - 1]!.t
  const tSpan = t1 - t0 || 1

  const xOf = (t: number) => PAD.left + ((t - t0) / tSpan) * PLOT_W
  const yOf = (v: number) =>
    PAD.top + PLOT_H - ((v - lo) / (hi - lo || 1)) * PLOT_H

  const linePath = points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${xOf(p.t).toFixed(1)},${yOf(p.v).toFixed(1)}`,
    )
    .join(' ')
  const areaPath = `${linePath} L${xOf(t1).toFixed(1)},${PAD.top + PLOT_H} L${xOf(t0).toFixed(1)},${PAD.top + PLOT_H} Z`

  // Horizontal grid + y labels
  const yTicks = 4
  const gridVals = Array.from(
    { length: yTicks + 1 },
    (_, i) => lo + ((hi - lo) * i) / yTicks,
  )

  // X labels: 5 evenly spaced points
  const xTickCount = Math.min(5, points.length)
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.round((i / (xTickCount - 1)) * (points.length - 1))
    return points[idx]!
  })

  const values = points.map((p) => p.v)
  const stats = {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
  }

  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null

  const handleMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * W
    const tHover = t0 + ((x - PAD.left) / PLOT_W) * tSpan
    // nearest point
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i]!.t - tHover)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    if (x < PAD.left - 8 || x > W - PAD.right + 8) {
      setHoverIdx(null)
    } else {
      setHoverIdx(best)
    }
  }

  // Tooltip position in % (clamped inside the container)
  const tooltipX = hoverPoint
    ? Math.min(88, Math.max(1.5, (xOf(hoverPoint.t) / W) * 100))
    : 0
  const tooltipY = hoverPoint
    ? Math.max(2, Math.min(88, (yOf(hoverPoint.v) / H) * 100))
    : 0

  const rangeDays = tSpan / (24 * 3600_000)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-sea-ink-soft">
        <span>
          Min <b className="text-sea-ink">{formatValue(param, stats.min)}</b>
        </span>
        <span>
          Avg <b className="text-sea-ink">{formatValue(param, stats.avg)}</b>
        </span>
        <span>
          Max <b className="text-sea-ink">{formatValue(param, stats.max)}</b>
          {param.unit && ` ${param.unit}`}
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label={`${param.label} trend chart`}
        >
          <defs>
            <linearGradient
              id={`area-${param.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="var(--lagoon)" stopOpacity="0.30" />
              <stop
                offset="100%"
                stopColor="var(--lagoon)"
                stopOpacity="0.02"
              />
            </linearGradient>
          </defs>

          {/* Risk zone bands (hard rule warn/critical areas) */}
          {param.zones
            .filter((z) => z.level !== 'ok')
            .map((z) => {
              const yTop = Math.max(PAD.top, yOf(Math.min(z.to, hi)))
              const yBottom = Math.min(
                PAD.top + PLOT_H,
                yOf(Math.max(z.from, lo)),
              )
              if (yBottom <= yTop) return null
              return (
                <rect
                  key={`zone-${z.from}`}
                  x={PAD.left}
                  y={yTop}
                  width={PLOT_W}
                  height={yBottom - yTop}
                  fill={ZONE_FILL[z.level]}
                />
              )
            })}

          {/* Grid + y labels */}
          {gridVals.map((v, i) => (
            <g key={`y-${i}`}>
              <line
                x1={PAD.left}
                x2={PAD.left + PLOT_W}
                y1={yOf(v)}
                y2={yOf(v)}
                stroke="var(--line)"
                strokeWidth="1"
                strokeDasharray={i === 0 ? undefined : '3 4'}
              />
              <text
                x={PAD.left - 8}
                y={yOf(v) + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--sea-ink-soft)"
              >
                {formatValue(param, v)}
              </text>
            </g>
          ))}

          {/* X labels */}
          {xTicks.map((p, i) => (
            <text
              key={`x-${p.t}-${i}`}
              x={xOf(p.t)}
              y={H - 8}
              textAnchor={
                i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'
              }
              fontSize="11"
              fill="var(--sea-ink-soft)"
            >
              {rangeDays <= 1.2 ? formatTime(p.t) : formatDayTime(p.t)}
            </text>
          ))}

          {/* Area + line */}
          <path d={areaPath} fill={`url(#area-${param.key})`} />
          <path
            d={linePath}
            fill="none"
            stroke="var(--lagoon-deep)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hover crosshair */}
          {hoverPoint && (
            <g>
              <line
                x1={xOf(hoverPoint.t)}
                x2={xOf(hoverPoint.t)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke="var(--sea-ink-soft)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={xOf(hoverPoint.t)}
                cy={yOf(hoverPoint.v)}
                r="4.5"
                fill="var(--lagoon-deep)"
                stroke="white"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {hoverPoint && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-white/95 px-2.5 py-1.5 text-xs shadow-lg dark:bg-(--surface-strong)"
            style={{
              left: `${tooltipX}%`,
              top: `${tooltipY}%`,
              transform: `translate(${tooltipX > 80 ? '-85%' : tooltipX < 12 ? '5%' : '-50%'}, -115%)`,
            }}
          >
            <div className="font-semibold">
              {formatValue(param, hoverPoint.v)}
              {param.unit && ` ${param.unit}`}
            </div>
            {hoverPoint.label && (
              <div className="text-[10px] font-semibold text-lagoon-deep">
                {hoverPoint.label}
              </div>
            )}
            <div className="text-[10px] text-sea-ink-soft">
              {formatDayTime(hoverPoint.t)}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] text-sea-ink-soft">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-amber-500/25" />{' '}
          Watch zone
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-red-500/25" />{' '}
          Alert zone
        </span>
        <span className={cn('ml-auto')}>
          {points.length} readings · times shown in Asia/Colombo
        </span>
      </div>
    </div>
  )
}

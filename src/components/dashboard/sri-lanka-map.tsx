import type { StatusLevel } from '#/lib/sensor-rules'
import { cn } from '#/lib/utils'
import { STATUS_DOT } from './status-badge'

/**
 * Stylised SVG map of Sri Lanka with live device markers.
 *
 * The viewBox equals the SRS GPS acceptance bounds
 * (lat 5.9–9.9 °N, lon 79.6–81.9 °E), so any reading that passes the
 * hard-rule filter plots inside the frame.
 */

const BOUNDS = {
  latMin: 5.9,
  latMax: 9.9,
  lonMin: 79.6,
  lonMax: 81.9,
}

const W = 420
const H = 738
const INSET = 10
const MAP_W = W - INSET * 2
const MAP_H = H - INSET * 2

/** project lon/lat → SVG coordinates (with a small inset frame) */
function project(lon: number, lat: number): { x: number; y: number } {
  const fx = (lon - BOUNDS.lonMin) / (BOUNDS.lonMax - BOUNDS.lonMin)
  const fy = (BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)
  return {
    x: INSET + fx * MAP_W,
    y: INSET + fy * MAP_H,
  }
}

/** Simplified coastline, clockwise from Point Pedro: [lon, lat] */
const OUTLINE: [number, number][] = [
  [80.03, 9.83], // Point Pedro (north tip)
  [79.85, 9.78], // Kankesanthurai
  [79.83, 9.62], // Jaffna peninsula west
  [79.96, 9.4], // south of the lagoon funnel
  [79.75, 9.0], // Mannar island (merged)
  [79.98, 8.8], // mainland coast south of Mannar
  [79.95, 8.45], // Wilpattu coast
  [79.7, 8.4], // Kalpitiya peninsula tip
  [79.82, 8.2], // Puttalam lagoon
  [79.83, 7.95], // Puttalam coast
  [79.79, 7.58], // Chilaw
  [79.84, 7.21], // Negombo
  [79.85, 6.93], // Colombo
  [79.9, 6.71], // Panadura
  [79.96, 6.58], // Kalutara
  [80.05, 6.35], // Ambalangoda
  [80.21, 6.04], // Galle
  [80.43, 5.97], // Weligama
  [80.58, 5.92], // Dondra Head (south tip)
  [80.79, 6.02], // Tangalle
  [81.12, 6.12], // Hambantota
  [81.33, 6.2], // Kirinda
  [81.55, 6.36], // Yala coast
  [81.83, 6.87], // Pottuvil
  [81.87, 7.05], // Sangamankanda Point (east tip)
  [81.68, 7.72], // Batticaloa
  [81.55, 7.92], // Valaichchenai
  [81.23, 8.57], // Trincomalee
  [81.0, 8.93], // Pulmoddai
  [80.81, 9.27], // Mullaitivu
  [80.53, 9.5], // Chundikulam spit
  [80.35, 9.58], // Elephant Pass coast
]

const OUTLINE_PATH =
  'M' +
  OUTLINE.map(([lon, lat]) => {
    const p = project(lon, lat)
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' L') +
  ' Z'

export type MapDevice = {
  id: string
  name: string
  district: string | null
  region: string | null
  lat: number
  lon: number
  status: StatusLevel
  /** one-line summary under the device name in the tooltip */
  info: string
}

export function SriLankaMap({
  devices,
  selectedId,
  onSelect,
}: {
  devices: MapDevice[]
  selectedId?: string
  onSelect: (deviceId: string) => void
}) {
  // Graticule: 1° lines within the bounds
  const latLines = [6, 7, 8, 9]
  const lonLines = [80, 81]

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative mx-auto w-full max-w-[380px]"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 h-full w-full"
          aria-label="Map of Sri Lanka with sensor locations"
        >
          {/* GPS bounds frame */}
          <rect
            x={INSET}
            y={INSET}
            width={MAP_W}
            height={MAP_H}
            rx="8"
            fill="color-mix(in oklab, var(--lagoon) 7%, transparent)"
            stroke="var(--line)"
          />

          {/* Graticule */}
          {latLines.map((lat) => {
            const { y } = project(80, lat)
            return (
              <g key={`lat-${lat}`}>
                <line
                  x1={INSET}
                  x2={W - INSET}
                  y1={y}
                  y2={y}
                  stroke="var(--sea-ink)"
                  strokeOpacity="0.12"
                  strokeDasharray="2 5"
                />
                <text
                  x={INSET + 4}
                  y={y - 3}
                  fontSize="8"
                  fill="var(--sea-ink-soft)"
                  fillOpacity="0.8"
                >
                  {lat}°N
                </text>
              </g>
            )
          })}
          {lonLines.map((lon) => {
            const { x } = project(lon, 7.9)
            return (
              <g key={`lon-${lon}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={INSET}
                  y2={H - INSET}
                  stroke="var(--sea-ink)"
                  strokeOpacity="0.12"
                  strokeDasharray="2 5"
                />
                <text
                  x={x + 3}
                  y={H - INSET - 4}
                  fontSize="8"
                  fill="var(--sea-ink-soft)"
                  fillOpacity="0.8"
                >
                  {lon}°E
                </text>
              </g>
            )
          })}

          {/* Landmass */}
          <path
            d={OUTLINE_PATH}
            fill="color-mix(in oklab, var(--palm) 22%, var(--sand))"
            stroke="var(--lagoon-deep)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>

        {/* Device markers (HTML for accessible tooltips + clicks) */}
        {devices.map((device) => {
          const p = project(device.lon, device.lat)
          const left = (p.x / W) * 100
          const top = (p.y / H) * 100
          const selected = device.id === selectedId
          return (
            <button
              key={device.id}
              type="button"
              onClick={() => onSelect(device.id)}
              className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ left: `${left}%`, top: `${top}%` }}
              aria-label={`Select ${device.name}`}
            >
              <span className="relative flex items-center justify-center">
                {selected && (
                  <span className="absolute inline-flex size-7 animate-ping rounded-full bg-lagoon/30" />
                )}
                <span
                  className={cn(
                    'relative flex size-3.5 items-center justify-center rounded-full border-2 border-white shadow-md transition-transform group-hover:scale-125',
                    STATUS_DOT[device.status],
                    selected && 'size-4 ring-2 ring-sea-ink/40',
                  )}
                />
                <span className="pointer-events-none absolute top-4 left-1/2 z-20 hidden w-44 -translate-x-1/2 rounded-lg border border-line bg-white/95 p-2.5 text-left shadow-xl group-hover:block dark:bg-(--surface-strong) md:group-focus-visible:block">
                  <span className="block text-[11px] font-bold">
                    {device.name}
                  </span>
                  <span className="block text-[10px] text-sea-ink-soft">
                    {device.district ?? 'Unknown district'}
                    {device.region ? ` · ${device.region}` : ''}
                  </span>
                  <span className="mt-1 block text-[10px] text-sea-ink-soft">
                    {device.info}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-sea-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-full', STATUS_DOT.ok)} /> All
          parameters OK
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-full', STATUS_DOT.warn)} />{' '}
          Watch
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-full', STATUS_DOT.critical)} />{' '}
          Alert
        </span>
      </div>
      <p className="text-center text-[10px] text-sea-ink-soft/80">
        GPS bounds per SRS: 5.9–9.9 °N, 79.6–81.9 °E — snapped to NRMC
        agro-ecological regions
      </p>
    </div>
  )
}

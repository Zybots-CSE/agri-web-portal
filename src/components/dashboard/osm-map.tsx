import { useEffect, useMemo, useRef, useState } from 'react'
import type { LayerGroup, Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  SENSOR_PARAM_LIST,
  formatValue,
  overallStatus,
  statusForValue,
} from '#/lib/sensor-rules'
import type { SensorValues, StatusLevel } from '#/lib/sensor-rules'
import type { ReadingDTO } from '#/lib/server/queries'
import { formatDateTime } from '#/lib/format'
import { cn } from '#/lib/utils'
import { STATUS_DOT } from './status-badge'

/**
 * OpenStreetMap view of the local study area (Leaflet + OSM raster tiles).
 *
 * Probes are placed at a spot, read, then moved — so the map shows every
 * placement as a small trail dot, plus a status-coloured ring on the
 * latest reading of each sampling spot. Leaflet is imported dynamically
 * inside an effect because it touches `window` and must never run during
 * SSR.
 */

const STATUS_COLOR: Record<StatusLevel, string> = {
  ok: '#10b981',
  warn: '#f59e0b',
  critical: '#ef4444',
}
const TRAIL_COLOR = '#328f97' // --lagoon-deep

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function valuesOf(r: ReadingDTO): SensorValues {
  return {
    ph: r.ph,
    ec: r.ec,
    moisture: r.moisture,
    temperature: r.temperature,
    nitrogen: r.nitrogen,
    phosphorus: r.phosphorus,
    potassium: r.potassium,
  }
}

/** Group key: named spot when the probe tagged one, else ~11 m grid cell */
function spotKey(r: ReadingDTO): string {
  return r.spot ?? `${r.lat.toFixed(4)}|${r.lon.toFixed(4)}`
}

function popupHtml(r: ReadingDTO): string {
  const v = valuesOf(r)
  const overall = overallStatus(v)
  const label = r.spot ?? `${r.lat.toFixed(4)}°N, ${r.lon.toFixed(4)}°E`
  const statusText =
    overall.level === 'ok'
      ? 'All parameters OK'
      : overall.level === 'warn'
        ? 'Watch'
        : 'Alert'
  const rows = SENSOR_PARAM_LIST.map((p) => {
    const level = statusForValue(p, v[p.key]).level
    return `<tr>
      <td style="padding:1px 10px 1px 0;color:var(--sea-ink-soft)">${p.short}</td>
      <td style="padding:1px 0;text-align:right;font-weight:700;color:${STATUS_COLOR[level]}">${formatValue(p, v[p.key])}${p.unit ? ` ${p.unit}` : ''}</td>
    </tr>`
  }).join('')
  return `
    <div style="min-width:190px">
      <div style="font-weight:800;font-size:12px;color:var(--sea-ink)">${escapeHtml(label)}</div>
      <div style="display:flex;align-items:center;gap:5px;margin:2px 0 7px;font-size:10px;color:var(--sea-ink-soft)">
        <span style="display:inline-block;width:7px;height:7px;border-radius:9999px;background:${STATUS_COLOR[overall.level]}"></span>
        ${escapeHtml(statusText)} · ${escapeHtml(r.deviceId)} · ${escapeHtml(formatDateTime(r.recordedAt))}
      </div>
      <table style="font-size:11px;border-collapse:collapse;color:var(--sea-ink)">${rows}</table>
    </div>`
}

export function OsmMap({
  center,
  readings,
  selectedDeviceId,
}: {
  center: { lat: number; lon: number }
  /** every placement over the loaded window, oldest first */
  readings: ReadingDTO[]
  selectedDeviceId?: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const trailLayerRef = useRef<LayerGroup | null>(null)
  const spotsLayerRef = useRef<LayerGroup | null>(null)
  const didFitRef = useRef(false)
  const [ready, setReady] = useState(false)

  // Latest reading per sampling spot (readings arrive oldest → newest)
  const spotLatest = useMemo(() => {
    const bySpot = new Map<string, ReadingDTO>()
    for (const r of readings) bySpot.set(spotKey(r), r)
    return [...bySpot.values()]
  }, [readings])

  /* Map bootstrap — client only; Leaflet touches `window` on import */
  useEffect(() => {
    let cancelled = false
    import('leaflet').then((L) => {
      if (cancelled || !hostRef.current) return
      const map = L.map(hostRef.current, {
        center: [center.lat, center.lon],
        zoom: 16,
        scrollWheelZoom: false,
        preferCanvas: true,
      })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map)
      mapRef.current = map
      // The container may still be mid-layout on first paint
      requestAnimationFrame(() => map.invalidateSize())
      setReady(true)
    })
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      trailLayerRef.current = null
      spotsLayerRef.current = null
    }
  }, [center.lat, center.lon])

  /* Rebuild the marker layers whenever the data or selection changes */
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    // import() resolves from the module cache after the first load
    import('leaflet').then((L) => {
      const map = mapRef.current
      if (cancelled || !map) return

      trailLayerRef.current?.remove()
      spotsLayerRef.current?.remove()

      // Trail: one small dot per placement ("put → reading → move")
      const trail = L.layerGroup().addTo(map)
      for (const r of readings) {
        const selected = r.deviceId === selectedDeviceId
        L.circleMarker([r.lat, r.lon], {
          radius: selected ? 3.5 : 2.5,
          weight: 0,
          fill: true,
          fillColor: TRAIL_COLOR,
          fillOpacity: selected ? 0.5 : 0.13,
          interactive: false,
        }).addTo(trail)
      }

      // Rings: latest reading per sampling spot, coloured by status
      const spots = L.layerGroup().addTo(map)
      for (const r of spotLatest) {
        const status = overallStatus(valuesOf(r))
        const selected = r.deviceId === selectedDeviceId
        const label = r.spot ?? `${r.lat.toFixed(4)}°N, ${r.lon.toFixed(4)}°E`
        L.circleMarker([r.lat, r.lon], {
          radius: selected ? 11 : 8,
          weight: 2,
          color: '#ffffff',
          fillColor: STATUS_COLOR[status.level],
          fillOpacity: 0.95,
        })
          .bindTooltip(escapeHtml(label), {
            direction: 'top',
            offset: [0, -6],
          })
          .bindPopup(popupHtml(r))
          .addTo(spots)
      }

      trailLayerRef.current = trail
      spotsLayerRef.current = spots

      if (!didFitRef.current && spotLatest.length > 0) {
        didFitRef.current = true
        map.fitBounds(
          L.latLngBounds(
            spotLatest.map((r) => [r.lat, r.lon] as [number, number]),
          ),
          { padding: [28, 28], maxZoom: 17 },
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [ready, readings, spotLatest, selectedDeviceId])

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-[400px] overflow-hidden rounded-xl border border-line">
        <div
          ref={hostRef}
          className="absolute inset-0 z-0"
          aria-label="OpenStreetMap of the study area with sampling spots"
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-sand/60 text-sm text-sea-ink-soft">
            Loading OpenStreetMap…
          </div>
        )}
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
        <span className="w-full text-center">
          Rings show the latest reading per sampling spot · small dots show
          every placement · map data ©{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap
          </a>{' '}
          contributors
        </span>
      </div>
    </div>
  )
}

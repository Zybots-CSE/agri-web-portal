import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { LayerGroup, Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  ScanSearch,
} from 'lucide-react'
import {
  SENSOR_PARAM_LIST,
  formatValue,
  overallStatus,
  statusForValue,
} from '#/lib/sensor-rules'
import type { SensorValues, StatusLevel } from '#/lib/sensor-rules'
import type { ReadingDTO } from '#/lib/server/queries'
import { formatDateTime } from '#/lib/format'
import { useSensorText } from '#/lib/i18n/sensor-text'
import type { SensorText } from '#/lib/i18n/sensor-text'
import { Trans, useLingui } from '@lingui/react/macro'
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

function spotLabel(r: ReadingDTO, tx: SensorText): string {
  return r.spot
    ? tx.text(r.spot)
    : `${r.lat.toFixed(4)}°N, ${r.lon.toFixed(4)}°E`
}

type PopupText = {
  tx: SensorText
  locale: string
  status: Record<StatusLevel, string>
}

function popupHtml(r: ReadingDTO, { tx, locale, status }: PopupText): string {
  const v = valuesOf(r)
  const overall = overallStatus(v)
  const label = spotLabel(r, tx)
  const statusText = status[overall.level]
  const rows = SENSOR_PARAM_LIST.map((p) => {
    const level = statusForValue(p, v[p.key]).level
    return `<tr>
      <td style="padding:1px 10px 1px 0;color:var(--sea-ink-soft)">${escapeHtml(tx.short(p))}</td>
      <td style="padding:1px 0;text-align:right;font-weight:700;color:${STATUS_COLOR[level]}">${formatValue(p, v[p.key])}${p.unit ? ` ${p.unit}` : ''}</td>
    </tr>`
  }).join('')
  return `
    <div style="min-width:190px">
      <div style="font-weight:800;font-size:12px;color:var(--sea-ink)">${escapeHtml(label)}</div>
      <div style="display:flex;align-items:center;gap:5px;margin:2px 0 7px;font-size:10px;color:var(--sea-ink-soft)">
        <span style="display:inline-block;width:7px;height:7px;border-radius:9999px;background:${STATUS_COLOR[overall.level]}"></span>
        ${escapeHtml(statusText)} · ${escapeHtml(r.deviceId)} · ${escapeHtml(formatDateTime(r.recordedAt, locale))}
      </div>
      <table style="font-size:11px;border-collapse:collapse;color:var(--sea-ink)">${rows}</table>
    </div>`
}

const MIN_ZOOM = 3
const MAX_ZOOM = 19
const PAN_STEP_PX = 120

function MapButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-8 items-center justify-center text-sea-ink transition-colors hover:bg-sand disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

const CONTROL_GROUP =
  'flex flex-col overflow-hidden rounded-lg border border-line bg-[var(--surface-strong)] shadow-sm backdrop-blur divide-y divide-line'

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
  const wrapperRef = useRef<HTMLDivElement>(null)
  const didFitRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(16)
  const [fullscreen, setFullscreen] = useState(false)
  const { t, i18n } = useLingui()
  const tx = useSensorText()
  const popupText = useMemo<PopupText>(
    () => ({
      tx,
      locale: i18n.locale,
      status: { ok: t`All parameters OK`, warn: t`Watch`, critical: t`Alert` },
    }),
    [tx, i18n, t],
  )

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
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        // Custom zoom buttons are rendered as a React overlay instead
        zoomControl: false,
        scrollWheelZoom: true,
        wheelPxPerZoomLevel: 90,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        doubleClickZoom: true,
        boxZoom: true,
        touchZoom: true,
        dragging: true,
        inertia: true,
        keyboard: true,
        keyboardPanDelta: PAN_STEP_PX,
        preferCanvas: true,
      })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: MAX_ZOOM,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map)
      L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map)
      map.on('zoomend', () => setZoom(map.getZoom()))
      setZoom(map.getZoom())
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
        const label = spotLabel(r, tx)
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
          .bindPopup(popupHtml(r, popupText))
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
  }, [ready, readings, spotLatest, selectedDeviceId, tx, popupText])

  /* Keep Leaflet's size in sync with fullscreen toggles */
  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === wrapperRef.current)
      requestAnimationFrame(() => mapRef.current?.invalidateSize())
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const zoomBy = (delta: number) => mapRef.current?.zoomIn(delta)
  const panBy = (x: number, y: number) => mapRef.current?.panBy([x, y])

  const fitSpots = () => {
    const map = mapRef.current
    if (!map) return
    if (spotLatest.length === 0) {
      map.setView([center.lat, center.lon], 16)
      return
    }
    map.fitBounds(
      spotLatest.map((r) => [r.lat, r.lon] as [number, number]),
      { padding: [28, 28], maxZoom: 17 },
    )
  }

  const recenter = () => mapRef.current?.setView([center.lat, center.lon], 16)

  const toggleFullscreen = () => {
    const el = wrapperRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen()
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={wrapperRef}
        className={cn(
          'relative overflow-hidden border border-line bg-sand',
          fullscreen ? 'h-full w-full' : 'h-[400px] rounded-xl',
        )}
      >
        <div
          ref={hostRef}
          className="absolute inset-0 z-0"
          aria-label={t`OpenStreetMap of the study area with sampling spots`}
        />
        {ready && (
          <>
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
              <div className={CONTROL_GROUP}>
                <MapButton
                  label={t`Zoom in`}
                  onClick={() => zoomBy(1)}
                  disabled={zoom >= MAX_ZOOM}
                >
                  <Plus className="size-4" />
                </MapButton>
                <div className="flex h-6 items-center justify-center text-[10px] font-semibold tabular-nums text-sea-ink-soft">
                  {zoom.toFixed(zoom % 1 === 0 ? 0 : 1)}
                </div>
                <MapButton
                  label={t`Zoom out`}
                  onClick={() => zoomBy(-1)}
                  disabled={zoom <= MIN_ZOOM}
                >
                  <Minus className="size-4" />
                </MapButton>
              </div>
              <div className={CONTROL_GROUP}>
                <MapButton label={t`Fit all sampling spots`} onClick={fitSpots}>
                  <ScanSearch className="size-4" />
                </MapButton>
                <MapButton label={t`Recenter on study area`} onClick={recenter}>
                  <Crosshair className="size-4" />
                </MapButton>
                <MapButton
                  label={fullscreen ? t`Exit fullscreen` : t`Fullscreen`}
                  onClick={toggleFullscreen}
                >
                  {fullscreen ? (
                    <Minimize2 className="size-4" />
                  ) : (
                    <Maximize2 className="size-4" />
                  )}
                </MapButton>
              </div>
            </div>

            <div className="absolute bottom-8 right-3 z-10 grid grid-cols-3 overflow-hidden rounded-lg border border-line bg-[var(--surface-strong)] shadow-sm backdrop-blur">
              <span />
              <MapButton
                label={t`Pan up`}
                onClick={() => panBy(0, -PAN_STEP_PX)}
              >
                <ChevronUp className="size-4" />
              </MapButton>
              <span />
              <MapButton
                label={t`Pan left`}
                onClick={() => panBy(-PAN_STEP_PX, 0)}
              >
                <ChevronLeft className="size-4" />
              </MapButton>
              <span />
              <MapButton
                label={t`Pan right`}
                onClick={() => panBy(PAN_STEP_PX, 0)}
              >
                <ChevronRight className="size-4" />
              </MapButton>
              <span />
              <MapButton
                label={t`Pan down`}
                onClick={() => panBy(0, PAN_STEP_PX)}
              >
                <ChevronDown className="size-4" />
              </MapButton>
              <span />
            </div>
          </>
        )}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-sand/60 text-sm text-sea-ink-soft">
            <Trans>Loading OpenStreetMap…</Trans>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-sea-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-full', STATUS_DOT.ok)} />{' '}
          <Trans>All parameters OK</Trans>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-full', STATUS_DOT.warn)} />{' '}
          <Trans>Watch</Trans>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-full', STATUS_DOT.critical)} />{' '}
          <Trans>Alert</Trans>
        </span>
        <span className="w-full text-center">
          <Trans>
            Drag to move · scroll, pinch or double-click to zoom · Shift-drag to
            zoom to an area · arrow keys pan when the map is focused
          </Trans>
        </span>
        <span className="w-full text-center">
          <Trans>
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
          </Trans>
        </span>
      </div>
    </div>
  )
}

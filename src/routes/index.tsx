import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { z } from 'zod'
import {
  RefreshCw,
  Radio,
  MapPin,
  DatabaseZap,
  TriangleAlert,
} from 'lucide-react'

import {
  getDeviceReadings,
  getDevices,
  getAllReadings,
  seedDemoData,
  simulateNextReading,
} from '#/lib/server/server-fns'
import {
  SENSOR_PARAM_LIST,
  overallStatus,
  statusForValue,
} from '#/lib/sensor-rules'
import type { ParamKey, SensorValues } from '#/lib/sensor-rules'
import { FARM_AREA } from '#/lib/sensor-sim'
import type { ReadingDTO } from '#/lib/server/queries'
import { formatDateTime } from '#/lib/format'
import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { SensorCard } from '#/components/dashboard/sensor-card'
import { TrendChart } from '#/components/dashboard/trend-chart'
import { OsmMap } from '#/components/dashboard/osm-map'
import { StatusBadge, STATUS_DOT } from '#/components/dashboard/status-badge'

/* ------------------------------- data wiring ------------------------------ */

const devicesOptions = queryOptions({
  queryKey: ['devices'],
  queryFn: () => getDevices(),
  refetchInterval: 30_000,
})

const readingsOptions = (deviceId: string) =>
  queryOptions({
    queryKey: ['readings', deviceId],
    queryFn: () => getDeviceReadings({ data: { deviceId, hours: 24 * 7 } }),
    refetchInterval: 30_000,
  })

const allReadingsOptions = queryOptions({
  queryKey: ['readings', '__all__'],
  queryFn: () => getAllReadings({ data: {} }),
  refetchInterval: 30_000,
})

const searchSchema = z.object({ device: z.string().optional() })

export const Route = createFileRoute('/')({
  validateSearch: searchSchema.parse,
  loaderDeps: ({ search }) => ({ device: search.device }),
  loader: async ({ context: { queryClient }, deps }) => {
    const devices = await queryClient.ensureQueryData(devicesOptions)
    await queryClient.ensureQueryData(allReadingsOptions)
    const initialId =
      deps.device && devices.some((d) => d.id === deps.device)
        ? deps.device
        : devices[0]?.id
    if (initialId) {
      await queryClient.ensureQueryData(readingsOptions(initialId))
    }
  },
  component: DashboardPage,
})

/* --------------------------------- helpers -------------------------------- */

function valuesOf(reading: ReadingDTO): SensorValues {
  return {
    ph: reading.ph,
    ec: reading.ec,
    moisture: reading.moisture,
    temperature: reading.temperature,
    nitrogen: reading.nitrogen,
    phosphorus: reading.phosphorus,
    potassium: reading.potassium,
  }
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-(--chip-line) bg-(--chip-bg) px-2.5 py-1 text-xs text-sea-ink-soft">
      <span className="font-semibold text-sea-ink/80">{label}</span>
      {value}
    </span>
  )
}

const RANGES = [
  { label: '24h', hours: 24 },
  { label: '3d', hours: 72 },
  { label: '7d', hours: 168 },
]

/* ---------------------------------- page ---------------------------------- */

function DashboardPage() {
  const queryClient = useQueryClient()
  const { data: devices } = useSuspenseQuery(devicesOptions)
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/' })

  const selectedDevice = useMemo(() => {
    if (search.device) {
      const found = devices.find((d) => d.id === search.device)
      if (found) return found
    }
    return devices[0]
  }, [devices, search.device])

  const readingsQuery = useQuery({
    ...readingsOptions(selectedDevice?.id ?? '__none__'),
    enabled: !!selectedDevice,
  })
  const readings = readingsQuery.data ?? []
  const { data: allReadings } = useSuspenseQuery(allReadingsOptions)

  const [paramKey, setParamKey] = useState<ParamKey>('ph')
  const [rangeHours, setRangeHours] = useState(24)
  const activeParam = SENSOR_PARAM_LIST.find((p) => p.key === paramKey)!

  const latest = selectedDevice?.latestReading ?? null
  const overall = latest ? overallStatus(valuesOf(latest)) : null

  const simulateMutation = useMutation({
    mutationFn: () =>
      simulateNextReading({ data: { deviceId: selectedDevice!.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      queryClient.invalidateQueries({ queryKey: ['readings'] })
    },
  })

  const seedMutation = useMutation({
    mutationFn: () => seedDemoData(),
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const chartPoints = useMemo(() => {
    const cutoff = Date.now() - rangeHours * 3600_000
    return readings
      .filter((r) => Date.parse(r.recordedAt) >= cutoff)
      .map((r) => ({
        t: Date.parse(r.recordedAt),
        v: r[activeParam.key],
        label: r.spot ?? undefined,
      }))
  }, [readings, rangeHours, activeParam])

  /* ------------------------------ empty state ----------------------------- */

  if (devices.length === 0) {
    return (
      <div className="page-wrap flex min-h-[70vh] flex-col items-center justify-center py-16">
        <div className="island-shell flex max-w-lg flex-col items-center gap-4 rounded-2xl px-8 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-lagoon/15 text-lagoon-deep">
            <DatabaseZap className="size-7" />
          </span>
          <h1 className="display-title text-2xl font-bold">
            No probes registered yet
          </h1>
          <p className="text-sm text-sea-ink-soft">
            Seed the demo fleet — three roving probes sampling eight plots of
            the {FARM_AREA.name} with a week of simulated readings — or point
            your hardware at <code>POST /api/readings</code>.
          </p>
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            <RefreshCw
              className={cn('size-4', seedMutation.isPending && 'animate-spin')}
            />
            {seedMutation.isPending
              ? 'Seeding demo fleet…'
              : 'Generate demo fleet'}
          </Button>
        </div>
      </div>
    )
  }

  /* -------------------------------- main view ----------------------------- */

  return (
    <div className="page-wrap flex flex-col gap-6 py-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="island-kicker">Agri Web Portal · Soil Intelligence</p>
          <h1 className="display-title mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Soil Sensor Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-sea-ink-soft">
            Live soil data from a single local area — the {FARM_AREA.name},{' '}
            {FARM_AREA.district} ({FARM_AREA.region}). Roving probes are placed
            at a spot, read, then moved on; every reading is geo-tagged,
            hard-rule flagged and chart-ready.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-full border border-line bg-(--chip-bg) px-3 py-1.5 text-xs font-medium text-sea-ink-soft">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Live · refresh 30s
          </span>
          {selectedDevice && (
            <Button
              onClick={() => simulateMutation.mutate()}
              disabled={simulateMutation.isPending || seedMutation.isPending}
            >
              <RefreshCw
                className={cn(
                  'size-4',
                  simulateMutation.isPending && 'animate-spin',
                )}
              />
              {simulateMutation.isPending ? 'Simulating…' : 'Simulate reading'}
            </Button>
          )}
        </div>
      </header>

      {/* Device context bar */}
      <section className="island-shell flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Select
            value={selectedDevice?.id}
            onValueChange={(id) => navigate({ search: { device: id } })}
          >
            <SelectTrigger className="w-72" aria-label="Select device">
              <SelectValue placeholder="Select a device" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        STATUS_DOT[
                          d.latestReading
                            ? overallStatus(valuesOf(d.latestReading)).level
                            : 'ok'
                        ],
                      )}
                    />
                    {d.id} — {d.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {overall && (
            <StatusBadge
              level={overall.level}
              label={
                overall.level === 'ok'
                  ? 'All OK'
                  : overall.level === 'warn'
                    ? 'Watch'
                    : 'Alert'
              }
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedDevice?.district && (
            <Chip label="District" value={selectedDevice.district} />
          )}
          {selectedDevice?.region && (
            <Chip label="Region" value={selectedDevice.region} />
          )}
          {selectedDevice?.zone && (
            <Chip label="Zone" value={selectedDevice.zone} />
          )}
          {selectedDevice?.crop && (
            <Chip label="Crop" value={selectedDevice.crop} />
          )}
          {latest && (
            <Chip
              label="Current spot"
              value={
                latest.spot ??
                `${latest.lat.toFixed(4)}°N, ${latest.lon.toFixed(4)}°E`
              }
            />
          )}
          {selectedDevice && (
            <Chip
              label="Readings"
              value={String(selectedDevice.readingCount)}
            />
          )}
          {latest && (
            <Chip
              label="Last reading"
              value={formatDateTime(latest.recordedAt)}
            />
          )}
        </div>

        {overall && overall.flags.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-50/70 px-3 py-2 text-xs dark:border-amber-800/60 dark:bg-amber-950/40">
            <TriangleAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-amber-800 dark:text-amber-200">
              Hard-rule flags:
            </span>
            {overall.flags.map((f) => (
              <span
                key={f.param.key}
                className="text-amber-800 dark:text-amber-200"
              >
                <b>{f.param.short}</b> — {f.label}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Live sensor cards */}
      <section aria-label="Latest sensor readings">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {SENSOR_PARAM_LIST.map((param) => (
            <SensorCard
              key={param.key}
              param={param}
              value={latest ? latest[param.key] : null}
              spark={readings.slice(-48).map((r) => r[param.key])}
              recordedAt={latest?.recordedAt}
            />
          ))}
        </div>
      </section>

      {/* Charts + map */}
      <section className="grid gap-6 lg:grid-cols-5">
        {/* Trend chart */}
        <div className="island-shell flex flex-col gap-4 rounded-2xl p-5 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="island-kicker">History</p>
              <h2 className="text-lg font-bold">
                {activeParam.label}
                {activeParam.unit && (
                  <span className="ml-1 text-sm font-medium text-sea-ink-soft">
                    ({activeParam.unit})
                  </span>
                )}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-line bg-(--chip-bg) p-0.5">
                {SENSOR_PARAM_LIST.map((p) => {
                  const status = latest
                    ? statusForValue(p, latest[p.key])
                    : null
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setParamKey(p.key)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                        p.key === paramKey
                          ? 'bg-lagoon-deep text-white'
                          : 'text-sea-ink-soft hover:bg-accent hover:text-sea-ink',
                      )}
                      title={`${p.label} — target ${p.targetLabel}`}
                    >
                      {status && (
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            STATUS_DOT[status.level],
                          )}
                        />
                      )}
                      {p.short}
                    </button>
                  )
                })}
              </div>
              <div className="flex rounded-lg border border-line bg-(--chip-bg) p-0.5">
                {RANGES.map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => setRangeHours(r.hours)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                      r.hours === rangeHours
                        ? 'bg-sea-ink text-white'
                        : 'text-sea-ink-soft hover:bg-accent hover:text-sea-ink',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {readings.length === 0 && !readingsQuery.isLoading ? (
            <div className="flex h-56 items-center justify-center text-sm text-sea-ink-soft">
              No readings yet for this device — simulate one to start the
              timeline.
            </div>
          ) : (
            <TrendChart param={activeParam} points={chartPoints} />
          )}
        </div>

        {/* Map */}
        <div className="island-shell flex flex-col gap-4 rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="island-kicker">{FARM_AREA.name}</p>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <MapPin className="size-4 text-lagoon-deep" />
                Sampling spot map
              </h2>
            </div>
            <span className="flex items-center gap-1 text-xs text-sea-ink-soft">
              <Radio className="size-3.5" />
              {devices.length} roving probes
            </span>
          </div>
          <OsmMap
            center={FARM_AREA.center}
            readings={allReadings}
            selectedDeviceId={selectedDevice?.id}
          />
        </div>
      </section>

      {/* Ingest API reference */}
      <details className="island-shell group rounded-2xl p-5">
        <summary className="cursor-pointer select-none text-sm font-bold text-sea-ink">
          Device ingest API — pushing readings from your probe
          <span className="ml-2 font-normal text-sea-ink-soft group-open:hidden">
            (click to expand)
          </span>
        </summary>
        <div className="mt-4 flex flex-col gap-4 text-sm text-sea-ink-soft">
          <p>
            The field unit (ESP32/Arduino with the RS485 NPK probe, FDR moisture
            sensor, DS18B20 thermistor, pH/EC electrodes and NEO GPS) POSTs one
            JSON reading per placement — the probe is put at a spot, read, then
            moved somewhere else, so every reading carries its own GPS fix and
            an optional spot label. Values outside the SRS sensor ranges are
            rejected with <code>422</code> and an issue list — the Step 1
            hard-rule filter. Unknown probes are auto-registered on first sight;
            no location is stored on the probe itself.
          </p>
          <pre className="overflow-x-auto rounded-xl border border-line bg-[#1d2e45] p-4 text-xs leading-relaxed text-[#e8efff]">
            {`curl -X POST http://localhost:3030/api/readings \\
  -H "Content-Type: application/json" \\
  -d '{
    "deviceId": "PRB-001",
    "ph": 6.42,
    "ec": 1.24,
    "moisture": 28.5,
    "temperature": 27.3,
    "nitrogen": 65,
    "phosphorus": 18,
    "potassium": 120,
    "lat": 8.3525,
    "lon": 80.4631,
    "spot": "Paddy Block B",
    "recordedAt": "2026-10-13T09:30:00+05:30"
  }'`}
          </pre>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-line text-left text-sea-ink">
                  <th className="py-2 pr-4 font-bold">Field</th>
                  <th className="py-2 pr-4 font-bold">Accepted range</th>
                  <th className="py-2 font-bold">Unit / note</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    'deviceId',
                    '2–40 chars',
                    'letters, digits, dot, dash, underscore',
                  ],
                  ['ph', '3.0 – 9.0', 'pH scale (±0.1 accuracy)'],
                  ['ec', '0.0 – 5.0', 'dS/m'],
                  ['moisture', '0 – 100', '% VWC'],
                  ['temperature', '10 – 50', '°C'],
                  ['nitrogen / phosphorus / potassium', '0 – 1999', 'mg/kg'],
                  [
                    'lat / lon',
                    '5.9–9.9 / 79.6–81.9',
                    'decimal degrees — GPS fix of this placement',
                  ],
                  [
                    'spot',
                    '1–80 chars',
                    'optional sampling-spot label, e.g. "Paddy Block B"',
                  ],
                  [
                    'recordedAt',
                    'ISO-8601',
                    'optional — defaults to server time',
                  ],
                ].map(([field, range, unit]) => (
                  <tr key={field} className="border-b border-line/60">
                    <td className="py-2 pr-4 font-mono text-[11px] text-sea-ink">
                      {field}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{range}</td>
                    <td className="py-2">{unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Also available:{' '}
            <code>GET /api/readings?deviceId=…&amp;hours=…</code>,{' '}
            <code>GET /api/devices</code>, and <code>POST /api/devices</code> to
            pre-register a probe with district / NRMC region / crop metadata
            (probes carry no coordinates — GPS travels with each reading).
          </p>
        </div>
      </details>
    </div>
  )
}

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
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
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
import { TodoList } from '#/components/dashboard/todo-list'
import { useSensorText } from '#/lib/i18n/sensor-text'

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
    <span className="inline-flex items-center gap-2 rounded-full border border-(--chip-line) bg-(--chip-bg) px-3 py-1.5 text-xs text-sea-ink-soft">
      <span className="font-semibold text-sea-ink/80">{label}</span>
      {value}
    </span>
  )
}

const RANGES = [
  { label: msg`24h`, hours: 24 },
  { label: msg`3d`, hours: 72 },
  { label: msg`7d`, hours: 168 },
]

/** Sample payload for the ingest API docs — kept in English (it is code) */
const CURL_EXAMPLE = `curl -X POST http://localhost:3030/api/readings \\
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
  }'`

const API_FIELDS = [
  {
    field: 'deviceId',
    range: msg`2–40 chars`,
    note: msg`letters, digits, dot, dash, underscore`,
  },
  { field: 'ph', range: '3.0 – 9.0', note: msg`pH scale (±0.1 accuracy)` },
  { field: 'ec', range: '0.0 – 5.0', note: 'dS/m' },
  { field: 'moisture', range: '0 – 100', note: '% VWC' },
  { field: 'temperature', range: '10 – 50', note: '°C' },
  {
    field: 'nitrogen / phosphorus / potassium',
    range: '0 – 1999',
    note: 'mg/kg',
  },
  {
    field: 'lat / lon',
    range: '5.9–9.9 / 79.6–81.9',
    note: msg`decimal degrees — GPS fix of this placement`,
  },
  {
    field: 'spot',
    range: msg`1–80 chars`,
    note: msg`optional sampling-spot label, e.g. "Paddy Block B"`,
  },
  {
    field: 'recordedAt',
    range: 'ISO-8601',
    note: msg`optional — defaults to server time`,
  },
]

/* ---------------------------------- page ---------------------------------- */

function DashboardPage() {
  const queryClient = useQueryClient()
  const { data: devices } = useSuspenseQuery(devicesOptions)
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const { t, i18n } = useLingui()
  const tx = useSensorText()
  const farmName = tx.text(FARM_AREA.name)
  const district = tx.text(FARM_AREA.district)
  const region = FARM_AREA.region
  const probeCount = devices.length

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
            <Trans>No probes registered yet</Trans>
          </h1>
          <p className="text-sm text-sea-ink-soft">
            <Trans>
              Seed the demo fleet — three roving probes sampling eight plots of
              the {farmName} with a week of simulated readings — or point your
              hardware at <code>POST /api/readings</code>.
            </Trans>
          </p>
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            <RefreshCw
              className={cn('size-4', seedMutation.isPending && 'animate-spin')}
            />
            {seedMutation.isPending
              ? t`Seeding demo fleet…`
              : t`Generate demo fleet`}
          </Button>
        </div>
      </div>
    )
  }

  /* -------------------------------- main view ----------------------------- */

  return (
    <div className="page-wrap flex flex-col gap-8 py-10">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="island-kicker">
            <Trans>Agri Web Portal · Soil Intelligence</Trans>
          </p>
          <h1 className="display-title mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            <Trans>Soil Sensor Dashboard</Trans>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-sea-ink-soft">
            <Trans>
              Live soil data from a single local area — the {farmName},{' '}
              {district} ({region}). Roving probes are placed at a spot, read,
              then moved on; every reading is geo-tagged, hard-rule flagged and
              chart-ready.
            </Trans>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 rounded-full border border-line bg-(--chip-bg) px-3 py-1.5 text-xs font-medium text-sea-ink-soft">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <Trans>Live · refresh 30s</Trans>
          </span>
          <Button
            variant="outline"
            onClick={() => {
              if (
                window.confirm(
                  t`Wipe all probes and readings and regenerate a week of demo data?`,
                )
              ) {
                seedMutation.mutate()
              }
            }}
            disabled={seedMutation.isPending || simulateMutation.isPending}
          >
            <DatabaseZap
              className={cn(
                'size-4',
                seedMutation.isPending && 'animate-pulse',
              )}
            />
            {seedMutation.isPending
              ? t`Regenerating…`
              : t`Regenerate demo data`}
          </Button>
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
              {simulateMutation.isPending
                ? t`Simulating…`
                : t`Simulate reading`}
            </Button>
          )}
        </div>
      </header>

      {/* Farmer to-do list */}
      <TodoList readings={allReadings} />

      {/* Device context bar */}
      <section className="island-shell flex flex-wrap items-center gap-4 rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <Select
            value={selectedDevice?.id}
            onValueChange={(id) => navigate({ search: { device: id } })}
          >
            <SelectTrigger className="w-72" aria-label={t`Select device`}>
              <SelectValue placeholder={t`Select a device`} />
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
                    {d.id} — {tx.text(d.name)}
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
                  ? t`All OK`
                  : overall.level === 'warn'
                    ? t`Watch`
                    : t`Alert`
              }
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedDevice?.district && (
            <Chip
              label={t`District`}
              value={tx.text(selectedDevice.district)}
            />
          )}
          {selectedDevice?.region && (
            <Chip label={t`Region`} value={selectedDevice.region} />
          )}
          {selectedDevice?.zone && (
            <Chip label={t`Zone`} value={tx.text(selectedDevice.zone)} />
          )}
          {selectedDevice?.crop && (
            <Chip label={t`Crop`} value={tx.text(selectedDevice.crop)} />
          )}
          {latest && (
            <Chip
              label={t`Current spot`}
              value={
                latest.spot
                  ? tx.text(latest.spot)
                  : `${latest.lat.toFixed(4)}°N, ${latest.lon.toFixed(4)}°E`
              }
            />
          )}
          {selectedDevice && (
            <Chip
              label={t`Readings`}
              value={String(selectedDevice.readingCount)}
            />
          )}
          {latest && (
            <Chip
              label={t`Last reading`}
              value={formatDateTime(latest.recordedAt, i18n.locale)}
            />
          )}
        </div>

        {overall && overall.flags.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-50/70 px-3 py-2 text-xs dark:border-amber-800/60 dark:bg-amber-950/40">
            <TriangleAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-amber-800 dark:text-amber-200">
              <Trans>Hard-rule flags:</Trans>
            </span>
            {overall.flags.map((f) => (
              <span
                key={f.param.key}
                className="text-amber-800 dark:text-amber-200"
              >
                <b>{tx.short(f.param)}</b> — {tx.text(f.label)}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Live sensor cards */}
      <section aria-label={t`Latest sensor readings`}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="island-shell flex flex-col gap-5 rounded-2xl p-6 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="island-kicker">
                <Trans>History</Trans>
              </p>
              <h2 className="text-lg font-bold">
                {tx.label(activeParam)}
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
                  const paramLabel = tx.label(p)
                  const target = p.targetLabel
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
                      title={t`${paramLabel} — target ${target}`}
                    >
                      {status && (
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            STATUS_DOT[status.level],
                          )}
                        />
                      )}
                      {tx.short(p)}
                    </button>
                  )
                })}
              </div>
              <div className="flex rounded-lg border border-line bg-(--chip-bg) p-0.5">
                {RANGES.map((r) => (
                  <button
                    key={r.hours}
                    type="button"
                    onClick={() => setRangeHours(r.hours)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                      r.hours === rangeHours
                        ? 'bg-sea-ink text-white'
                        : 'text-sea-ink-soft hover:bg-accent hover:text-sea-ink',
                    )}
                  >
                    {i18n._(r.label)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {readings.length === 0 && !readingsQuery.isLoading ? (
            <div className="flex h-56 items-center justify-center text-sm text-sea-ink-soft">
              <Trans>
                No readings yet for this device — simulate one to start the
                timeline.
              </Trans>
            </div>
          ) : (
            <TrendChart param={activeParam} points={chartPoints} />
          )}
        </div>

        {/* Map */}
        <div className="island-shell flex flex-col gap-5 rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="island-kicker">{farmName}</p>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <MapPin className="size-4 text-lagoon-deep" />
                <Trans>Sampling spot map</Trans>
              </h2>
            </div>
            <span className="flex items-center gap-1 text-xs text-sea-ink-soft">
              <Radio className="size-3.5" />
              <Plural
                value={probeCount}
                one="# roving probe"
                other="# roving probes"
              />
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
      <details className="island-shell group rounded-2xl p-6">
        <summary className="cursor-pointer select-none text-sm font-bold text-sea-ink">
          <Trans>Device ingest API — pushing readings from your probe</Trans>
          <span className="ml-2 font-normal text-sea-ink-soft group-open:hidden">
            <Trans>(click to expand)</Trans>
          </span>
        </summary>
        <div className="mt-4 flex flex-col gap-4 text-sm text-sea-ink-soft">
          <p>
            <Trans>
              The field unit (ESP32/Arduino with the RS485 NPK probe, FDR
              moisture sensor, DS18B20 thermistor, pH/EC electrodes and NEO GPS)
              POSTs one JSON reading per placement — the probe is put at a spot,
              read, then moved somewhere else, so every reading carries its own
              GPS fix and an optional spot label. Values outside the SRS sensor
              ranges are rejected with <code>422</code> and an issue list — the
              Step 1 hard-rule filter. Unknown probes are auto-registered on
              first sight; no location is stored on the probe itself.
            </Trans>
          </p>
          <pre className="overflow-x-auto rounded-xl border border-line bg-[#1d2e45] p-4 text-xs leading-relaxed text-[#e8efff]">
            {CURL_EXAMPLE}
          </pre>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-line text-left text-sea-ink">
                  <th className="py-2 pr-4 font-bold">
                    <Trans>Field</Trans>
                  </th>
                  <th className="py-2 pr-4 font-bold">
                    <Trans>Accepted range</Trans>
                  </th>
                  <th className="py-2 font-bold">
                    <Trans>Unit / note</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {API_FIELDS.map(({ field, range, note }) => (
                  <tr key={field} className="border-b border-line/60">
                    <td className="py-2 pr-4 font-mono text-[11px] text-sea-ink">
                      {field}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {typeof range === 'string' ? range : i18n._(range)}
                    </td>
                    <td className="py-2">
                      {typeof note === 'string' ? note : i18n._(note)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <Trans>
              Also available:{' '}
              <code>GET /api/readings?deviceId=…&amp;hours=…</code>,{' '}
              <code>GET /api/devices</code>, and <code>POST /api/devices</code>{' '}
              to pre-register a probe with district / NRMC region / crop
              metadata (probes carry no coordinates — GPS travels with each
              reading).
            </Trans>
          </p>
        </div>
      </details>
    </div>
  )
}

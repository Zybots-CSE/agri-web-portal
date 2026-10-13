import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '#/db'
import { devices, readings } from '#/db/schema'
import type {
  DeviceRegistration,
  ReadingIngest,
  SensorValues,
} from '#/lib/sensor-rules'
import {
  DEMO_PROBE_PROFILES,
  FARM_AREA,
  probeRouteAt,
  simulatePlotValues,
  spotLocation,
  spotProfileFromLatest,
} from '#/lib/sensor-sim'

/* --------------------------------- DTOs ---------------------------------- */

export type ReadingDTO = {
  id: number
  deviceId: string
  recordedAt: string // ISO-8601
  ph: number
  ec: number
  moisture: number
  temperature: number
  nitrogen: number
  phosphorus: number
  potassium: number
  /** GPS fix of this placement */
  lat: number
  lon: number
  /** Sampling-spot label, e.g. "Paddy Block B" */
  spot: string | null
}

export type DeviceDTO = {
  id: string
  name: string
  district: string | null
  region: string | null
  zone: string | null
  crop: string | null
  readingCount: number
  latestReading: ReadingDTO | null
}

type ReadingRow = typeof readings.$inferSelect
type DeviceRow = typeof devices.$inferSelect

function toReadingDTO(row: ReadingRow): ReadingDTO {
  return {
    id: row.id,
    deviceId: row.deviceId,
    recordedAt: row.recordedAt.toISOString(),
    ph: row.ph,
    ec: row.ec,
    moisture: row.moisture,
    temperature: row.temperature,
    nitrogen: row.nitrogen,
    phosphorus: row.phosphorus,
    potassium: row.potassium,
    lat: row.lat,
    lon: row.lon,
    spot: row.spot,
  }
}

function toDeviceDTO(
  row: DeviceRow,
  count: number,
  latest: ReadingRow | null,
): DeviceDTO {
  return {
    id: row.id,
    name: row.name,
    district: row.district,
    region: row.region,
    zone: row.zone,
    crop: row.crop,
    readingCount: count,
    latestReading: latest ? toReadingDTO(latest) : null,
  }
}

function valuesOfRow(row: ReadingRow): SensorValues {
  return {
    ph: row.ph,
    ec: row.ec,
    moisture: row.moisture,
    temperature: row.temperature,
    nitrogen: row.nitrogen,
    phosphorus: row.phosphorus,
    potassium: row.potassium,
  }
}

/* -------------------------------- Queries --------------------------------- */

/** Every device with its reading count and latest reading (for the dashboard + GET /api/devices) */
export async function listDevices(): Promise<DeviceDTO[]> {
  const deviceRows = await db.select().from(devices).orderBy(devices.id)
  if (deviceRows.length === 0) return []

  const counts = await db
    .select({ deviceId: readings.deviceId, n: sql<number>`count(*)` })
    .from(readings)
    .groupBy(readings.deviceId)

  const countMap = new Map(counts.map((c) => [c.deviceId, c.n]))

  const result: DeviceDTO[] = []
  for (const row of deviceRows) {
    const [latest] = await db
      .select()
      .from(readings)
      .where(eq(readings.deviceId, row.id))
      .orderBy(desc(readings.recordedAt), desc(readings.id))
      .limit(1)
    result.push(toDeviceDTO(row, countMap.get(row.id) ?? 0, latest ?? null))
  }
  return result
}

export async function getDevice(deviceId: string): Promise<DeviceDTO | null> {
  const [row] = await db
    .select()
    .from(devices)
    .where(eq(devices.id, deviceId))
    .limit(1)
  if (!row) return null
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(readings)
    .where(eq(readings.deviceId, deviceId))
  const [latest] = await db
    .select()
    .from(readings)
    .where(eq(readings.deviceId, deviceId))
    .orderBy(desc(readings.recordedAt), desc(readings.id))
    .limit(1)
  return toDeviceDTO(row, countRow?.n ?? 0, latest ?? null)
}

/**
 * Readings for one device over the last `hours`, oldest first (chart ready).
 * Pass `deviceId: undefined` to get the latest readings across all devices.
 */
export async function listReadings(
  deviceId: string | undefined,
  hours = 24 * 7,
): Promise<ReadingDTO[]> {
  const since = new Date(Date.now() - hours * 3600_000)
  if (deviceId) {
    const rows = await db
      .select()
      .from(readings)
      .where(
        and(eq(readings.deviceId, deviceId), gte(readings.recordedAt, since)),
      )
      .orderBy(readings.recordedAt)
      .limit(2000)
    return rows.map(toReadingDTO)
  }
  const rows = await db
    .select()
    .from(readings)
    .where(gte(readings.recordedAt, since))
    .orderBy(desc(readings.recordedAt))
    .limit(500)
  return rows.map(toReadingDTO)
}

/**
 * All readings across every probe over the last `hours`, oldest first —
 * the map layer showing every placement the probes have made.
 */
export async function listAllReadings(hours = 24 * 7): Promise<ReadingDTO[]> {
  const since = new Date(Date.now() - hours * 3600_000)
  const rows = await db
    .select()
    .from(readings)
    .where(gte(readings.recordedAt, since))
    .orderBy(readings.recordedAt)
    .limit(3000)
  return rows.map(toReadingDTO)
}

/* --------------------------------- Writes --------------------------------- */

/** POST /api/readings — hard-rule-validated ingest; auto-registers unknown devices */
export async function ingestReading(
  input: ReadingIngest,
): Promise<{ reading: ReadingDTO; deviceCreated: boolean }> {
  const existing = await db
    .select()
    .from(devices)
    .where(eq(devices.id, input.deviceId))
    .limit(1)
  let deviceCreated = false
  if (existing.length === 0) {
    // Probes are mobile — nothing location-ish is stored on the device row.
    await db.insert(devices).values({
      id: input.deviceId,
      name: input.deviceName ?? input.deviceId,
      district: input.district ?? null,
      region: input.region ?? null,
      zone: input.zone ?? null,
      crop: input.crop ?? null,
    })
    deviceCreated = true
  }

  const recordedAt = input.recordedAt ? new Date(input.recordedAt) : new Date()
  const [row] = await db
    .insert(readings)
    .values({
      deviceId: input.deviceId,
      ph: input.ph,
      ec: input.ec,
      moisture: input.moisture,
      temperature: input.temperature,
      nitrogen: input.nitrogen,
      phosphorus: input.phosphorus,
      potassium: input.potassium,
      lat: input.lat,
      lon: input.lon,
      spot: input.spot ?? null,
      recordedAt,
    })
    .returning()
  return { reading: toReadingDTO(row!), deviceCreated }
}

/** POST /api/devices — register a probe before its first upload */
export async function registerDevice(
  input: DeviceRegistration,
): Promise<DeviceDTO> {
  const existing = await db
    .select()
    .from(devices)
    .where(eq(devices.id, input.id))
    .limit(1)
  const values = {
    id: input.id,
    name: input.name,
    district: input.district ?? null,
    region: input.region ?? null,
    zone: input.zone ?? null,
    crop: input.crop ?? null,
  }
  if (existing.length > 0) {
    await db.update(devices).set(values).where(eq(devices.id, input.id))
  } else {
    await db.insert(devices).values(values)
  }
  return (await getDevice(input.id))!
}

/**
 * "Simulate next reading" — walk the probe to its next placement on the
 * deterministic route and store the reading. Used by the dashboard demo
 * button; continues the same timeline as the seeded history.
 */
export async function simulateNextReading(
  deviceId: string,
): Promise<ReadingDTO> {
  const [device] = await db
    .select()
    .from(devices)
    .where(eq(devices.id, deviceId))
    .limit(1)
  if (!device) throw new Error(`Unknown device: ${deviceId}`)

  const [latest] = await db
    .select()
    .from(readings)
    .where(eq(readings.deviceId, deviceId))
    .orderBy(desc(readings.recordedAt), desc(readings.id))
    .limit(1)

  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(readings)
    .where(eq(readings.deviceId, deviceId))
  // The reading index drives the probe's walk across its route.
  const index = Number(countRow?.n ?? 0)

  const stepMs = 30 * 60_000
  // Backfill after an offline gap, but never march into the future on
  // repeated clicks — the reading is always "now" at the latest.
  const at =
    latest && latest.recordedAt.getTime() + stepMs < Date.now()
      ? new Date(latest.recordedAt.getTime() + stepMs)
      : new Date()

  let values: SensorValues
  let lat: number
  let lon: number
  let spot: string | null

  const probe = DEMO_PROBE_PROFILES.find((p) => p.id === deviceId)
  if (probe) {
    const plot = probeRouteAt(probe, index)
    values = simulatePlotValues(plot, probe.id, at)
    const location = spotLocation(plot, probe.id, index)
    lat = location.lat
    lon = location.lon
    spot = plot.name
  } else {
    // Ad-hoc probe registered through the API: rove around its last
    // known position with bands centred on its last reading.
    const synth = spotProfileFromLatest(
      device,
      latest
        ? {
            ...valuesOfRow(latest),
            lat: latest.lat,
            lon: latest.lon,
            spot: latest.spot,
          }
        : null,
      index,
    )
    values = simulatePlotValues(synth.plot, device.id, at)
    lat = synth.plot.lat
    lon = synth.plot.lon
    spot = synth.spotName
  }

  const [row] = await db
    .insert(readings)
    .values({
      deviceId,
      ...values,
      lat,
      lon,
      spot,
      recordedAt: at,
    })
    .returning()
  return toReadingDTO(row!)
}

/* ---------------------------------- Seed ----------------------------------- */

export const SEED_HISTORY_HOURS = 24 * 7
const SEED_STEP_MIN = 30

/**
 * Wipe and regenerate the demo fleet: three roving probes walking the
 * eight plots of the demo farm, 7 days of 30-min readings each.
 */
export async function seedDemoData(): Promise<{
  devices: number
  readings: number
}> {
  await db.delete(readings)
  await db.delete(devices)

  const stepMs = SEED_STEP_MIN * 60_000
  const now = Date.now()
  // Half a step back so "Simulate reading" (latest + 30 min, clamped to
  // now) never collides with the seeded timestamps.
  const start = now - SEED_HISTORY_HOURS * 3600_000 - stepMs / 2
  const count = Math.floor((now - start) / stepMs) + 1

  let total = 0
  for (const probe of DEMO_PROBE_PROFILES) {
    await db.insert(devices).values({
      id: probe.id,
      name: probe.name,
      district: FARM_AREA.district,
      region: FARM_AREA.region,
      zone: FARM_AREA.zone,
      crop: null,
    })
    const rows = []
    for (let i = 0; i < count; i++) {
      const plot = probeRouteAt(probe, i)
      const at = new Date(start + i * stepMs)
      const location = spotLocation(plot, probe.id, i)
      rows.push({
        deviceId: probe.id,
        ...simulatePlotValues(plot, probe.id, at),
        lat: location.lat,
        lon: location.lon,
        spot: plot.name,
        recordedAt: at,
      })
    }
    await db.insert(readings).values(rows)
    total += rows.length
  }
  return { devices: DEMO_PROBE_PROFILES.length, readings: total }
}

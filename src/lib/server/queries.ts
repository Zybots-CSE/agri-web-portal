import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '#/db'
import { devices, readings } from '#/db/schema'
import type { DeviceRegistration, ReadingIngest } from '#/lib/sensor-rules'
import {
  DEMO_DEVICE_PROFILES,
  profileFromLatest,
  simulateReadingValues,
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
  lat: number
  lon: number
}

export type DeviceDTO = {
  id: string
  name: string
  district: string | null
  region: string | null
  zone: string | null
  crop: string | null
  lat: number
  lon: number
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
    lat: row.lat,
    lon: row.lon,
    readingCount: count,
    latestReading: latest ? toReadingDTO(latest) : null,
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
    await db.insert(devices).values({
      id: input.deviceId,
      name: input.deviceName ?? input.deviceId,
      district: input.district ?? null,
      region: input.region ?? null,
      zone: input.zone ?? null,
      crop: input.crop ?? null,
      lat: input.lat,
      lon: input.lon,
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
    lat: input.lat,
    lon: input.lon,
  }
  if (existing.length > 0) {
    await db.update(devices).set(values).where(eq(devices.id, input.id))
  } else {
    await db.insert(devices).values(values)
  }
  return (await getDevice(input.id))!
}

/**
 * "Simulate next reading" — generate the next value on the device's
 * deterministic timeline and store it. Used by the dashboard demo button.
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

  const stepMs = 30 * 60_000
  // Backfill after an offline gap, but never march into the future on
  // repeated clicks — the reading is always "now" at the latest.
  const at =
    latest && latest.recordedAt.getTime() + stepMs < Date.now()
      ? new Date(latest.recordedAt.getTime() + stepMs)
      : new Date()

  const profile =
    DEMO_DEVICE_PROFILES.find((p) => p.id === deviceId) ??
    profileFromLatest(
      device,
      latest
        ? {
            ph: latest.ph,
            ec: latest.ec,
            moisture: latest.moisture,
            temperature: latest.temperature,
            nitrogen: latest.nitrogen,
            phosphorus: latest.phosphorus,
            potassium: latest.potassium,
          }
        : null,
    )

  const values = simulateReadingValues(profile, at)
  const [row] = await db
    .insert(readings)
    .values({
      deviceId,
      ...values,
      lat: latest?.lat ?? device.lat,
      lon: latest?.lon ?? device.lon,
      recordedAt: at,
    })
    .returning()
  return toReadingDTO(row!)
}

/* ---------------------------------- Seed ----------------------------------- */

export const SEED_HISTORY_HOURS = 24 * 7
const SEED_STEP_MIN = 30

/** Wipe and regenerate the 6-device demo fleet with 7 days of 30-min readings */
export async function seedDemoData(): Promise<{
  devices: number
  readings: number
}> {
  await db.delete(readings)
  await db.delete(devices)

  const stepMs = SEED_STEP_MIN * 60_000
  const now = Date.now()
  const start = now - SEED_HISTORY_HOURS * 3600_000
  const count = Math.floor((now - start) / stepMs) + 1

  let total = 0
  for (const profile of DEMO_DEVICE_PROFILES) {
    await db.insert(devices).values({
      id: profile.id,
      name: profile.name,
      district: profile.district,
      region: profile.region,
      zone: profile.zone,
      crop: profile.crop,
      lat: profile.lat,
      lon: profile.lon,
    })
    const rows = []
    for (let i = 0; i < count; i++) {
      const at = new Date(start + i * stepMs)
      rows.push({
        deviceId: profile.id,
        ...simulateReadingValues(profile, at),
        lat: profile.lat,
        lon: profile.lon,
        recordedAt: at,
      })
    }
    await db.insert(readings).values(rows)
    total += rows.length
  }
  return { devices: DEMO_DEVICE_PROFILES.length, readings: total }
}

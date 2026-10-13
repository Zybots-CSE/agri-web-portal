import {
  sqliteTable,
  integer,
  text,
  real,
  index,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * Roving field probes (handheld units). Probes are NOT permanently
 * installed — they are placed at a spot, read, then moved somewhere else —
 * so they carry no coordinates of their own. Every reading holds its own
 * GPS fix. `region` stores the NRMC agro-ecological region code (e.g. "DL1").
 */
export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(), // e.g. "PRB-001" — device id sent by the probe
  name: text('name').notNull(),
  district: text('district'),
  region: text('region'),
  zone: text('zone'), // Dry Zone | Intermediate Zone | Wet Zone
  crop: text('crop'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * One soil reading per probe placement ("put → get reading → move").
 * All measured values are stored raw (after temperature-correction on the
 * device); hard-rule filtering happens at ingest time (see
 * src/lib/sensor-rules.ts). lat/lon is the GPS fix of THIS placement.
 */
export const readings = sqliteTable(
  'readings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id),
    ph: real('ph').notNull(), // pH scale, 3.0–9.0
    ec: real('ec').notNull(), // dS/m, 0.0–5.0
    moisture: real('moisture').notNull(), // % VWC, 0–100
    temperature: real('temperature').notNull(), // °C, 10–50
    nitrogen: real('nitrogen').notNull(), // mg/kg, 0–1999
    phosphorus: real('phosphorus').notNull(), // mg/kg, 0–1999
    potassium: real('potassium').notNull(), // mg/kg, 0–1999
    lat: real('lat').notNull(), // 5.9–9.9 (Sri Lanka bounds)
    lon: real('lon').notNull(), // 79.6–81.9
    spot: text('spot'), // sampling-spot label, e.g. "Paddy Block B"
    recordedAt: integer('recorded_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index('readings_device_recorded_idx').on(t.deviceId, t.recordedAt),
    index('readings_recorded_idx').on(t.recordedAt),
  ],
)

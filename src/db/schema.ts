import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * Roving field probes (handheld units). Probes are NOT permanently
 * installed — they are placed at a spot, read, then moved somewhere else —
 * so they carry no coordinates of their own. Every reading holds its own
 * GPS fix. `region` stores the NRMC agro-ecological region code (e.g. "DL1").
 */
export const devices = pgTable('devices', {
  id: text('id').primaryKey(), // e.g. "PRB-001" — device id sent by the probe
  name: text('name').notNull(),
  district: text('district'),
  region: text('region'),
  zone: text('zone'), // Dry Zone | Intermediate Zone | Wet Zone
  crop: text('crop'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * One soil reading per probe placement ("put → get reading → move").
 * All measured values are stored raw (after temperature-correction on the
 * device); hard-rule filtering happens at ingest time (see
 * src/lib/sensor-rules.ts). lat/lon is the GPS fix of THIS placement.
 */
export const readings = pgTable(
  'readings',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    deviceId: text('device_id')
      .notNull()
      .references(() => devices.id),
    ph: doublePrecision('ph').notNull(), // pH scale, 3.0–9.0
    ec: doublePrecision('ec').notNull(), // dS/m, 0.0–5.0
    moisture: doublePrecision('moisture').notNull(), // % VWC, 0–100
    temperature: doublePrecision('temperature').notNull(), // °C, 10–50
    nitrogen: doublePrecision('nitrogen').notNull(), // mg/kg, 0–1999
    phosphorus: doublePrecision('phosphorus').notNull(), // mg/kg, 0–1999
    potassium: doublePrecision('potassium').notNull(), // mg/kg, 0–1999
    lat: doublePrecision('lat').notNull(), // 5.9–9.9 (Sri Lanka bounds)
    lon: doublePrecision('lon').notNull(), // 79.6–81.9
    spot: text('spot'), // sampling-spot label, e.g. "Paddy Block B"
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('readings_device_recorded_idx').on(t.deviceId, t.recordedAt),
    index('readings_recorded_idx').on(t.recordedAt),
  ],
)

/** Model outputs keep their original probe/spot labels even if demo probes reset. */
export const predictions = pgTable(
  'predictions',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    model: text('model').notNull(),
    title: text('title').notNull(),
    category: text('category').notNull(),
    summary: text('summary').notNull(),
    confidence: doublePrecision('confidence'),
    deviceId: text('device_id'),
    spot: text('spot'),
    crop: text('crop'),
    recommendations: text('recommendations').array().notNull(),
    predictedAt: timestamp('predicted_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('predictions_created_idx').on(t.createdAt)],
)

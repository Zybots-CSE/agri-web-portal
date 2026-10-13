import { z } from 'zod'

/**
 * Sensor specification + "hard rule" thresholds shared by the UI, the ingest
 * API and the demo simulator.
 *
 * Sources: project SRS sensor table (ranges are the accepted sensor ranges
 * used as Step 1 hard-rule filters) plus standard agronomic sufficiency
 * bands for tropical lowland paddy / upland vegetable systems.
 */

export type ParamKey =
  | 'ph'
  | 'ec'
  | 'moisture'
  | 'temperature'
  | 'nitrogen'
  | 'phosphorus'
  | 'potassium'

export type StatusLevel = 'ok' | 'warn' | 'critical'

/** A coloured band on the sensor scale. Zones must cover the sensor range. */
export type Zone = {
  from: number
  to: number
  level: StatusLevel
  /** Short message shown when a reading lands in this zone */
  label: string
}

export type SensorParam = {
  key: ParamKey
  label: string
  short: string
  unit: string
  decimals: number
  /** Accepted sensor measurement range (hard rule filter) */
  sensorMin: number
  sensorMax: number
  /** Human-readable agronomic target shown on cards */
  targetLabel: string
  /** Why the pipeline needs it (from the SRS) — shown as card tooltip */
  purpose: string
  zones: Zone[]
}

export const SENSOR_PARAMS: Record<ParamKey, SensorParam> = {
  ph: {
    key: 'ph',
    label: 'Soil Reaction (pH)',
    short: 'pH',
    unit: '',
    decimals: 2,
    sensorMin: 3.0,
    sensorMax: 9.0,
    targetLabel: '5.5 – 8.0',
    purpose:
      'Hard rule filter (Step 1) and dolomite/liming calculation. Triggers nutrient lockout flags below 5.0.',
    zones: [
      {
        from: 3.0,
        to: 5.0,
        level: 'critical',
        label: 'Nutrient lockout risk (below pH 5.0)',
      },
      {
        from: 5.0,
        to: 5.5,
        level: 'warn',
        label: 'Acidic — liming recommended',
      },
      { from: 5.5, to: 8.0, level: 'ok', label: 'Optimal for most crops' },
      {
        from: 8.0,
        to: 8.5,
        level: 'warn',
        label: 'Alkaline — check micronutrients',
      },
      { from: 8.5, to: 9.0, level: 'critical', label: 'Strongly alkaline' },
    ],
  },
  ec: {
    key: 'ec',
    label: 'Electrical Conductivity',
    short: 'EC',
    unit: 'dS/m',
    decimals: 2,
    sensorMin: 0.0,
    sensorMax: 5.0,
    targetLabel: '< 2.0 dS/m',
    purpose:
      'Hard rule filter (Step 1). Identifies salinity stress in Dry Zone command areas (> 2.0 dS/m).',
    zones: [
      { from: 0.0, to: 2.0, level: 'ok', label: 'Non-saline' },
      {
        from: 2.0,
        to: 3.5,
        level: 'warn',
        label: 'Salinity stress (> 2.0 dS/m)',
      },
      {
        from: 3.5,
        to: 5.0,
        level: 'critical',
        label: 'Severe salinity — crop failure risk',
      },
    ],
  },
  moisture: {
    key: 'moisture',
    label: 'Soil Moisture (VWC)',
    short: 'Moisture',
    unit: '%',
    decimals: 1,
    sensorMin: 0,
    sensorMax: 100,
    targetLabel: '20 – 45%',
    purpose:
      'Drainage checks. Distinguishes waterlogged lowland paddy soil from well-drained upland soil.',
    zones: [
      {
        from: 0,
        to: 12,
        level: 'critical',
        label: 'Severely dry — permanent wilting point',
      },
      { from: 12, to: 20, level: 'warn', label: 'Dry — irrigation advised' },
      { from: 20, to: 45, level: 'ok', label: 'Well-drained, field capacity' },
      { from: 45, to: 60, level: 'warn', label: 'Saturated — check drainage' },
      {
        from: 60,
        to: 100,
        level: 'critical',
        label: 'Waterlogged (lowland paddy conditions)',
      },
    ],
  },
  temperature: {
    key: 'temperature',
    label: 'Soil Temperature',
    short: 'Temp',
    unit: '°C',
    decimals: 1,
    sensorMin: 10,
    sensorMax: 50,
    targetLabel: '16 – 34 °C',
    purpose:
      'Corrects raw EC and pH drift before feeding values into algorithms.',
    zones: [
      {
        from: 10,
        to: 16,
        level: 'warn',
        label: 'Cold stress — slows microbial activity',
      },
      { from: 16, to: 34, level: 'ok', label: 'Optimal root-zone temperature' },
      { from: 34, to: 40, level: 'warn', label: 'Heat stress' },
      {
        from: 40,
        to: 50,
        level: 'critical',
        label: 'Severe heat — root damage',
      },
    ],
  },
  nitrogen: {
    key: 'nitrogen',
    label: 'Nitrogen (N)',
    short: 'N',
    unit: 'mg/kg',
    decimals: 0,
    sensorMin: 0,
    sensorMax: 1999,
    targetLabel: '40 – 150 mg/kg',
    purpose:
      'Step 2 ML model input and direct target deficit calculation (ΔN) for Urea recommendations.',
    zones: [
      { from: 0, to: 20, level: 'critical', label: 'Nitrogen deficient' },
      { from: 20, to: 40, level: 'warn', label: 'Nitrogen low' },
      { from: 40, to: 150, level: 'ok', label: 'Adequate N supply' },
      {
        from: 150,
        to: 1999,
        level: 'warn',
        label: 'Nitrogen excessive — lodging / leaching risk',
      },
    ],
  },
  phosphorus: {
    key: 'phosphorus',
    label: 'Phosphorus (P)',
    short: 'P',
    unit: 'mg/kg',
    decimals: 0,
    sensorMin: 0,
    sensorMax: 1999,
    targetLabel: '15 – 60 mg/kg',
    purpose:
      'Step 2 ML model input and direct target deficit calculation (ΔP) for TSP recommendations.',
    zones: [
      { from: 0, to: 8, level: 'critical', label: 'Phosphorus deficient' },
      { from: 8, to: 15, level: 'warn', label: 'Phosphorus low' },
      { from: 15, to: 60, level: 'ok', label: 'Adequate P supply' },
      {
        from: 60,
        to: 1999,
        level: 'warn',
        label: 'Phosphorus high — runoff pollution risk',
      },
    ],
  },
  potassium: {
    key: 'potassium',
    label: 'Potassium (K)',
    short: 'K',
    unit: 'mg/kg',
    decimals: 0,
    sensorMin: 0,
    sensorMax: 1999,
    targetLabel: '90 – 220 mg/kg',
    purpose:
      'Step 2 ML model input and direct target deficit calculation (ΔK) for MOP recommendations.',
    zones: [
      { from: 0, to: 50, level: 'critical', label: 'Potassium deficient' },
      { from: 50, to: 90, level: 'warn', label: 'Potassium low' },
      { from: 90, to: 220, level: 'ok', label: 'Adequate K supply' },
      { from: 220, to: 1999, level: 'warn', label: 'Potassium high' },
    ],
  },
}

/** Display order: SRS parameter order */
export const SENSOR_PARAM_LIST: SensorParam[] = [
  SENSOR_PARAMS.ph,
  SENSOR_PARAMS.ec,
  SENSOR_PARAMS.moisture,
  SENSOR_PARAMS.temperature,
  SENSOR_PARAMS.nitrogen,
  SENSOR_PARAMS.phosphorus,
  SENSOR_PARAMS.potassium,
]

/** GPS bounds accepted from the onboard GPS module (SRS) */
export const GPS_BOUNDS = {
  latMin: 5.9,
  latMax: 9.9,
  lonMin: 79.6,
  lonMax: 81.9,
}

export function zoneForValue(param: SensorParam, value: number): Zone {
  const first = param.zones[0]
  const last = param.zones[param.zones.length - 1]
  if (!first || !last) {
    throw new Error(`Sensor param ${param.key} has no zones defined`)
  }
  return (
    param.zones.find((zone) => value >= zone.from && value < zone.to) ??
    (value >= param.sensorMax ? last : first)
  )
}

export function formatValue(param: SensorParam, value: number): string {
  return value.toFixed(param.decimals)
}

export type SensorValues = {
  ph: number
  ec: number
  moisture: number
  temperature: number
  nitrogen: number
  phosphorus: number
  potassium: number
}

export type ParamStatus = { level: StatusLevel; label: string }

/** Evaluate one parameter against the hard rules */
export function statusForValue(param: SensorParam, value: number): ParamStatus {
  const zone = zoneForValue(param, value)
  return { level: zone.level, label: zone.label }
}

export type OverallStatus = {
  level: StatusLevel
  /** Active flag messages for every non-OK parameter */
  flags: { param: SensorParam; level: StatusLevel; label: string }[]
}

/** Evaluate the full reading — worst level wins (Step 1 hard rule filter) */
export function overallStatus(values: SensorValues): OverallStatus {
  let level: StatusLevel = 'ok'
  const flags: OverallStatus['flags'] = []
  for (const param of SENSOR_PARAM_LIST) {
    const status = statusForValue(param, values[param.key])
    if (status.level !== 'ok') {
      flags.push({ param, level: status.level, label: status.label })
      if (status.level === 'critical') level = 'critical'
      else if (level !== 'critical') level = 'warn'
    }
  }
  return { level, flags }
}

export const STATUS_RANK: Record<StatusLevel, number> = {
  ok: 0,
  warn: 1,
  critical: 2,
}

/* ---------------------------------------------------------------------- */
/* Ingest API validation (SRS ranges are the hard rule filter)             */
/* ---------------------------------------------------------------------- */

const DEVICE_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/

const latSchema = z
  .number()
  .min(
    GPS_BOUNDS.latMin,
    `Latitude must be within ${GPS_BOUNDS.latMin}–${GPS_BOUNDS.latMax} (Sri Lanka)`,
  )
  .max(
    GPS_BOUNDS.latMax,
    `Latitude must be within ${GPS_BOUNDS.latMin}–${GPS_BOUNDS.latMax} (Sri Lanka)`,
  )

const lonSchema = z
  .number()
  .min(
    GPS_BOUNDS.lonMin,
    `Longitude must be within ${GPS_BOUNDS.lonMin}–${GPS_BOUNDS.lonMax} (Sri Lanka)`,
  )
  .max(
    GPS_BOUNDS.lonMax,
    `Longitude must be within ${GPS_BOUNDS.lonMin}–${GPS_BOUNDS.lonMax} (Sri Lanka)`,
  )

const optionalDeviceMeta = {
  district: z.string().min(1).max(60).optional(),
  region: z.string().min(1).max(20).optional(),
  zone: z.string().min(1).max(40).optional(),
  crop: z.string().min(1).max(60).optional(),
}

/** Body accepted by POST /api/readings — out-of-range values are rejected */
export const readingIngestSchema = z.object({
  deviceId: z
    .string()
    .regex(
      DEVICE_ID_REGEX,
      'deviceId must be 2–40 chars: letters, digits, dot, dash, underscore',
    ),
  ph: z
    .number()
    .min(SENSOR_PARAMS.ph.sensorMin)
    .max(SENSOR_PARAMS.ph.sensorMax),
  ec: z
    .number()
    .min(SENSOR_PARAMS.ec.sensorMin)
    .max(SENSOR_PARAMS.ec.sensorMax),
  moisture: z
    .number()
    .min(SENSOR_PARAMS.moisture.sensorMin)
    .max(SENSOR_PARAMS.moisture.sensorMax),
  temperature: z
    .number()
    .min(SENSOR_PARAMS.temperature.sensorMin)
    .max(SENSOR_PARAMS.temperature.sensorMax),
  nitrogen: z
    .number()
    .min(SENSOR_PARAMS.nitrogen.sensorMin)
    .max(SENSOR_PARAMS.nitrogen.sensorMax),
  phosphorus: z
    .number()
    .min(SENSOR_PARAMS.phosphorus.sensorMin)
    .max(SENSOR_PARAMS.phosphorus.sensorMax),
  potassium: z
    .number()
    .min(SENSOR_PARAMS.potassium.sensorMin)
    .max(SENSOR_PARAMS.potassium.sensorMax),
  lat: latSchema,
  lon: lonSchema,
  /** ISO-8601; defaults to server time when omitted */
  recordedAt: z.iso.datetime({ offset: true }).optional(),
  /** Optional device metadata — used when auto-registering an unknown device */
  deviceName: z.string().min(1).max(80).optional(),
  ...optionalDeviceMeta,
})
export type ReadingIngest = z.infer<typeof readingIngestSchema>

/** Body accepted by POST /api/devices */
export const deviceRegistrationSchema = z.object({
  id: z
    .string()
    .regex(
      DEVICE_ID_REGEX,
      'id must be 2–40 chars: letters, digits, dot, dash, underscore',
    ),
  name: z.string().min(1).max(80),
  lat: latSchema,
  lon: lonSchema,
  ...optionalDeviceMeta,
})
export type DeviceRegistration = z.infer<typeof deviceRegistrationSchema>

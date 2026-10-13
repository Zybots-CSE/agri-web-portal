import type { ParamKey, SensorValues } from './sensor-rules'

/**
 * Demo data generator.
 *
 * Values are produced by a deterministic, time-based model per device:
 *   value(t) = midpoint + slow oscillation (days-scale)
 *            ± diurnal cycle (temp / moisture)
 *            + scheduled events (irrigation, fertilisation) with exponential
 *              decay — the "event boost"
 *            + small sensor noise
 *
 * Because the model is a pure function of (profile, timestamp), the seeded
 * 7-day history and the live "simulate next reading" action produce the same
 * continuous timeline.
 */

export type DeviceProfile = {
  id: string
  name: string
  district: string
  /** NRMC agro-ecological region code */
  region: string
  zone: 'Dry Zone' | 'Intermediate Zone' | 'Wet Zone'
  crop: string
  lat: number
  lon: number
  /** Typical operating band per parameter: [low, high] */
  bands: Record<ParamKey, [number, number]>
  /** Diurnal temperature swing amplitude (°C) */
  diurnalAmp: number
  /** Irrigation / rain event schedule */
  irrigation: {
    everyHours: number
    probability: number
    boost: number
    decayHours: number
  }
  /** Fertiliser event schedule (N gets the biggest boost) */
  fertiliser: { everyHours: number; probability: number; decayHours: number }
}

const PADDY_IRRIGATION = {
  everyHours: 18,
  probability: 0.55,
  boost: 16,
  decayHours: 10,
}
const UPLAND_IRRIGATION = {
  everyHours: 36,
  probability: 0.4,
  boost: 9,
  decayHours: 8,
}
const STANDARD_FERTILISER = { everyHours: 96, probability: 0.3, decayHours: 40 }

/**
 * Six demo probes across the island — one per major agro-ecological system.
 * Bands are chosen so the dashboard demonstrates every hard-rule flag:
 * Polonnaruwa crosses the EC salinity threshold, Kandy/Ratnapura dip into
 * the pH lockout zone, Ampara shows low P/K, and paddy fields show
 * saturated moisture readings.
 */
export const DEMO_DEVICE_PROFILES: DeviceProfile[] = [
  {
    id: 'AGRI-001',
    name: 'Anuradhapura Field Probe',
    district: 'Anuradhapura',
    region: 'DL1',
    zone: 'Dry Zone',
    crop: 'Lowland paddy',
    lat: 8.311,
    lon: 80.402,
    bands: {
      ph: [6.2, 6.9],
      ec: [0.35, 0.9],
      moisture: [34, 56],
      temperature: [25, 34],
      nitrogen: [30, 75],
      phosphorus: [10, 22],
      potassium: [70, 160],
    },
    diurnalAmp: 3.5,
    irrigation: PADDY_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
  {
    id: 'AGRI-002',
    name: 'Polonnaruwa Command Area Probe',
    district: 'Polonnaruwa',
    region: 'DL1b',
    zone: 'Dry Zone',
    crop: 'Lowland paddy (Mahaweli)',
    lat: 7.941,
    lon: 81.019,
    bands: {
      ph: [6.5, 7.6],
      ec: [1.6, 3.0], // command-area salinity — crosses the 2.0 dS/m threshold
      moisture: [40, 62], // occasionally waterlogged
      temperature: [26, 35],
      nitrogen: [45, 110],
      phosphorus: [12, 30],
      potassium: [80, 180],
    },
    diurnalAmp: 4,
    irrigation: PADDY_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
  {
    id: 'AGRI-003',
    name: 'Ampara Lowland Probe',
    district: 'Ampara',
    region: 'DL2',
    zone: 'Dry Zone',
    crop: 'Lowland paddy',
    lat: 7.003,
    lon: 81.673,
    bands: {
      ph: [5.6, 6.6],
      ec: [0.2, 0.8],
      moisture: [32, 55],
      temperature: [25, 33],
      nitrogen: [25, 65],
      phosphorus: [8, 18], // occasionally P-deficient
      potassium: [55, 120], // occasionally K-low
    },
    diurnalAmp: 3.5,
    irrigation: PADDY_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
  {
    id: 'AGRI-004',
    name: 'Kandy Mid-Country Probe',
    district: 'Kandy',
    region: 'IL3',
    zone: 'Intermediate Zone',
    crop: 'Upland vegetables',
    lat: 7.291,
    lon: 80.641,
    bands: {
      ph: [4.9, 6.0], // dips below 5.0 → nutrient lockout flag
      ec: [0.08, 0.35],
      moisture: [18, 38],
      temperature: [19, 27],
      nitrogen: [40, 95],
      phosphorus: [14, 35],
      potassium: [90, 200],
    },
    diurnalAmp: 2.5,
    irrigation: UPLAND_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
  {
    id: 'AGRI-005',
    name: 'Ratnapura Wet Zone Probe',
    district: 'Ratnapura',
    region: 'WL2',
    zone: 'Wet Zone',
    crop: 'Tea',
    lat: 6.683,
    lon: 80.41,
    bands: {
      ph: [4.7, 5.6], // tea soils are acidic — frequent lockout flags
      ec: [0.05, 0.25],
      moisture: [28, 52],
      temperature: [22, 29],
      nitrogen: [28, 60],
      phosphorus: [6, 15], // occasionally P-deficient
      potassium: [60, 140],
    },
    diurnalAmp: 2,
    irrigation: UPLAND_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
  {
    id: 'AGRI-006',
    name: 'Badulla Uva Probe',
    district: 'Badulla',
    region: 'IU3',
    zone: 'Intermediate Zone',
    crop: 'Upland vegetables',
    lat: 6.993,
    lon: 81.055,
    bands: {
      ph: [5.8, 6.8],
      ec: [0.1, 0.5],
      moisture: [20, 40],
      temperature: [20, 30],
      nitrogen: [42, 105],
      phosphorus: [15, 38],
      potassium: [95, 210],
    },
    diurnalAmp: 3,
    irrigation: UPLAND_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
]

/* ------------------------------ PRNG / hashing ----------------------------- */

/** FNV-1a string hash → uint32 (stable across runs) */
export function hashString(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Deterministic PRNG (mulberry32) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable pseudo-random number in [0, 1) for a string seed */
function hash01(str: string): number {
  return (hashString(str) % 100000) / 100000
}

/* ------------------------------ Event model ------------------------------- */

/**
 * Find the most recent scheduled event before `tMs`.
 * A slot fires when hash01(key + slot) < probability; the exact event time
 * sits at a hashed offset inside the slot.
 */
function lastEventBefore(
  key: string,
  tMs: number,
  everyHours: number,
  probability: number,
): number | null {
  const slotMs = everyHours * 3600_000
  const slot = Math.floor(tMs / slotMs)
  for (let i = 0; i < 12; i++) {
    const s = slot - i
    if (hash01(`${key}:slot:${s}`) < probability) {
      const offset = hash01(`${key}:slot:${s}:offset`) * (slotMs - 1)
      const eventTime = s * slotMs + offset
      if (eventTime <= tMs) return eventTime
    }
  }
  return null
}

/** Event boost with exponential decay since the last event, in ms-space */
function eventBoost(
  key: string,
  tMs: number,
  cfg: {
    everyHours: number
    probability: number
    boost: number
    decayHours: number
  },
): number {
  const last = lastEventBefore(key, tMs, cfg.everyHours, cfg.probability)
  if (last === null) return 0
  const decayMs = cfg.decayHours * 3600_000
  return cfg.boost * Math.exp(-(tMs - last) / decayMs)
}

/* ------------------------------ Core generator ----------------------------- */

const NOISE: Record<ParamKey, number> = {
  ph: 0.06,
  ec: 0.05,
  moisture: 0.9,
  temperature: 0.35,
  nitrogen: 2.5,
  phosphorus: 1.5,
  potassium: 3,
}

function bandMid([lo, hi]: [number, number]): number {
  return (lo + hi) / 2
}

function bandHalf([lo, hi]: [number, number]): number {
  return (hi - lo) / 2
}

/** Slow multi-day oscillation phase/period derived from device + param */
function slowWave(
  profile: DeviceProfile,
  param: ParamKey,
  tMs: number,
): number {
  const seed = hashString(`${profile.id}:${param}`)
  const periodDays = 2 + (seed % 4) // 2–5 day cycles
  const phase = (seed % 997) / 997
  return Math.sin(
    (tMs / (periodDays * 86_400_000)) * Math.PI * 2 + phase * Math.PI * 2,
  )
}

/** Diurnal cycle: returns 0..1..0 with peak at `peakHour` local time */
function diurnal(tMs: number, peakHour: number): number {
  // Use UTC+5:30 (Asia/Colombo) for the demo day cycle
  const hour = (((tMs / 3600_000 + 5.5) % 24) + 24) % 24
  return Math.sin(((hour - peakHour + 6) / 24) * Math.PI * 2)
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

export function roundFor(param: ParamKey, v: number): number {
  switch (param) {
    case 'ph':
    case 'ec':
      return Math.round(v * 100) / 100
    case 'moisture':
    case 'temperature':
      return Math.round(v * 10) / 10
    default:
      return Math.max(0, Math.round(v))
  }
}

/**
 * Generate the reading values for a device at a point in time.
 * Deterministic: same (profile, t) → same values.
 */
export function simulateReadingValues(
  profile: DeviceProfile,
  at: Date,
): SensorValues {
  const t = at.getTime()
  const noiseRnd = mulberry32(hashString(`${profile.id}:${t}`))

  const result = {} as Record<ParamKey, number>

  for (const param of Object.keys(profile.bands) as ParamKey[]) {
    const band = profile.bands[param]
    const mid = bandMid(band)
    const half = bandHalf(band)
    let v = mid + half * 0.92 * slowWave(profile, param, t)

    switch (param) {
      case 'temperature': {
        // Day peaks ~14:00, overnight minimum
        v += profile.diurnalAmp * diurnal(t, 14)
        break
      }
      case 'moisture': {
        // Midday evaporation dip + irrigation/rain events
        v -= 2.2 * diurnal(t, 15)
        v += eventBoost(`${profile.id}:irrigation`, t, profile.irrigation)
        break
      }
      case 'nitrogen': {
        v += eventBoost(`${profile.id}:urea`, t, {
          ...profile.fertiliser,
          boost: 32,
        })
        break
      }
      case 'phosphorus': {
        v += eventBoost(`${profile.id}:tsp`, t, {
          ...profile.fertiliser,
          boost: 11,
        })
        break
      }
      case 'potassium': {
        v += eventBoost(`${profile.id}:mop`, t, {
          ...profile.fertiliser,
          boost: 24,
        })
        break
      }
      default:
        break
    }

    // Sensor noise
    v += (noiseRnd() - 0.5) * 2 * NOISE[param]
    // Allow events to overshoot the typical band slightly, but stay plausible
    v = clamp(
      v,
      band[0] - Math.min(half * 0.25, 1.5),
      band[1] + Math.min(half * 0.25, 3),
    )
    result[param] = roundFor(param, v)
  }

  return {
    ph: result.ph,
    ec: result.ec,
    moisture: result.moisture,
    temperature: result.temperature,
    nitrogen: result.nitrogen,
    phosphorus: result.phosphorus,
    potassium: result.potassium,
  }
}

/**
 * Build an ad-hoc profile for devices registered through the API (not part
 * of the demo fleet). Bands centre on the device's last known reading so the
 * simulated timeline stays continuous with its real history.
 */
export function profileFromLatest(
  device: {
    id: string
    name: string
    district: string | null
    region: string | null
    zone: string | null
    crop: string | null
    lat: number
    lon: number
  },
  latest: SensorValues | null,
): DeviceProfile {
  const band = (v: number, lo: number, hi: number): [number, number] => {
    const span = Math.max(v * 0.18, (hi - lo) * 0.1)
    return [clamp(v - span, lo, hi), clamp(v + span, lo, hi)]
  }
  const center = latest ?? {
    ph: 6.3,
    ec: 0.4,
    moisture: 32,
    temperature: 27,
    nitrogen: 60,
    phosphorus: 20,
    potassium: 110,
  }
  return {
    id: device.id,
    name: device.name,
    district: device.district ?? '',
    region: device.region ?? '',
    zone: (device.zone as DeviceProfile['zone'] | null) ?? 'Intermediate Zone',
    crop: device.crop ?? '',
    lat: device.lat,
    lon: device.lon,
    bands: {
      ph: band(center.ph, 4.5, 8.5),
      ec: band(center.ec, 0.05, 3.5),
      moisture: band(center.moisture, 8, 70),
      temperature: band(center.temperature, 16, 40),
      nitrogen: band(center.nitrogen, 10, 250),
      phosphorus: band(center.phosphorus, 5, 80),
      potassium: band(center.potassium, 20, 280),
    },
    diurnalAmp: 3,
    irrigation: UPLAND_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  }
}

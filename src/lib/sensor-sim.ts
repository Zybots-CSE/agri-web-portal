import type { ParamKey, SensorValues } from './sensor-rules'

/**
 * Demo data generator for a ROVING-PROBE workflow.
 *
 * The system studies one local area — a single research farm block — not
 * the whole country. Probes are handheld units: an operator places one at
 * a spot, takes a reading, then moves it somewhere else ("put → reading →
 * move → reading"). Nothing is permanently installed, so:
 *
 *   - probes (devices) have NO fixed coordinates;
 *   - every reading carries its own GPS fix and the label of the sampling
 *     spot it was taken at.
 *
 * Soil chemistry belongs to the PLOT, not the probe, so values are
 * produced by a deterministic, time-based model per plot:
 *
 *   value(t) = midpoint + slow oscillation (days-scale)
 *            ± diurnal cycle (temp / moisture)
 *            + scheduled events (irrigation, fertilisation)
 *            + probe-specific measurement noise
 *
 * The reading index drives the walk: reading i lands on
 * `route[i mod route.length]`, jittered around the plot centre — so the
 * seeded history and the live "Simulate reading" action produce one
 * continuous timeline.
 */

export type PlotProfile = {
  id: string
  /** Human-readable sampling-spot label stored with every reading */
  name: string
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

export type ProbeProfile = {
  id: string
  name: string
  /** Plot ids the operator's route covers, in visiting order */
  route: string[]
}

/** The local area under study (adjust to your own farm block) */
export const FARM_AREA = {
  name: 'Iluppallama Research Farm',
  district: 'Anuradhapura',
  region: 'DL1',
  zone: 'Dry Zone',
  center: { lat: 8.3552, lon: 80.4672 },
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
 * Eight sampling plots of the farm. Bands are chosen so the dashboard
 * demonstrates every hard-rule flag somewhere on the farm: Paddy Block B
 * is a salinity hotspot (EC > 2.0), Paddy Block A runs waterlogged, the
 * Orchard Block dips into the pH-lockout zone, the Vegetable Plot and
 * Chilli Nursery show P / N deficits, the Fallow Plot runs dry and
 * K-deficient, and the Compost Yard overshoots nutrients.
 */
export const FARM_PLOTS: PlotProfile[] = [
  {
    id: 'paddy-a',
    name: 'Paddy Block A',
    crop: 'Lowland paddy',
    lat: 8.357,
    lon: 80.47,
    bands: {
      ph: [6.2, 6.9],
      ec: [0.35, 0.9],
      moisture: [44, 64], // saturated → occasionally waterlogged (> 60)
      temperature: [24, 33],
      nitrogen: [30, 75],
      phosphorus: [10, 22],
      potassium: [70, 160],
    },
    diurnalAmp: 3.5,
    irrigation: PADDY_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
  {
    id: 'paddy-b',
    name: 'Paddy Block B',
    crop: 'Lowland paddy',
    lat: 8.3525,
    lon: 80.463,
    bands: {
      ph: [6.4, 7.4],
      ec: [1.6, 2.9], // command-area salinity — crosses the 2.0 dS/m threshold
      moisture: [40, 58],
      temperature: [25, 34],
      nitrogen: [45, 110],
      phosphorus: [12, 30],
      potassium: [80, 180],
    },
    diurnalAmp: 4,
    irrigation: PADDY_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
  {
    id: 'maize',
    name: 'Maize Field',
    crop: 'Maize',
    lat: 8.359,
    lon: 80.4655,
    bands: {
      ph: [5.9, 6.8],
      ec: [0.15, 0.6],
      moisture: [22, 42],
      temperature: [24, 35],
      nitrogen: [50, 120],
      phosphorus: [16, 38],
      potassium: [95, 200],
    },
    diurnalAmp: 4,
    irrigation: UPLAND_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
  {
    id: 'vegetable',
    name: 'Vegetable Plot',
    crop: 'Upcountry vegetables',
    lat: 8.3555,
    lon: 80.46,
    bands: {
      ph: [5.8, 6.6],
      ec: [0.1, 0.5],
      moisture: [20, 40],
      temperature: [22, 32],
      nitrogen: [40, 95],
      phosphorus: [7, 14], // occasionally P-deficient (< 8 critical)
      potassium: [85, 190],
    },
    diurnalAmp: 3,
    irrigation: UPLAND_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
  {
    id: 'nursery',
    name: 'Chilli Nursery',
    crop: 'Chilli',
    lat: 8.3515,
    lon: 80.4715,
    bands: {
      ph: [5.7, 6.5],
      ec: [0.08, 0.4],
      moisture: [24, 46],
      temperature: [23, 33],
      nitrogen: [16, 38], // occasionally N-deficient (< 20 critical)
      phosphorus: [12, 28],
      potassium: [70, 150],
    },
    diurnalAmp: 3,
    irrigation: UPLAND_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
  {
    id: 'orchard',
    name: 'Orchard Block',
    crop: 'Mango orchard',
    lat: 8.3595,
    lon: 80.474,
    bands: {
      ph: [4.75, 5.6], // acidic — dips below 5.0 → nutrient lockout flag
      ec: [0.08, 0.35],
      moisture: [26, 48],
      temperature: [22, 32],
      nitrogen: [28, 62],
      phosphorus: [8, 18],
      potassium: [75, 160],
    },
    diurnalAmp: 2.5,
    irrigation: UPLAND_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
  {
    id: 'compost',
    name: 'Compost Yard',
    crop: 'Compost turning',
    lat: 8.3525,
    lon: 80.475,
    bands: {
      ph: [6.4, 7.3],
      ec: [0.6, 1.5],
      moisture: [30, 50],
      temperature: [24, 35],
      nitrogen: [120, 220], // frequently excessive (> 150)
      phosphorus: [55, 110], // occasionally high (> 60)
      potassium: [200, 330], // occasionally high (> 220)
    },
    diurnalAmp: 3.5,
    irrigation: UPLAND_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
  {
    id: 'fallow',
    name: 'Fallow Plot',
    crop: 'Fallow',
    lat: 8.356,
    lon: 80.457,
    bands: {
      ph: [5.6, 6.4],
      ec: [0.05, 0.3],
      moisture: [12, 24], // runs dry — occasionally < 12 critical
      temperature: [24, 36],
      nitrogen: [15, 40], // occasionally N-deficient
      phosphorus: [10, 24],
      potassium: [42, 82], // occasionally K-deficient (< 50 critical)
    },
    diurnalAmp: 4,
    irrigation: UPLAND_IRRIGATION,
    fertiliser: STANDARD_FERTILISER,
  },
]

/**
 * Three roving probes sharing the farm. Each one covers a different set
 * of plots — its "route" — and every placement takes one reading before
 * the probe is moved to the next spot on the route.
 */
export const DEMO_PROBE_PROFILES: ProbeProfile[] = [
  {
    id: 'PRB-001',
    name: 'Probe 01 · Lowland route',
    route: ['paddy-a', 'paddy-b', 'fallow'],
  },
  {
    id: 'PRB-002',
    name: 'Probe 02 · Upland route',
    route: ['maize', 'vegetable', 'nursery'],
  },
  {
    id: 'PRB-003',
    name: 'Probe 03 · Perennial route',
    route: ['orchard', 'compost', 'paddy-a'],
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

/** Slow multi-day oscillation phase/period derived from plot + param */
function slowWave(plot: PlotProfile, param: ParamKey, tMs: number): number {
  const seed = hashString(`${plot.id}:${param}`)
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
 * Generate the reading values for a plot at a point in time, as measured
 * by a specific probe. Deterministic: same (plot, probe, t) → same values.
 */
export function simulatePlotValues(
  plot: PlotProfile,
  probeId: string,
  at: Date,
): SensorValues {
  const t = at.getTime()
  const noiseRnd = mulberry32(hashString(`${probeId}:${plot.id}:${t}`))

  const result = {} as Record<ParamKey, number>

  for (const param of Object.keys(plot.bands) as ParamKey[]) {
    const band = plot.bands[param]
    const mid = bandMid(band)
    const half = bandHalf(band)
    let v = mid + half * 0.92 * slowWave(plot, param, t)

    switch (param) {
      case 'temperature': {
        // Day peaks ~14:00, overnight minimum
        v += plot.diurnalAmp * diurnal(t, 14)
        break
      }
      case 'moisture': {
        // Midday evaporation dip + irrigation/rain events
        v -= 2.2 * diurnal(t, 15)
        v += eventBoost(`${plot.id}:irrigation`, t, plot.irrigation)
        break
      }
      case 'nitrogen': {
        v += eventBoost(`${plot.id}:urea`, t, {
          ...plot.fertiliser,
          boost: 32,
        })
        break
      }
      case 'phosphorus': {
        v += eventBoost(`${plot.id}:tsp`, t, {
          ...plot.fertiliser,
          boost: 11,
        })
        break
      }
      case 'potassium': {
        v += eventBoost(`${plot.id}:mop`, t, {
          ...plot.fertiliser,
          boost: 24,
        })
        break
      }
      default:
        break
    }

    // Probe-specific sensor noise
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

/* ------------------------------- Probe walk -------------------------------- */

/** The plot the probe's `readingIndex`-th placement lands on */
export function probeRouteAt(
  probe: ProbeProfile,
  readingIndex: number,
): PlotProfile {
  const plotId = probe.route[readingIndex % probe.route.length]!
  const plot = FARM_PLOTS.find((p) => p.id === plotId)
  if (!plot) throw new Error(`Unknown plot on route: ${probe.id} → ${plotId}`)
  return plot
}

const round5 = (v: number) => Math.round(v * 100000) / 100000

/**
 * Deterministic ±~30 m placement jitter so every reading is a distinct
 * spot around the plot centre (the probe is re-placed each time).
 */
export function spotLocation(
  plot: PlotProfile,
  probeId: string,
  readingIndex: number,
): { lat: number; lon: number } {
  const jLat = (hash01(`${probeId}:${readingIndex}:lat`) - 0.5) * 0.00056
  const jLon = (hash01(`${probeId}:${readingIndex}:lon`) - 0.5) * 0.00056
  return { lat: round5(plot.lat + jLat), lon: round5(plot.lon + jLon) }
}

/**
 * Build an ad-hoc plot for probes registered through the API (not part
 * of the demo fleet). The probe keeps roving around its last known
 * position with bands centred on its last reading, so the simulated
 * timeline stays continuous with its real history.
 */
export function spotProfileFromLatest(
  device: {
    id: string
    name: string
    district: string | null
    region: string | null
    zone: string | null
    crop: string | null
  },
  latest:
    (SensorValues & { lat: number; lon: number; spot: string | null }) | null,
  readingIndex: number,
): { plot: PlotProfile; spotName: string | null } {
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
    lat: FARM_AREA.center.lat,
    lon: FARM_AREA.center.lon,
    spot: null,
  }
  const jLat = (hash01(`${device.id}:${readingIndex}:lat`) - 0.5) * 0.00056
  const jLon = (hash01(`${device.id}:${readingIndex}:lon`) - 0.5) * 0.00056
  return {
    plot: {
      id: `${device.id}:spot`,
      name: 'Field spot',
      crop: device.crop ?? 'Field crop',
      lat: round5(center.lat + jLat),
      lon: round5(center.lon + jLon),
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
    },
    spotName: latest?.spot ?? null,
  }
}

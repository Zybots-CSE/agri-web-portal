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
 *   value(t) = midpoint + smooth random drift (hours → days scale)
 *            ± asymmetric diurnal cycle, damped on cloudy days
 *            + irrigation / fertiliser events (ramp up, decay)
 *            + cross-parameter coupling (wetness → EC, NPK, temp)
 *            + probe calibration bias + Gaussian measurement noise
 *
 * The reading index drives the walk: the operator works one plot for a
 * session of several readings (3–9 h), then moves to the next plot on the
 * route. Each reading is jittered around the plot centre, and the seeded
 * history and the live "Simulate reading" action produce one continuous
 * timeline.
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

/* ------------------------------ Noise model -------------------------------- */

const HOUR_MS = 3600_000

/**
 * Smooth 1-D value noise in roughly [-1, 1]: hashed random knots every
 * `knotHours`, joined with a Catmull-Rom spline so the curve wanders
 * irregularly instead of repeating like a sine wave.
 */
function valueNoise(key: string, tMs: number, knotHours: number): number {
  const x = tMs / (knotHours * HOUR_MS)
  const i = Math.floor(x)
  const f = x - i
  const k = (n: number) => hash01(`${key}:${n}`) * 2 - 1
  const p0 = k(i - 1)
  const p1 = k(i)
  const p2 = k(i + 1)
  const p3 = k(i + 2)
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * f +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f +
      (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f)
  )
}

/** Two-octave drift: a slow multi-day trend plus a faster wobble */
function drift(
  key: string,
  tMs: number,
  slowHours: number,
  fastHours: number,
  fastWeight: number,
): number {
  return (
    (1 - fastWeight) * valueNoise(`${key}:slow`, tMs, slowHours) +
    fastWeight * valueNoise(`${key}:fast`, tMs, fastHours)
  )
}

/** Standard normal sample (Box–Muller) from a uniform PRNG */
function gaussian(rnd: () => number): number {
  const u = Math.max(rnd(), 1e-9)
  const v = rnd()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/* ------------------------------ Event model ------------------------------- */

type EventSchedule = { everyHours: number; probability: number }

/**
 * Scheduled events (irrigation, rain, fertiliser) that happened within
 * `lookbackHours` before `tMs`. A slot fires when hash01(key + slot) <
 * probability; the exact event time sits at a hashed offset in the slot.
 */
function eventsBefore(
  key: string,
  tMs: number,
  cfg: EventSchedule,
  lookbackHours: number,
): Array<{ at: number; size: number }> {
  const slotMs = cfg.everyHours * HOUR_MS
  const slot = Math.floor(tMs / slotMs)
  const slots = Math.ceil(lookbackHours / cfg.everyHours) + 1
  const out: Array<{ at: number; size: number }> = []
  for (let i = 0; i < slots; i++) {
    const s = slot - i
    if (hash01(`${key}:slot:${s}`) >= cfg.probability) continue
    const at = s * slotMs + hash01(`${key}:slot:${s}:offset`) * (slotMs - 1)
    // Not every event is the same size (a light shower vs. a full flood)
    const size = 0.55 + 0.45 * hash01(`${key}:slot:${s}:size`)
    if (at <= tMs) out.push({ at, size })
  }
  return out
}

/**
 * Summed response of all recent events: each one ramps up over `riseHours`
 * (water soaking in, granules dissolving) and then decays exponentially.
 */
function eventResponse(
  key: string,
  tMs: number,
  cfg: EventSchedule,
  riseHours: number,
  decayHours: number,
): number {
  let total = 0
  for (const e of eventsBefore(key, tMs, cfg, decayHours * 5)) {
    const dtH = (tMs - e.at) / HOUR_MS
    total +=
      e.size * (1 - Math.exp(-dtH / riseHours)) * Math.exp(-dtH / decayHours)
  }
  return total
}

/* ------------------------------ Core generator ----------------------------- */

/** Per-reading measurement + spot-to-spot scatter (1 σ) */
const NOISE: Record<ParamKey, number> = {
  ph: 0.04,
  ec: 0.03,
  moisture: 0.6,
  temperature: 0.2,
  nitrogen: 2.2,
  phosphorus: 1.2,
  potassium: 3.5,
}

const bandMid = ([lo, hi]: [number, number]) => (lo + hi) / 2
const bandHalf = ([lo, hi]: [number, number]) => (hi - lo) / 2

/** Local hour of day in Asia/Colombo (UTC+5:30) */
function localHour(tMs: number): number {
  return (((tMs / HOUR_MS + 5.5) % 24) + 24) % 24
}

/**
 * Asymmetric day curve in [-1, 1]: minimum at `minHour`, a fairly quick
 * warm-up to `peakHour`, then a long slow cool-down through the night —
 * the way soil temperature actually behaves.
 */
function dayCurve(tMs: number, minHour: number, peakHour: number): number {
  const rise = peakHour - minHour
  const d = (((localHour(tMs) - minHour) % 24) + 24) % 24
  return d < rise
    ? -Math.cos((Math.PI * d) / rise)
    : Math.cos((Math.PI * (d - rise)) / (24 - rise))
}

/** Sun-driven evaporation weight: 0 at night, peaking early afternoon */
function sunWeight(tMs: number): number {
  const h = localHour(tMs)
  return h < 6.5 || h > 18.5 ? 0 : Math.sin(((h - 6.5) / 12) * Math.PI)
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

/** Clamp that eases into the limits instead of producing flat plateaus */
function softClamp(v: number, lo: number, hi: number, margin: number): number {
  if (v > hi) return hi + margin * Math.tanh((v - hi) / margin)
  if (v < lo) return lo - margin * Math.tanh((lo - v) / margin)
  return v
}

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
 *
 * The parameters are coupled the way they are in a real field: irrigation
 * wets and cools the soil, wetter soil reads higher bulk EC and NPK,
 * fertiliser raises EC and urea briefly acidifies the soil, and cloudy
 * days flatten the temperature curve.
 */
export function simulatePlotValues(
  plot: PlotProfile,
  probeId: string,
  at: Date,
): SensorValues {
  const t = at.getTime()
  const b = plot.bands
  const rnd = mulberry32(hashString(`${probeId}:${plot.id}:${t}`))
  /** Fixed calibration offset of this particular probe */
  const bias = (param: ParamKey) =>
    (hash01(`${probeId}:bias:${param}`) * 2 - 1) * NOISE[param] * 0.8
  const noisy = (param: ParamKey, v: number) =>
    v + bias(param) + gaussian(rnd) * NOISE[param]
  const key = (s: string) => `${plot.id}:${s}`

  /* Moisture: dries down between irrigation / rain events */
  const [mLo, mHi] = b.moisture
  const mRange = mHi - mLo
  const wetting = eventResponse(
    key('irrigation'),
    t,
    plot.irrigation,
    0.75,
    plot.irrigation.decayHours,
  )
  let moisture =
    mLo +
    mRange * 0.28 +
    mRange * 0.26 * drift(key('moisture'), t, 40, 9, 0.3) +
    plot.irrigation.boost * wetting -
    1.6 * sunWeight(t)
  moisture = softClamp(moisture, mLo - 2, mHi + 4, 2)
  /** -0.5 … +0.5 relative wetness, used to couple the other parameters */
  const wet = (moisture - bandMid(b.moisture)) / mRange

  /* Temperature: daily mean drifts with the weather, clouds damp the swing */
  const sunny = 0.5 + 0.5 * (valueNoise(key('cloud'), t, 20) * 0.5 + 0.5)
  let temperature =
    bandMid(b.temperature) +
    bandHalf(b.temperature) *
      0.45 *
      drift(key('temperature'), t, 60, 14, 0.25) +
    (sunny - 0.75) * 2.5 +
    plot.diurnalAmp * sunny * dayCurve(t, 6, 14.5) -
    1.8 * wetting
  temperature = softClamp(
    temperature,
    b.temperature[0] - 2,
    b.temperature[1] + 2,
    1,
  )

  /* Fertiliser applications (granules dissolve over a few hours) */
  const fert = (name: string) =>
    eventResponse(key(name), t, plot.fertiliser, 4, plot.fertiliser.decayHours)
  const urea = fert('urea')
  const tsp = fert('tsp')
  const mop = fert('mop')

  /* pH: very slow drift; urea hydrolysis gives a short acid dip */
  const ph =
    bandMid(b.ph) +
    bandHalf(b.ph) * 1.4 * drift(key('ph'), t, 72, 18, 0.2) -
    0.12 * urea

  /* EC: follows soil water and dissolved fertiliser salts */
  const ec =
    bandMid(b.ec) +
    bandHalf(b.ec) * 1.3 * drift(key('ec'), t, 50, 12, 0.25) +
    bandHalf(b.ec) * 0.5 * wet +
    bandHalf(b.ec) * 0.25 * (urea + mop)

  /* NPK: slow drift + fertiliser pulses; probe readings scale with wetness */
  const npk = (
    param: 'nitrogen' | 'phosphorus' | 'potassium',
    pulse: number,
    boost: number,
  ) =>
    (bandMid(b[param]) +
      bandHalf(b[param]) * 1.3 * drift(key(param), t, 48, 10, 0.25) +
      boost * pulse) *
    (1 + 0.22 * wet)

  const raw: Record<ParamKey, number> = {
    ph,
    ec,
    moisture,
    temperature,
    nitrogen: npk('nitrogen', urea, 32),
    phosphorus: npk('phosphorus', tsp, 11),
    potassium: npk('potassium', mop, 24),
  }

  const result = {} as Record<ParamKey, number>
  for (const param of Object.keys(raw) as ParamKey[]) {
    const band = b[param]
    const half = bandHalf(band)
    const v = softClamp(
      noisy(param, raw[param]),
      band[0] - Math.min(half * 0.25, 1.5),
      band[1] + Math.min(half * 0.3, 4),
      Math.max(half * 0.08, 0.02),
    )
    result[param] = roundFor(param, v)
  }

  return {
    ph: result.ph,
    ec: Math.max(0, result.ec),
    moisture: result.moisture,
    temperature: result.temperature,
    nitrogen: result.nitrogen,
    phosphorus: result.phosphorus,
    potassium: result.potassium,
  }
}

/* ------------------------------- Probe walk -------------------------------- */

/** Readings a probe takes on one plot before the operator moves on */
const DWELL_MIN = 6 // 3 h at 30-min cadence
const DWELL_SPREAD = 13 // up to 9 h

/**
 * The plot the probe's `readingIndex`-th placement lands on. The operator
 * works one plot for a session (several readings at spots around it)
 * before carrying the probe to the next plot on the route, so each plot
 * shows up as a continuous stretch in the chart rather than alternating
 * on every reading.
 */
export function probeRouteAt(
  probe: ProbeProfile,
  readingIndex: number,
): PlotProfile {
  let start = 0
  let visit = 0
  for (;;) {
    const len =
      DWELL_MIN +
      Math.floor(hash01(`${probe.id}:dwell:${visit}`) * DWELL_SPREAD)
    if (readingIndex < start + len) break
    start += len
    visit++
  }
  const plotId = probe.route[visit % probe.route.length]!
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

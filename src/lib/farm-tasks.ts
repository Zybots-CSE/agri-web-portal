import type { ParamKey, StatusLevel } from '#/lib/sensor-rules'
import {
  SENSOR_PARAMS,
  STATUS_RANK,
  formatValue,
  statusForValue,
} from '#/lib/sensor-rules'
import type { ReadingDTO } from '#/lib/server/queries'

/**
 * Turns raw sensor readings into a plain-language to-do list for the farmer:
 * the latest reading of every sampling spot is checked against the hard
 * rules, and every flagged parameter becomes an action ("Water these
 * fields") grouped across all the spots that need it.
 */

export type TaskId = `${ParamKey}-low` | `${ParamKey}-high` | 'recheck'

export type TaskSpot = {
  spot: string
  level: StatusLevel
  /** Reading behind this spot's flag, e.g. "pH 4.82" */
  reading: string
  readingId: number
  recordedAt: string
}

export type FarmTask = {
  id: TaskId
  /** Unique per set of readings — a new reading that still flags re-opens the task */
  key: string
  level: StatusLevel
  title: string
  why: string
  spots: TaskSpot[]
}

type ActionCopy = { title: string; why: string }

const ACTIONS: Partial<Record<TaskId, ActionCopy>> = {
  'ph-low': {
    title: 'Spread agricultural lime (dolomite)',
    why: 'Soil is too acidic — crops cannot take up the fertiliser already in the ground.',
  },
  'ph-high': {
    title: 'Work in compost or organic matter',
    why: 'Soil is too alkaline — iron and zinc get locked up and leaves may yellow.',
  },
  'ec-high': {
    title: 'Flush salts with fresh water & clear drains',
    why: 'Salt is building up in the soil and stressing the crop roots.',
  },
  'moisture-low': {
    title: 'Water these fields',
    why: 'Soil is drying out — plants will start to wilt without irrigation.',
  },
  'moisture-high': {
    title: 'Open drains and stop irrigating',
    why: 'Soil is waterlogged — roots are short of air and nutrients wash away.',
  },
  'temperature-low': {
    title: 'Hold off on fertiliser until the soil warms',
    why: 'Cold soil slows roots and soil life, so fertiliser is used poorly.',
  },
  'temperature-high': {
    title: 'Mulch or irrigate to cool the soil',
    why: 'Soil is hot enough to stress or damage roots.',
  },
  'nitrogen-low': {
    title: 'Apply Urea (nitrogen)',
    why: 'Nitrogen is low — expect pale leaves and slow growth.',
  },
  'nitrogen-high': {
    title: 'Skip the next Urea dose',
    why: 'There is already too much nitrogen — risk of lodging and leaching.',
  },
  'phosphorus-low': {
    title: 'Apply TSP (phosphorus)',
    why: 'Phosphorus is low — roots and flowering will be weak.',
  },
  'phosphorus-high': {
    title: 'Skip the next TSP dose',
    why: 'There is already plenty of phosphorus — extra just runs off.',
  },
  'potassium-low': {
    title: 'Apply MOP (potash)',
    why: 'Potassium is low — crops get weak stems and poor grain or fruit fill.',
  },
  'potassium-high': {
    title: 'Skip the next MOP dose',
    why: 'There is already plenty of potassium in the soil.',
  },
}

const RECHECK: ActionCopy = {
  title: 'Take a fresh probe reading',
  why: 'No reading in the last day — the advice for these spots may be out of date.',
}

/** Spots without a reading for this long get a "re-check" task */
export const STALE_AFTER_HOURS = 24

const PARAM_ORDER: ParamKey[] = [
  'moisture',
  'ec',
  'ph',
  'nitrogen',
  'phosphorus',
  'potassium',
  'temperature',
]

function direction(key: ParamKey, value: number): 'low' | 'high' {
  const ok = SENSOR_PARAMS[key].zones.find((z) => z.level === 'ok')
  return ok && value < ok.from ? 'low' : 'high'
}

/** Latest reading for every labelled spot (unlabelled readings are skipped) */
function latestPerSpot(readings: ReadingDTO[]): ReadingDTO[] {
  const bySpot = new Map<string, ReadingDTO>()
  for (const r of readings) {
    if (!r.spot) continue
    const prev = bySpot.get(r.spot)
    if (!prev || Date.parse(r.recordedAt) >= Date.parse(prev.recordedAt)) {
      bySpot.set(r.spot, r)
    }
  }
  return [...bySpot.values()]
}

export function buildFarmTasks(
  readings: ReadingDTO[],
  now = Date.now(),
): FarmTask[] {
  const groups = new Map<TaskId, TaskSpot[]>()
  const add = (id: TaskId, spot: TaskSpot) => {
    const list = groups.get(id) ?? []
    list.push(spot)
    groups.set(id, list)
  }

  for (const r of latestPerSpot(readings)) {
    const spot = r.spot!
    for (const key of PARAM_ORDER) {
      const param = SENSOR_PARAMS[key]
      const status = statusForValue(param, r[key])
      if (status.level === 'ok') continue
      add(`${key}-${direction(key, r[key])}`, {
        spot,
        level: status.level,
        reading: `${param.short} ${formatValue(param, r[key])}${param.unit ? ` ${param.unit}` : ''}`,
        readingId: r.id,
        recordedAt: r.recordedAt,
      })
    }
    if (now - Date.parse(r.recordedAt) > STALE_AFTER_HOURS * 3600_000) {
      add('recheck', {
        spot,
        level: 'warn',
        reading: 'No recent reading',
        readingId: r.id,
        recordedAt: r.recordedAt,
      })
    }
  }

  const tasks: FarmTask[] = []
  for (const [id, spots] of groups) {
    const copy = id === 'recheck' ? RECHECK : ACTIONS[id]
    if (!copy) continue
    spots.sort(
      (a, b) =>
        STATUS_RANK[b.level] - STATUS_RANK[a.level] ||
        a.spot.localeCompare(b.spot),
    )
    const level = spots[0]!.level
    tasks.push({
      id,
      key: `${id}:${spots
        .map((s) => s.readingId)
        .sort((a, b) => a - b)
        .join(',')}`,
      level,
      ...copy,
      spots,
    })
  }

  const order = (t: FarmTask) =>
    t.id === 'recheck'
      ? PARAM_ORDER.length
      : PARAM_ORDER.indexOf(t.id.split('-')[0] as ParamKey)
  return tasks.sort(
    (a, b) =>
      STATUS_RANK[b.level] - STATUS_RANK[a.level] ||
      order(a) - order(b) ||
      b.spots.length - a.spots.length,
  )
}

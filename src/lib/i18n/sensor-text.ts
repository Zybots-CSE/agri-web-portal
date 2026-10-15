import { useMemo } from 'react'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import type { I18n, MessageDescriptor } from '@lingui/core'

import type { ParamKey, SensorParam } from '#/lib/sensor-rules'

/**
 * Translations for text that lives in plain data modules.
 *
 * `sensor-rules.ts` and `sensor-sim.ts` are also used by the ingest API and
 * the `db:seed` script (run with tsx, where Lingui macros are not compiled),
 * so their English strings stay as-is and are translated here at render
 * time instead.
 */

const PARAM_TEXT: Record<
  ParamKey,
  {
    label: MessageDescriptor
    short: MessageDescriptor
    purpose: MessageDescriptor
  }
> = {
  ph: {
    label: msg`Soil Reaction (pH)`,
    short: msg`pH`,
    purpose: msg`Hard rule filter (Step 1) and dolomite/liming calculation. Triggers nutrient lockout flags below 5.0.`,
  },
  ec: {
    label: msg`Electrical Conductivity`,
    short: msg`EC`,
    purpose: msg`Hard rule filter (Step 1). Identifies salinity stress in Dry Zone command areas (> 2.0 dS/m).`,
  },
  moisture: {
    label: msg`Soil Moisture (VWC)`,
    short: msg`Moisture`,
    purpose: msg`Drainage checks. Distinguishes waterlogged lowland paddy soil from well-drained upland soil.`,
  },
  temperature: {
    label: msg`Soil Temperature`,
    short: msg`Temp`,
    purpose: msg`Corrects raw EC and pH drift before feeding values into algorithms.`,
  },
  nitrogen: {
    label: msg`Nitrogen (N)`,
    short: msg`N`,
    purpose: msg`Step 2 ML model input and direct target deficit calculation (ΔN) for Urea recommendations.`,
  },
  phosphorus: {
    label: msg`Phosphorus (P)`,
    short: msg`P`,
    purpose: msg`Step 2 ML model input and direct target deficit calculation (ΔP) for TSP recommendations.`,
  },
  potassium: {
    label: msg`Potassium (K)`,
    short: msg`K`,
    purpose: msg`Step 2 ML model input and direct target deficit calculation (ΔK) for MOP recommendations.`,
  },
}

/** Keyed by the exact English text used in the data modules */
const KNOWN_TEXT: Record<string, MessageDescriptor> = {
  // sensor-rules.ts zone labels
  'Nutrient lockout risk (below pH 5.0)': msg`Nutrient lockout risk (below pH 5.0)`,
  'Acidic — liming recommended': msg`Acidic — liming recommended`,
  'Optimal for most crops': msg`Optimal for most crops`,
  'Alkaline — check micronutrients': msg`Alkaline — check micronutrients`,
  'Strongly alkaline': msg`Strongly alkaline`,
  'Non-saline': msg`Non-saline`,
  'Salinity stress (> 2.0 dS/m)': msg`Salinity stress (> 2.0 dS/m)`,
  'Severe salinity — crop failure risk': msg`Severe salinity — crop failure risk`,
  'Severely dry — permanent wilting point': msg`Severely dry — permanent wilting point`,
  'Dry — irrigation advised': msg`Dry — irrigation advised`,
  'Well-drained, field capacity': msg`Well-drained, field capacity`,
  'Saturated — check drainage': msg`Saturated — check drainage`,
  'Waterlogged (lowland paddy conditions)': msg`Waterlogged (lowland paddy conditions)`,
  'Cold stress — slows microbial activity': msg`Cold stress — slows microbial activity`,
  'Optimal root-zone temperature': msg`Optimal root-zone temperature`,
  'Heat stress': msg`Heat stress`,
  'Severe heat — root damage': msg`Severe heat — root damage`,
  'Nitrogen deficient': msg`Nitrogen deficient`,
  'Nitrogen low': msg`Nitrogen low`,
  'Adequate N supply': msg`Adequate N supply`,
  'Nitrogen excessive — lodging / leaching risk': msg`Nitrogen excessive — lodging / leaching risk`,
  'Phosphorus deficient': msg`Phosphorus deficient`,
  'Phosphorus low': msg`Phosphorus low`,
  'Adequate P supply': msg`Adequate P supply`,
  'Phosphorus high — runoff pollution risk': msg`Phosphorus high — runoff pollution risk`,
  'Potassium deficient': msg`Potassium deficient`,
  'Potassium low': msg`Potassium low`,
  'Adequate K supply': msg`Adequate K supply`,
  'Potassium high': msg`Potassium high`,

  // sensor-sim.ts demo farm, plots, crops and probes (stored in the DB)
  'Iluppallama Research Farm': msg`Iluppallama Research Farm`,
  Anuradhapura: msg`Anuradhapura`,
  'Dry Zone': msg`Dry Zone`,
  'Intermediate Zone': msg`Intermediate Zone`,
  'Wet Zone': msg`Wet Zone`,
  'Paddy Block A': msg`Paddy Block A`,
  'Paddy Block B': msg`Paddy Block B`,
  'Maize Field': msg`Maize Field`,
  'Vegetable Plot': msg`Vegetable Plot`,
  'Chilli Nursery': msg`Chilli Nursery`,
  'Orchard Block': msg`Orchard Block`,
  'Compost Yard': msg`Compost Yard`,
  'Fallow Plot': msg`Fallow Plot`,
  'Field spot': msg`Field spot`,
  'Lowland paddy': msg`Lowland paddy`,
  Maize: msg`Maize`,
  'Upcountry vegetables': msg`Upcountry vegetables`,
  Chilli: msg`Chilli`,
  'Mango orchard': msg`Mango orchard`,
  'Compost turning': msg`Compost turning`,
  Fallow: msg`Fallow`,
  'Field crop': msg`Field crop`,
  'Probe 01 · Lowland route': msg`Probe 01 · Lowland route`,
  'Probe 02 · Upland route': msg`Probe 02 · Upland route`,
  'Probe 03 · Perennial route': msg`Probe 03 · Perennial route`,
}

export type SensorText = {
  label: (param: SensorParam) => string
  short: (param: SensorParam) => string
  purpose: (param: SensorParam) => string
  /** Translates a known data string; unknown (user-entered) text is returned unchanged */
  text: (value: string) => string
}

export function sensorText(i18n: I18n): SensorText {
  return {
    label: (p) => i18n._(PARAM_TEXT[p.key].label),
    short: (p) => i18n._(PARAM_TEXT[p.key].short),
    purpose: (p) => i18n._(PARAM_TEXT[p.key].purpose),
    text: (value) => {
      const descriptor = KNOWN_TEXT[value]
      return descriptor ? i18n._(descriptor) : value
    },
  }
}

/** Locale-aware helpers for sensor/demo-data text; re-renders on language change */
export function useSensorText(): SensorText {
  // The context's i18n reference changes whenever the active locale changes
  const { i18n } = useLingui()
  return useMemo(() => sensorText(i18n), [i18n])
}

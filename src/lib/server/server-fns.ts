import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as svc from './queries.ts'

/** Dashboard: all devices with latest reading + reading count */
export const getDevices = createServerFn({ method: 'GET' }).handler(() =>
  svc.listDevices(),
)

/** Dashboard: readings of one device over the last `hours`, oldest first */
export const getDeviceReadings = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      deviceId: z.string().min(1),
      hours: z
        .number()
        .int()
        .min(1)
        .max(24 * 30)
        .default(24 * 7),
    }),
  )
  .handler(({ data }) => svc.listReadings(data.deviceId, data.hours))

/** Dashboard: every placement across all probes (map layer), oldest first */
export const getAllReadings = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      hours: z
        .number()
        .int()
        .min(1)
        .max(24 * 30)
        .default(24 * 7),
    }),
  )
  .handler(({ data }) => svc.listAllReadings(data.hours))

/** Dashboard: generate + persist the next simulated reading for a device */
export const simulateNextReading = createServerFn({ method: 'POST' })
  .validator(z.object({ deviceId: z.string().min(1) }))
  .handler(({ data }) => svc.simulateNextReading(data.deviceId))

/** Dashboard: seed the roving demo fleet with a week of readings */
export const seedDemoData = createServerFn({ method: 'POST' }).handler(() =>
  svc.seedDemoData(),
)

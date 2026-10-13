import { createFileRoute } from '@tanstack/react-router'
import { readingIngestSchema } from '#/lib/sensor-rules'
import * as svc from '#/lib/server/queries.ts'

/**
 * Device ingest API — called by the field probe (ESP32/Arduino + RS485 NPK
 * probe, DS18B20, FDR moisture sensor, NEO GPS) over HTTP.
 *
 *   GET  /api/readings?deviceId=AGRI-001&hours=24
 *   POST /api/readings  (JSON body, validated against the SRS sensor ranges)
 */
export const Route = createFileRoute('/api/readings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const deviceId = url.searchParams.get('deviceId') ?? undefined
        const hoursParam = Number.parseInt(
          url.searchParams.get('hours') ?? '168',
          10,
        )
        const hours = Number.isFinite(hoursParam)
          ? Math.min(Math.max(hoursParam, 1), 24 * 30)
          : 168

        const rows = await svc.listReadings(deviceId, hours)
        return Response.json({ count: rows.length, readings: rows })
      },

      POST: async ({ request }) => {
        let raw: unknown
        try {
          raw = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const parsed = readingIngestSchema.safeParse(raw)
        if (!parsed.success) {
          // Step 1 hard-rule filter: out-of-range readings are rejected
          return Response.json(
            {
              error: 'Validation failed — reading rejected by hard rule filter',
              issues: parsed.error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
              })),
            },
            { status: 422 },
          )
        }

        const result = await svc.ingestReading(parsed.data)
        return Response.json(result, { status: 201 })
      },
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'
import { deviceRegistrationSchema } from '#/lib/sensor-rules'
import * as svc from '#/lib/server/queries.ts'

/**
 * Device registry API.
 *
 *   GET  /api/devices        → list probes with latest reading
 *   POST /api/devices        → register / update a probe (JSON body)
 *
 * POST /api/readings auto-registers unknown probes, so registration is
 * optional — but pre-registering lets you attach district / NRMC region /
 * crop metadata used by the dashboard. Probes are mobile (put → read →
 * move), so no coordinates live here — every reading carries its own
 * GPS fix.
 */
export const Route = createFileRoute('/api/devices')({
  server: {
    handlers: {
      GET: async () => Response.json({ devices: await svc.listDevices() }),

      POST: async ({ request }) => {
        let raw: unknown
        try {
          raw = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const parsed = deviceRegistrationSchema.safeParse(raw)
        if (!parsed.success) {
          return Response.json(
            {
              error: 'Validation failed',
              issues: parsed.error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
              })),
            },
            { status: 422 },
          )
        }

        const device = await svc.registerDevice(parsed.data)
        return Response.json({ device }, { status: 201 })
      },
    },
  },
})

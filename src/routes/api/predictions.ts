import { createFileRoute } from '@tanstack/react-router'
import { predictionSchema } from '#/lib/prediction-schema'
import { listPredictions, savePrediction } from '#/lib/server/predictions'

export const Route = createFileRoute('/api/predictions')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const deviceId =
          new URL(request.url).searchParams.get('deviceId') || undefined
        const predictions = await listPredictions(deviceId)
        return Response.json({ count: predictions.length, predictions })
      },
      POST: async ({ request }) => {
        let raw: unknown
        try {
          raw = await request.json()
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }
        const parsed = predictionSchema.safeParse(raw)
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
        const prediction = await savePrediction(parsed.data)
        return Response.json({ prediction }, { status: 201 })
      },
    },
  },
})

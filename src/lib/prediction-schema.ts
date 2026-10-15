import { z } from 'zod'

// The model supplies its own task label; no crop or model architecture is assumed.
export const predictionSchema = z.object({
  model: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(5000),
  confidence: z.number().min(0).max(1).optional(),
  deviceId: z
    .string()
    .regex(/^[a-zA-Z0-9_.-]{2,40}$/)
    .optional(),
  spot: z.string().trim().min(1).max(80).optional(),
  crop: z.string().trim().min(1).max(80).optional(),
  recommendations: z
    .array(z.string().trim().min(1).max(1000))
    .max(20)
    .default([]),
  predictedAt: z.iso.datetime({ offset: true }).optional(),
})

export type PredictionInput = z.infer<typeof predictionSchema>

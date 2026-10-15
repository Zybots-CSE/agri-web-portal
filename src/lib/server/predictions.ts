import { and, desc, eq } from 'drizzle-orm'
import { db } from '#/db'
import { predictions } from '#/db/schema'
import type { PredictionInput } from '#/lib/prediction-schema'

function toDTO(row: typeof predictions.$inferSelect) {
  return {
    ...row,
    predictedAt: row.predictedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listPredictions(deviceId?: string, closed?: boolean) {
  const rows = await db
    .select()
    .from(predictions)
    .where(
      and(
        deviceId ? eq(predictions.deviceId, deviceId) : undefined,
        closed === undefined ? undefined : eq(predictions.closed, closed),
      ),
    )
    .orderBy(desc(predictions.createdAt), desc(predictions.id))
    .limit(100)
  return rows.map(toDTO)
}

export async function savePrediction(input: PredictionInput) {
  const [row] = await db
    .insert(predictions)
    .values({
      ...input,
      predictedAt: input.predictedAt ? new Date(input.predictedAt) : new Date(),
    })
    .returning()
  return toDTO(row!)
}

export async function setPredictionClosed(id: number, closed: boolean) {
  const [row] = await db
    .update(predictions)
    .set({ closed })
    .where(eq(predictions.id, id))
    .returning()
  if (!row) throw new Error('Prediction not found')
  return toDTO(row)
}

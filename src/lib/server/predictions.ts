import { desc, eq } from 'drizzle-orm'
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

export async function listPredictions(deviceId?: string) {
  const rows = await db
    .select()
    .from(predictions)
    .where(deviceId ? eq(predictions.deviceId, deviceId) : undefined)
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

export async function deletePrediction(id: number) {
  await db.delete(predictions).where(eq(predictions.id, id))
  return { id }
}

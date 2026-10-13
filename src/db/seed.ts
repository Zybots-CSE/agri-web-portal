/**
 * Seed the SQLite database with the 6-device demo fleet:
 * seven days of 30-minute readings per device.
 *
 *   npm run db:seed
 */
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })
process.env.DATABASE_URL ??= 'dev.db'

const { seedDemoData } = await import('../lib/server/queries.ts')

const result = await seedDemoData()
console.log(
  `Seeded ${result.devices} devices with ${result.readings} readings (7 days @ 30 min).`,
)
process.exit(0)

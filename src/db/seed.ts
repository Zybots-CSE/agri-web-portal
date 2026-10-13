/**
 * Seed the SQLite database with the demo fleet: three roving probes
 * walking the eight plots of the demo farm — seven days of 30-minute
 * readings per probe.
 *
 *   npm run db:seed
 */
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })
process.env.DATABASE_URL ??= 'dev.db'

const { seedDemoData } = await import('../lib/server/queries.ts')

const result = await seedDemoData()
console.log(
  `Seeded ${result.devices} roving probes with ${result.readings} readings (7 days @ 30 min).`,
)
process.exit(0)

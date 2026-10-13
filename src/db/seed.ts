/**
 * Seed the Postgres database with the demo fleet: three roving probes
 * walking the eight plots of the demo farm — seven days of 30-minute
 * readings per probe.
 *
 *   npm run db:seed
 */
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set — add the Neon connection string to .env.local',
  )
  process.exit(1)
}

const { seedDemoData } = await import('../lib/server/queries.ts')

const result = await seedDemoData()
console.log(
  `Seeded ${result.devices} roving probes with ${result.readings} readings (7 days @ 30 min).`,
)
process.exit(0)

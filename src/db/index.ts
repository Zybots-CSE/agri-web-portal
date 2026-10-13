import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema.ts'

// Neon serverless Postgres, connected over TLS with the pooled connection
// string in DATABASE_URL (…-pooler.neon.tech). A small pool is plenty for
// the dashboard and keeps serverless invocations from exhausting
// connections.
export const db = drizzle(
  postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 10 }),
  { schema },
)

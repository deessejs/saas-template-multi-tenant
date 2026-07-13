import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { serverEnv } from "@workspace/env/server"
import * as schema from "./schema/index.js"

// Serverless-friendly defaults:
//   prepare: false  → required behind PgBouncer / Neon pooler (extended-query
//                     protocol incompatible with transaction-mode pooling).
//   max: 10         → cap per Lambda/worker. Tune to provider limits.
//   idle_timeout: 60 → Neon serverless compute suspends after 5 min inactivity.
//                    20 s was too aggressive; ECONNRESET from the pooler killed connections.
//   max_lifetime: 1800 → recycle connections every 30 min to stay fresh.
//
// Lazy initialization: the pool is only created when `db` is first accessed.
// When DATABASE_URL is not set (e.g. `pnpm auth:generate`), a dummy object is
// returned so imports succeed without crashing.

type Db = PostgresJsDatabase<typeof schema>

let _db: Db | null = null

function getDb(): Db {
	if (_db) return _db
	if (!serverEnv.DATABASE_URL) {
		// CLI context: return a passthrough object so imports don't crash.
		// Real usage always has DATABASE_URL set.
		_db = {} as Db
	} else {
		const pool = postgres(serverEnv.DATABASE_URL, {
			prepare: false,
			max: 10,
			idle_timeout: 60,
			max_lifetime: 60 * 30,
		})
		_db = drizzle(pool, { schema })
	}
	return _db
}

// Accessor — consumers use `db`, never `_db`. The Proxy defers pool creation
// until a property is actually accessed (e.g. by drizzle queries at runtime).
export const db = new Proxy({} as Db, {
	get(_target, prop) {
		const instance = getDb() as unknown as Record<string | symbol, unknown>
		return instance[prop as string | symbol]
	},
})
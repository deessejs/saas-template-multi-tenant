import { PGlite } from "@electric-sql/pglite"
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite"
// `drizzle-kit/api` is the 0.31 path; bump to `drizzle-kit/api-postgres`
// when drizzle-kit >= 1.0 (see drizzle-team/drizzle-orm#4205).
import { pushSchema } from "drizzle-kit/api"
import * as schema from "./schema/index.js"

export type Drizzle = PgliteDatabase<typeof schema>

let _testDb: Drizzle | null = null
let _pglite: PGlite | null = null

/**
 * Build an isolated in-memory test database backed by PGlite (real Postgres
 * compiled to WASM — not emulation). Lazy: the PGlite + Drizzle client are
 * created on first call and reused for the rest of the test run.
 *
 * Schema is pushed programmatically via `pushSchema`, reading the same
 * `schema/index.ts` the production runtime uses. No manual SQL, no drift.
 *
 * Limitations: PGlite has a single WASM connection. Running transactions
 * in parallel (`Promise.all([tx1, tx2])`) will deadlock. Serialize them.
 *
 * Pattern: call once in `beforeAll`, clean up in `afterAll` via `cleanup()`.
 */
export const setupTestDb = async (): Promise<Drizzle> => {
  if (_testDb) return _testDb
  _pglite = new PGlite()
  _testDb = drizzle(_pglite, { schema })
  const { apply } = await pushSchema(
    schema,
    _testDb as unknown as Parameters<typeof pushSchema>[1],
  )
  await apply()
  return _testDb
}

/** Close the PGlite instance. Idempotent. Safe to call from `afterAll`. */
export const cleanup = async (): Promise<void> => {
  if (_pglite) {
    await _pglite.close()
    _pglite = null
  }
  _testDb = null
}

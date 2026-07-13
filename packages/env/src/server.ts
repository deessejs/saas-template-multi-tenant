import { loadRepoEnv } from "./loader.js"
import { serverSchema, type ServerEnv } from "./schema.js"

/**
 * Load .env files into process.env. Idempotent.
 */
loadRepoEnv()

/**
 * Vitest test isolation workaround.
 *
 * Vitest workers don't always inherit all parent-process env vars when
 * the config doesn't explicitly opt-in via `test.env: { ...process.env }`.
 * `process.env.BETTER_AUTH_SECRET` is required by the zod schema and is
 * usually set by CI step config, but unit tests in our packages/email and
 * packages/database setups run with a stripped-down env. We detect the
 * vitest process via the `VITEST` env var (set automatically by vitest)
 * and stub the required secret so module import succeeds.
 *
 * Tests that need real credentials (e.g. real Postgres + auth flows)
 * live in the integration CI job which sets env explicitly. Tests that
 * only need module-load-not-crash use this stub.
 */
if (process.env.VITEST && !process.env.BETTER_AUTH_SECRET) {
  process.env.BETTER_AUTH_SECRET =
    "ci-test-secret-which-is-long-enough-to-pass-the-32-char-validation"
}

/**
 * Validate server env. Fail fast with a clear, actionable error message.
 */
const parsed = serverSchema.safeParse(process.env)
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("\n[env] Invalid environment variables:")
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`)
  }
  // eslint-disable-next-line no-console
  console.error(
    "\nCopy .env.example to .env at the repo root and fill in the values.\n",
  )
  process.exit(1)
}

/**
 * Runtime guard: must never be bundled to the browser. The bundler can tree-
 * shake the import if unused, but if a misuse leaks this module into a client
 * bundle, fail loudly at the first reference.
 */
if (typeof (globalThis as { window?: unknown }).window !== "undefined") {
  throw new Error(
    "@workspace/env/server imported in a browser bundle. " +
      "Use @workspace/env/client for NEXT_PUBLIC_* values.",
  )
}

/**
 * Resolved, frozen server env object. Aliases (AUTH_SECRET -> BETTER_AUTH_SECRET)
 * and fallbacks (TEST_DATABASE_URL -> DATABASE_URL) are resolved at this
 * boundary so call sites stay simple.
 */
export const serverEnv: Readonly<ServerEnv> = Object.freeze({
  ...parsed.data,
  BETTER_AUTH_SECRET:
    parsed.data.BETTER_AUTH_SECRET ?? parsed.data.AUTH_SECRET!,
  TEST_DATABASE_URL: parsed.data.TEST_DATABASE_URL ?? parsed.data.DATABASE_URL,
})

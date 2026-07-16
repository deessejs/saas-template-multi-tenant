import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { sql } from "drizzle-orm"
import * as schema from "../src/schema/index.js"
import { setupTestDb, cleanup, type Drizzle } from "../src/test-utils.js"

let db: Drizzle

beforeAll(async () => {
  db = await setupTestDb()
})

afterAll(async () => {
  await cleanup()
})

describe("database schema", () => {
  describe("table definitions", () => {
    it("exports user with required columns", () => {
      expect(schema.user.id).toBeDefined()
      expect(schema.user.email).toBeDefined()
      expect(schema.user.name).toBeDefined()
      expect(schema.user.emailVerified).toBeDefined()
    })

    it("exports session, account, verification", () => {
      expect(schema.session.id).toBeDefined()
      expect(schema.session.token).toBeDefined()
      expect(schema.session.userId).toBeDefined()
      expect(schema.account.id).toBeDefined()
      expect(schema.account.providerId).toBeDefined()
      expect(schema.verification.identifier).toBeDefined()
      expect(schema.verification.value).toBeDefined()
    })
  })

  describe("relations", () => {
    it("exports user/session/account relations", () => {
      expect(schema.userRelations).toBeDefined()
      expect(schema.sessionRelations).toBeDefined()
      expect(schema.accountRelations).toBeDefined()
    })
  })

  describe("runtime sanity (PGlite-backed)", () => {
    it("runs a SELECT 1 against PGlite", async () => {
      await expect(db.execute(sql`SELECT 1 as ok`)).resolves.toBeDefined()
    })
  })
})

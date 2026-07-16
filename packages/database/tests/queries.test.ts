import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { setupTestDb, cleanup, type Drizzle } from "../src/test-utils.js"
import * as schema from "../src/schema/index.js"

let db: Drizzle

beforeAll(async () => {
  db = await setupTestDb()
})

afterAll(async () => {
  await cleanup()
})

describe("user CRUD against PGlite", () => {
  it("inserts and reads a user back", async () => {
    const id = "user_test_1"
    await db.insert(schema.user).values({
      id,
      name: "Alice",
      email: "alice@example.com",
      emailVerified: false,
    })

    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, id))
    expect(row?.email).toBe("alice@example.com")
    expect(row?.name).toBe("Alice")
    expect(row?.emailVerified).toBe(false)
  })

  it("enforces email uniqueness", async () => {
    const email = "bob@example.com"
    await db.insert(schema.user).values({
      id: "user_test_2",
      name: "Bob",
      email,
      emailVerified: false,
    })

    await expect(
      db.insert(schema.user).values({
        id: "user_test_3",
        name: "Bob2",
        email,
        emailVerified: false,
      }),
    ).rejects.toThrow()
  })
})

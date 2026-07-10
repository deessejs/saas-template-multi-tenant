import { describe, expect, it } from "vitest"
import { deriveSlug, findAvailableSlug, SlugDerivationError } from "./slug"

// `isSlugAvailable` is intentionally not unit-tested here — it requires the
// better-auth client and a network call. Covered by integration / manual QA.

describe("deriveSlug", () => {
  it("slugifies a normal org name", () => {
    expect(deriveSlug("Acme Inc.")).toBe("acme-inc")
  })

  it("trims surrounding whitespace", () => {
    expect(deriveSlug("  Acme Inc.  ")).toBe("acme-inc")
  })

  it("transliterates diacritics", () => {
    expect(deriveSlug("café")).toBe("cafe")
  })

  it("throws on all-emoji input", () => {
    expect(() => deriveSlug("🎉🎉🎉")).toThrow(SlugDerivationError)
    expect(() => deriveSlug("🎉🎉🎉")).toThrow(/Cannot derive a usable slug/)
  })

  it("throws on whitespace-only input", () => {
    expect(() => deriveSlug("   ")).toThrow(SlugDerivationError)
  })

  it("throws on too-short input (after slugify)", () => {
    expect(() => deriveSlug("a")).toThrow(SlugDerivationError)
  })

  it("throws on empty input", () => {
    expect(() => deriveSlug("")).toThrow(SlugDerivationError)
  })

  it("truncates long input to 48 chars without trailing dash", () => {
    const long = "a".repeat(100)
    const result = deriveSlug(long)
    expect(result.length).toBeLessThanOrEqual(48)
    expect(result.endsWith("-")).toBe(false)
  })

  it("SlugDerivationError exposes code SLUG_DERIVATION_FAILED", () => {
    try {
      deriveSlug("🎉")
    } catch (error) {
      expect(error).toBeInstanceOf(SlugDerivationError)
      expect((error as SlugDerivationError).code).toBe("SLUG_DERIVATION_FAILED")
    }
  })
})

describe("findAvailableSlug", () => {
  it("returns the base slug if available", async () => {
    const result = await findAvailableSlug("acme", async () => true)
    expect(result).toBe("acme")
  })

  it("returns acme-2 if base is taken", async () => {
    const taken = new Set(["acme"])
    const isAvailable = async (s: string) => !taken.has(s)
    const result = await findAvailableSlug("acme", isAvailable)
    expect(result).toBe("acme-2")
  })

  it("returns acme-3 if base and acme-2 are taken", async () => {
    const taken = new Set(["acme", "acme-2"])
    const isAvailable = async (s: string) => !taken.has(s)
    const result = await findAvailableSlug("acme", isAvailable)
    expect(result).toBe("acme-3")
  })

  it("throws SlugDerivationError after RETRY_CAP (5) attempts", async () => {
    const isAvailable = async () => false
    await expect(findAvailableSlug("acme", isAvailable)).rejects.toThrow(SlugDerivationError)
  })
})
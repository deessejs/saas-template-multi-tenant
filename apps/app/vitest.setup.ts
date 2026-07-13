import { vi } from "vitest"

// Stub DATABASE_URL so the @workspace/database module loads without a real
// connection. Tests that exercise @workspace/auth transitively must have
// this env var set.
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test"

// Mock `next/headers`. Functions that call headers() will fail without this
// ("headers() should be called inside a server component"). Any test that
// hits a code path awaiting `headers()` (directly or via getSession /
// getActiveOrgSlug / etc.) needs this mock in place.
vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue(new Headers()),
}))

// Mock `@workspace/auth` so its exports are available without a real DB.
// Individual tests can override the mock to return specific values via
// `vi.mocked(auth.api.getSession).mockResolvedValue(...)`.
vi.mock("@workspace/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
			listOrganizations: vi.fn(),
			setActiveOrganization: vi.fn(),
		},
	},
}))

// Mock the client auth client. Tests that need a specific shape should
// override per-test with `vi.mock("@/lib/auth-client", () => ({...}))`.
vi.mock("@/lib/auth-client", () => ({
	authClient: {
		organization: {
			checkSlug: vi.fn(),
			create: vi.fn(),
			setActive: vi.fn(),
		},
		useActiveOrganization: vi.fn(),
		useListOrganizations: vi.fn(),
		useSession: vi.fn(),
	},
}))
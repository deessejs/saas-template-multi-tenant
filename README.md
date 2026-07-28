<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/banner-ds.jpg">
    <source media="(prefers-color-scheme: light)" srcset="public/banner-ds.jpg">
    <img src="public/banner-ds.jpg" alt="SaaS Template Multi-Tenant banner" width="900">
  </picture>
</p>

<h1 align="center">SaaS Template - Multi-Tenant</h1>

<p align="center">
  <strong>Production-ready multi-tenant SaaS starter.</strong>
  Next.js 16 · Better Auth with Organization plugin · Drizzle · Tailwind v4 · Deploy in minutes.
</p>

<p align="center">
  <a href="https://github.com/deessejs/saas-template-multi-tenant/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/deessejs/saas-template-multi-tenant" alt="License">
  </a>
  <a href="https://github.com/deessejs/saas-template-multi-tenant/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/deessejs/saas-template-multi-tenant/ci.yml?label=CI" alt="CI">
  </a>
  <a href="https://github.com/deessejs/saas-template-multi-tenant/stargazers">
    <img src="https://img.shields.io/github/stars/deessejs/saas-template-multi-tenant?style=social" alt="Stars">
  </a>
</p>

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdeessejs%2Fsaas-template-multi-tenant">
    <img src="https://vercel.com/button" alt="Deploy with Vercel">
  </a>
  <a href="https://github.com/deessejs/saas-template-multi-tenant/codespaces/new">
    <img src="https://github.com/codespaces/badge.svg" alt="Open in GitHub Codespaces">
  </a>
</p>

> 👉 **Looking for the single-tenant version?** See [`deessejs/saas-template`](https://github.com/deessejs/saas-template) - the same monorepo architecture without the Organization plugin, for users who don't need workspaces.

---

## What's included

| Layer | What you get | Why it matters |
|---|---|---|
| **Multi-tenant by default** | Organization plugin wired in `@workspace/auth` with invite-only memberships. Tenants are created via `auth.api.createOrganization` or invitations, never auto-created on signup. | Real workspaces out of the box, without a single-tenant retrofit later. |
| **Apps** | `apps/web` (marketing), `apps/app` (authenticated product), `apps/docs` (Fumadocs) | Three deployable surfaces, each with its own purpose and URL. |
| **Auth** | `packages/auth` - Better Auth + Drizzle adapter, email verification, password reset, Organization plugin | Production gating in `apps/app/proxy.ts`, not a demo flow. |
| **API** | `packages/api` - Hono + oRPC, end-to-end typed routes | Type-safe RPC without GraphQL schemas. |
| **Database** | `packages/database` - Drizzle ORM + Postgres, PGlite-backed test runner (real Postgres in WASM) | Single source of truth for schema; tests run with zero infrastructure. |
| **Email** | `packages/email` - React Email templates with a swappable transport (Console in dev, Resend in prod) | Transactional email that works locally and scales to prod without code changes. |
| **Env** | `packages/env` - Zod-validated env, lazy validation, browser-bundle guard | One schema, no env drift, secrets stay server-side. |
| **UI** | `packages/ui` - shadcn/ui + Tailwind v4, centralized design tokens | One component library, every app reuses it. |
| **Tooling** | pnpm 11 workspaces, Turbo v2, strict catalogs, shared ESLint + TS configs | One command rebuilds, lints, types, tests the whole monorepo. |

## Why this template

- **Multi-tenant by design.** The Organization plugin is wired and the schema is configured for tenants, invitations, and memberships - not bolted on after the fact.
- **Modern, but boring where it matters.** Next.js 16, Tailwind v4, React 19, TypeScript 6. Chosen because they're the default for new SaaS projects today, not because they're novel.
- **Lockfile-clean pnpm catalogs.** All shared versions live in `pnpm-workspace.yaml` with `catalogMode: strict`. No drift between apps.
- **Real auth flow.** Email verification is enforced in the proxy. No "demo" auth.
- **Real database.** Postgres locally (Docker) or in the cloud. Schema is generated, not hand-written.
- **Three apps, one repo.** Marketing, product, docs. Each deployable independently to Vercel.

## Quick start

> [!TIP]
> Don't want to install anything locally? [Open in GitHub Codespaces](https://github.com/deessejs/saas-template-multi-tenant/codespaces/new). PostgreSQL is pre-configured in the dev container.

### Prerequisites

- Node.js **24.x** (`engines.node` enforced)
- pnpm **11+** (`corepack enable` if not installed)
- Docker (for local Postgres). Skip if you point `DATABASE_URL` at a remote DB

### Install and run

```bash
# 1. Clone
git clone https://github.com/deessejs/saas-template-multi-tenant.git
cd saas-template-multi-tenant

# 2. Install dependencies
pnpm install

# 3. Copy environment defaults
cp .env.example .env.local

# 4. Generate the auth schema and push it to your database
pnpm auth:generate
pnpm db:push

# 5. Start every app in dev mode
pnpm dev
```

Each app's default port is in its own README under `apps/*/`. The dev proxy in `apps/app/proxy.ts` trusts `localhost:3000` and `localhost:3001` by default - see `packages/auth/src/auth.ts` for the exact matching.

## Available commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start every app in dev mode |
| `pnpm build` | Build every workspace |
| `pnpm lint` | Lint every workspace |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm test` | Run unit tests (PGlite, no DB or Docker needed) |
| `pnpm db:generate` | Diff schema → write SQL migration |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:push` | Sync schema directly (dev only - never in prod) |
| `pnpm db:studio` | Open Drizzle Studio in the browser |
| `pnpm auth:generate` | Regenerate Better Auth schema in `packages/database/src/schema/auth.ts` |
| `pnpm env:check` | Validate that all required env vars are present |
| `pnpm dedupe:check` | Detect duplicated dependencies |

## Environment variables

| Variable | Required | Where | Purpose |
|---|---|---|---|
| `BETTER_AUTH_URL` | Yes | server | Public URL where auth runs |
| `BETTER_AUTH_SECRET` | Yes | server | Min 32 chars. Generate: `openssl rand -base64 32` |
| `DATABASE_URL` | Yes | server | Postgres connection string |
| `ALLOWED_ORIGINS` | No | server | CSV of trusted origins for CSRF |
| `MAIL_TRANSPORT` | No | server | `console` (default) or `resend` |
| `RESEND_API_KEY` | Prod only | server | Required when `MAIL_TRANSPORT=resend` |
| `RESEND_FROM_EMAIL` | Prod only | server | Verified sender on Resend |
| `NEXT_PUBLIC_APP_NAME` | No | client | Marketing site brand |
| `NEXT_PUBLIC_APP_URL` | No | client | Public URL of `apps/app` |

Copy `.env.example` to `.env.local` to start; defaults work for local Docker Postgres.

## Project structure

```
.
├── apps/
│   ├── web/        # Next.js 16 marketing site (public, no auth)
│   ├── app/        # Next.js 16 authenticated product (proxy.ts guard)
│   └── docs/       # Next.js 16 docs site (Fumadocs)
├── packages/
│   ├── auth/       # Better Auth setup (single source of truth)
│   ├── database/   # Drizzle ORM + schema (CLI-generated for auth tables)
│   ├── api/        # Hono + oRPC router
│   ├── email/      # React Email templates (Console dev / Resend prod)
│   ├── env/        # Zod-validated env (server + client)
│   ├── ui/         # shadcn/ui + Tailwind v4 design system
│   ├── cookies/    # Cookie consent UI
│   ├── utils/      # General utilities
│   ├── eslint-config/
│   └── typescript-config/
├── pnpm-workspace.yaml  # catalogs (strict)
├── turbo.json           # pipelines
└── .env.example
```

## Deployment

### One-click

Click the **Deploy with Vercel** button at the top. The monorepo is detected automatically; you will need to create three Vercel projects (one per app) and configure env vars per project.

### Per-app mapping

| App | Production URL |
|---|---|
| `apps/web` | `https://yourdomain.com` |
| `apps/app` | `https://app.yourdomain.com` |
| `apps/docs` | `https://docs.yourdomain.com` |

> [!NOTE]
> `engines.node` is pinned to `"24.x"` in `package.json`. If your deploy target requires a different major, update it there.

## What's locked

This template ships with decisions you can lean on without re-litigating:

- **Multi-tenant is the default.** Org plugin is enabled in `packages/auth/src/auth.ts`. Memberships are invite-only - there is no auto-create on signup, so a forgotten user cannot end up in a workspace they never asked to join.
- **Email verification is enforced.** `apps/app/proxy.ts` redirects unverified sessions to `/verify-email`; `sendOnSignUp` and `sendOnSignIn` both fire.
- **Auth config is a single source.** Every Better Auth option lives in `packages/auth/src/auth.ts`. Apps and components import from `@workspace/auth`; the config is never inlined.
- **Schema is CLI-owned.** `packages/database/src/schema/auth.ts` is regenerated by `pnpm auth:generate`. Extend the domain with satellite tables (one-to-one keyed on `user.id`), not inline columns on the generated tables.
- **Env vars have one schema.** Every env var the workspace reads is declared in `packages/env/src/schema.ts`. Direct `process.env` reads outside that package are reserved for the build tooling that needs them.

## Architecture notes

- **Proxy, not middleware.** Next.js 16 renamed `middleware.ts` to `proxy.ts`. The auth guard lives at `apps/app/proxy.ts`.
- **Catalogs, not manual pins.** All shared versions are centralized in `pnpm-workspace.yaml` with `catalogMode: strict`.
- **Per-package AGENTS.md invariants.** Each package under `packages/*` ships its own `AGENTS.md` (or `README.md`) with the invariants that apply to that package's code - read those before editing.

## Contributing

Open an issue to discuss larger changes. For typos, broken links, and small fixes, PRs are welcome.

## License

[MIT](./LICENSE). See the LICENSE file for details.

## Support

- Issues: [github.com/deessejs/saas-template-multi-tenant/issues](https://github.com/deessejs/saas-template-multi-tenant/issues)
- Discussions: [github.com/deessejs/saas-template-multi-tenant/discussions](https://github.com/deessejs/saas-template-multi-tenant/discussions)
- Single-tenant variant: [deessejs/saas-template](https://github.com/deessejs/saas-template)
- Email: [support@deessejs.com](mailto:support@deessejs.com)

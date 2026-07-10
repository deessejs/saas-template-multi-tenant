# Better-Auth — Database Hooks

Lifecycle hooks for database operations. See [`index.md`](./index.md) first.

**Source:** [better-auth.com/docs/concepts/hooks](https://better-auth.com/docs/concepts/hooks) — core hooks concept. [better-auth.com/docs/concepts/database](https://better-auth.com/docs/concepts/database) — databaseHooks reference.

---

## Hook Types

Every model (`user`, `session`, `account`, `verification`) supports:

| Hook | Runs | Can modify data? | Can abort? |
|---|---|---|---|
| `model.create.before` | Before the row is written | ✅ return `{ data: ... }` | ✅ return `false` |
| `model.create.after` | After the row is written | ❌ | ❌ |
| `model.update.before` | Before the row is updated | ✅ return `{ data: ... }` | ✅ return `false` |
| `model.update.after` | After the row is updated | ❌ | ❌ |
| `model.delete.before` | Before the row is deleted | ❌ | ✅ return `false` |
| `model.delete.after` | After the row is deleted | ❌ | ❌ |

---

## Signature

```ts
databaseHooks: {
  session: {
    create: {
      before: async (session, ctx) => {
        // session: current session object being written
        // ctx: context (e.g., ctx.context.session for the calling user in update/delete hooks)
        return { data: { ...session, activeOrganizationId: "..." } }
        // or: return false to abort
      },
      after: async (session) => {
        // session: the written row
      },
    },
  },
}
```

The `before` hook can **merge** data back into the session object via `{ data: ... }`. The `after` hook receives the final row.

**Source:** [better-auth.com/docs/concepts/database](https://better-auth.com/docs/concepts/database) — hook signature documentation.

---

## Session.create.before — No longer used for org auto-create

This hook is no longer used to auto-create an organization on signup. Org creation now happens at `/onboarding` via `authClient.organization.create` (a client-driven mutation that correctly invalidates the active-org atom — see [better-auth #9710](https://github.com/better-auth/better-auth/issues/9710) and [`org.md`](./org.md)).

The hook is still available for other use cases (e.g., enriching the session row, adding default claims). Just do not use it to call `auth.api.createOrganization` — that pattern caused a stale `useActiveOrganization()` on the client because the server-side mutation bypassed the client's atom invalidation.

**Source:** [better-auth.com/docs/concepts/database](https://better-auth.com/docs/concepts/database) — `databaseHooks` reference.

---

## User.create.after — Async Side Effects

Use for fire-and-forget operations that need the committed user row:

```ts
databaseHooks: {
  user: {
    create: {
      after: async (user) => {
        // User row is now committed. Safe to query.
        void sendWelcomeEmail({ to: user.email })
      },
    },
  },
},
```

Always use `void` or `waitUntil` for async side effects — do not await in `after` hooks as it blocks the response.

---

## Account Hooks

Useful for linking OAuth accounts:

```ts
databaseHooks: {
  account: {
    create: {
      after: async (account) => {
        // Link is established. Trigger additional setup if needed.
      },
    },
  },
}
```

---

## Ordering Within a Create Flow

On signup, the execution order is:

1. `session.create.before`
2. Session row written
3. `session.create.after`
4. `user.create.before` (if new user)
5. User row written
6. `user.create.after` (if new user)
7. Organization plugin creates membership row

**Do not** assume `user` exists when `session.create.before` runs — on first signup it does not yet.

---

## Drizzle Relations for Joins

If `experimental.joins: true`, the schema must include Drizzle `relations()` for every table. Regenerate with:

```bash
pnpm auth:generate
```

Review the diff — the CLI regenerates the entire `schema/auth.ts` and may overwrite customizations.

**Source:** [better-auth.com/docs/adapters/drizzle](https://better-auth.com/docs/adapters/drizzle) — joins section.

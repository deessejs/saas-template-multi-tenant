---
id: 01
title: remember checkbox dead/wired in login-form.tsx
tier: 1
status: complete
effort: 30min
date: 2026-07-10
resolved: 2026-07-13
related: [../research-findings.md#signinemail-parameters]
---

## Resolution (2026-07-13)

Implemented Option A from the fiche. The checkbox is now bound via `form.Field`, the form's `remember` field is mapped to better-auth's `rememberMe` parameter in `onSubmit`, and the schema was tightened from `z.boolean().optional()` to `z.boolean()` to align with the new `defaultValues: { ..., remember: false }`.

Files changed:
- `apps/app/components/auth/login-form.tsx` — added `remember: false` to defaultValues, wrapped the `<Checkbox>` in `<form.Field>`, mapped `remember` → `rememberMe` in `signIn.email()`
- `apps/app/components/auth/schemas.ts` — `loginSchema.remember: z.boolean().optional()` → `z.boolean()`

Verified: `pnpm typecheck`, `pnpm lint`, `pnpm test:run` (13 tests) all pass.

## Context

The login form renders a "Remember me" checkbox (`<Checkbox id="remember" name="remember" />`) but it is never wired to the form state, and `loginSchema` does not declare it. The field is silently dropped — neither persisted nor validated.

## Investigation

Confirmed via fresh that `better-auth`'s `signIn.email` accepts `rememberMe: boolean, optional, default true`. When `false`, the session is dropped when the browser closes.

[Source: better-auth email-password.mdx](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/email-password.mdx)

## Solution

`loginSchema` in `schemas.ts` already declares `remember: z.boolean().optional()` — Step 1 below is already done. The remaining work is wiring the checkbox to form state.

### Option A — wire it (recommended if "remember me" is intended UX)

1. ~~Add `remember: z.boolean().optional()` to `loginSchema`~~ — **already present** at `apps/app/components/auth/schemas.ts:6`.
2. In `login-form.tsx`, replace the static `<Checkbox>` with a form-bound one:

   ```tsx
   <form.Field
     name="remember"
     children={(field) => (
       <div className="flex items-center gap-2">
         <Checkbox
           id={field.name}
           checked={field.state.value ?? false}
           onCheckedChange={(checked) => field.handleChange(checked === true)}
         />
         <label htmlFor={field.name} className="text-sm font-normal">
           Remember me
         </label>
       </div>
     )}
   />
   ```

   Note: `id={field.name}` (not the hardcoded `"remember"` that appears in the current file) — consistent with every other field in the form (email field at line ~111, password field at line ~145).

3. The existing `...value` spread in `signIn.email({ ...value, callbackURL: "/" })` already forwards the field. No backend changes needed.

### Option B — remove (if out of scope)

Delete the `<Checkbox>` block in `login-form.tsx`. `loginSchema` is unchanged — leaving the unused schema field is harmless.

### Note

When wiring the checkbox, be aware that better-auth rate-limits `/sign-in/email` to 3 req/10s in production (see [research-findings.md](../research-findings.md#built-in-rate-limiting)). Submitting the form faster than this will return a 429 before the `rememberMe` logic is reached.

## Files affected

- `apps/app/components/auth/schemas.ts` — add `remember` to `loginSchema`
- `apps/app/components/auth/login-form.tsx` — wire or remove the checkbox

## References

- `apps/app/components/auth/login-form.tsx` — current checkbox at line 163
- `apps/app/components/auth/schemas.ts` — `loginSchema` at line 3
- [better-auth email-password.mdx](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/email-password.mdx)
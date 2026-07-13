---
id: 01
title: No working route for creating additional organizations
tier: 2
status: complete
effort: 30min (Option A as implemented)
date: 2026-07-13
resolved: 2026-07-13
related: [../2026-07-10-apps-app/problems/06-onboarding-flow.md, ../../docs/guides/better-auth/org.md]
---

## Resolution (2026-07-13)

Implemented Option A from the fiche with the user's correction that **`/onboarding` and `/organizations/new` are two distinct contexts and must remain as separate pages**.

### Final architecture

- **`/onboarding`** — first-time setup wizard for users with no organizations. Page itself gates: if user has orgs → redirect to first org home.
- **`/organizations/new`** — additional-organization creation page for users who already have orgs. Reachable via the `OrgSwitcher`'s "Create new organization" link. No first-org gating.

### Files changed

- **Created** `apps/app/app/(protected)/organizations/new/page.tsx` — auth + email-verification gates only (no active-org gate); heading "Create a new organization"
- **Restored** `apps/app/app/(protected)/onboarding/page.tsx` — first-org wizard with `listUserOrganizations()` gate; heading "Create your workspace" with welcome copy
- **Updated** `apps/app/components/sidebars/org-switcher.tsx:134` — `href="/onboarding"` → `href="/organizations/new"`
- **Updated** `apps/app/app/page.tsx` — dispatcher: has-active → home, has-orgs-no-active → first org home, no-orgs → `/onboarding`
- **Updated** `apps/app/lib/active-org.ts` — added `listUserOrganizations()` helper
- **Updated** `docs/guides/better-auth/org.md` and `docs/guides/better-auth/index.md` — documented the two distinct routes and the dispatcher's state machine

### Out of scope / deferred

- Option C (single-org template, remove the OrgSwitcher link) — rejected; template supports multi-org.
- Option D (rename with redirect) — rejected; `/onboarding` is the wizard URL, `/organizations/new` is the additional-org URL, no aliasing needed.
- "Pick your org" page for users with multiple orgs — defer until users complain.

## Context

`apps/app/components/sidebars/org-switcher.tsx:133-142` renders a "Create new organization" `DropdownMenuItem` linking to `/onboarding` — **unconditionally, for every user**.

But `apps/app/app/(protected)/onboarding/page.tsx:25-30` gates the form:

```tsx
const activeOrgSlug = await getActiveOrgSlug()
if (activeOrgSlug) {
  redirect(`/${activeOrgSlug}/home`)
}
```

So for any user who already has an active organization, clicking "Create new organization" is a **silent no-op**: they're redirected back to their current org home, with no feedback and no workspace created.

This contradicts the user's mental model and the UI's affordance. The audit from 2026-07-10 (fiche #06) verified `/onboarding` as "complete for template scope" but only for the first-org case.

## Investigation

### Where the bug lives

| File | Lines | Role |
|---|---|---|
| `apps/app/components/sidebars/org-switcher.tsx` | 133-142 | Renders the broken "Create new organization" link (no condition on `activeOrganization`) |
| `apps/app/app/(protected)/onboarding/page.tsx` | 25-30 | The gate that redirects users-with-org away |
| `apps/app/components/onboarding/create-workspace-form.tsx` | 83-105 | The actual `authClient.organization.create` call (reusable) |

### Multi-org support status in the stack

- `packages/auth/src/auth.ts` does **not** set `allowUserToCreateOrganization: false`. Default is `true` → users **can** create multiple orgs.
- `OrgSwitcher` (`org-switcher.tsx:42`) calls `orgClient.useListOrganizations()` and lists all the user's orgs → the UI **already assumes** multi-org.
- `docs/guides/better-auth/org.md:221-234` documents `allowUserToCreateOrganization` as a feature, with example code for restricting it.

**Conclusion**: the system supports multi-org end-to-end. The template just doesn't expose the UI to *create* additional orgs beyond the first.

### What the audit missed

The 2026-07-10 audit's fiche #06 only traced the post-signup flow:

```
/signup → /verify-email → /onboarding → /home
```

It did not consider the "authenticated user with one org wants a second org" path, because no UI surfaces that explicitly except the broken link in `OrgSwitcher`.

### Preserved property

`<CreateWorkspaceForm />` calls `orgClient.organization.create` (line 85 of `create-workspace-form.tsx`), a **client-side** mutation. Per `apps/app/lib/auth-client.ts:6-15` and `docs/guides/better-auth/org.md:27-37`, this correctly invalidates `$activeOrgSignal` and `$sessionSignal` — avoiding the stale-atom bug from better-auth #9710.

**Whatever fix is chosen must keep this property.** Reuse the form; don't reimplement the mutation server-side.

## Solution

### Step 0 — Make the scope decision

Before any code, decide: **does this template support multi-org users?**

- **Yes** (recommended): proceed to Options A, B, or D.
- **No**: jump to Option C.

Recommendation: **Yes** — see `../README.md#decision-needed` for the four reasons.

---

### Option A — Add `/organizations/new` route (separate page)

**Effort**: 30 min. **Tier**: 2 (recommended for clarity).

1. Create `apps/app/app/(protected)/organizations/new/page.tsx`:

   ```tsx
   import { redirect } from "next/navigation"
   import { BuildingIcon } from "lucide-react"
   import { getSession } from "@/lib/session"
   import { CreateWorkspaceForm } from "@/components/onboarding"

   export default async function NewOrganizationPage() {
     const session = await getSession()
     if (!session?.user) {
       redirect("/login?redirect=/organizations/new")
     }
     if (!session.user.emailVerified) {
       redirect("/verify-email")
     }
     // No redirect-if-active-org gate — this route serves both first-org
     // and additional-org cases.

     return (
       <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-lg border p-6">
         <div className="flex justify-center">
           <div className="flex size-12 items-center justify-center rounded-full border bg-muted">
             <BuildingIcon className="size-5 text-muted-foreground" />
           </div>
         </div>
         <div className="flex flex-col gap-1 text-center">
           <h1 className="text-2xl font-bold">Create a new organization</h1>
           <p className="text-sm text-muted-foreground">
             Set up a name for your team. You can invite people and change
             details later.
           </p>
         </div>
         <CreateWorkspaceForm />
       </div>
     )
   }
   ```

2. Update `apps/app/components/sidebars/org-switcher.tsx:134`:

   ```diff
   -              <Link href="/onboarding">
   +              <Link href="/organizations/new">
   ```

3. Update `apps/app/app/page.tsx` (the dispatcher):

   ```diff
   -    redirect("/onboarding")
   +    redirect("/organizations/new")
   ```

4. **Decide what to do with `/onboarding`**:
   - **Delete** it (cleanest, breaks the URL contract documented in `docs/guides/better-auth/org.md`).
   - **Redirect** `/onboarding` → `/organizations/new` (preserves the doc, but adds a redirect hop).
   - **Keep** `/onboarding` as an alias (most cautious).

**Pros**: URL semantic matches intent ("create a new org"), follows SaaS conventions (Linear, Stripe, Notion all use this pattern).
**Cons**: New file, dispatcher change, decision about `/onboarding` legacy.

---

### Option B — Lift the gate on `/onboarding` (minimal change)

**Effort**: 15 min. **Tier**: 2 (recommended for minimal diff).

1. Remove the gate from `apps/app/app/(protected)/onboarding/page.tsx`:

   ```diff
   -  const activeOrgSlug = await getActiveOrgSlug()
   -
   -  // Pre-existing org → send the user to their org-scoped home; the form
   -  // below is irrelevant.
   -  if (activeOrgSlug) {
   -    redirect(`/${activeOrgSlug}/home`)
   -  }
   ```

2. Update the heading copy from "Create your workspace" to "Create a new workspace" (or "Create a new organization") — the current copy is already ambiguous enough that the change is cosmetic.

3. Remove the now-unused `getActiveOrgSlug` import from `onboarding/page.tsx`.

4. (Optional) Update the `OrgSwitcher` link target to point to a clearer URL — but keeping `/onboarding` works fine for this option.

**Pros**: minimal diff, no new file, no dispatcher change, no rename.
**Cons**: URL `/onboarding` is semantically odd for "create another org" — but the page's behavior is correct.

---

### Option C — Remove the broken link (single-org template)

**Effort**: 5 min. **Tier**: 4 (only if explicitly single-org).

1. Delete the `DropdownMenuItem` at `apps/app/components/sidebars/org-switcher.tsx:133-142`.
2. Delete the `DropdownMenuSeparator` at line 132 (now dead).
3. Update the agent memory `project/apps/app.md` to document "single-org template" as a scope decision.
4. Update `docs/guides/better-auth/org.md` line 13 to mention the single-org constraint (and link to this audit).

**Pros**: removes a misleading affordance; honest about scope.
**Cons**: caps the template at one org per user — limits future extensions.

---

### Option D — Rename `/onboarding` → `/organizations/new` + alias

**Effort**: 30 min. **Tier**: 2 (recommended for clean URL contract).

1. Move `apps/app/app/(protected)/onboarding/page.tsx` → `apps/app/app/(protected)/organizations/new/page.tsx`.
2. In the moved file: remove the gate (same diff as Option B step 1), update the heading copy.
3. Update `apps/app/app/page.tsx:30` — redirect target becomes `/organizations/new`.
4. Update `apps/app/components/sidebars/org-switcher.tsx:134` — link target becomes `/organizations/new`.
5. Create `apps/app/app/(protected)/onboarding/page.tsx` as a 3-line redirect file:

   ```tsx
   import { redirect } from "next/navigation"
   export default function OnboardingLegacy() {
     redirect("/organizations/new")
   }
   ```

   Keeps the URL alive for any external links (e.g., in the better-auth guide).

6. Update `docs/guides/better-auth/org.md` line 13 ("see `org.md` — the first organization is created explicitly by the user at `/onboarding`") to mention `/organizations/new` as the canonical URL.

**Pros**: canonical URL, semantic clarity, preserved legacy alias, doc consistency.
**Cons**: 3 files touched + doc update + memory update.

---

## Files affected (per option)

### Common
- `apps/app/components/sidebars/org-switcher.tsx` — link target (Options A, D)
- `apps/app/app/page.tsx` — dispatcher redirect target (Options A, D; unchanged for B)

### Option A
- `apps/app/app/(protected)/organizations/new/page.tsx` — **new**
- `apps/app/app/(protected)/onboarding/page.tsx` — delete OR keep as alias redirect

### Option B
- `apps/app/app/(protected)/onboarding/page.tsx` — remove gate + unused import

### Option C
- `apps/app/components/sidebars/org-switcher.tsx` — delete the `DropdownMenuItem` + separator
- `.claude/agent-memory/tech-lead/apps/app.md` — document single-org decision
- `docs/guides/better-auth/org.md` — mention single-org constraint

### Option D
- `apps/app/app/(protected)/onboarding/` — delete folder after move
- `apps/app/app/(protected)/organizations/new/page.tsx` — **new** (moved content)
- `apps/app/app/(protected)/onboarding/page.tsx` — **new** redirect-only file
- `docs/guides/better-auth/org.md` — update URL references
- `.claude/agent-memory/tech-lead/apps/app.md` — update routing doc

## Verification (after implementation)

Smoke test for any chosen option (except C):

1. Sign up a fresh user → land on `/onboarding` (or `/organizations/new`) → create org "Acme" → land on `/acme/home`.
2. From `OrgSwitcher`, click "Create new organization" → land on the form (NOT bounced to home).
3. Create a second org "Beta" → land on `/beta/home`.
4. From `OrgSwitcher`, confirm both "Acme" and "Beta" appear.
5. Switch between them via the switcher — URL and active-org cookie must stay aligned.

## References

- `apps/app/components/sidebars/org-switcher.tsx:133-142` — the broken link
- `apps/app/app/(protected)/onboarding/page.tsx:25-30` — the redirect gate
- `apps/app/components/onboarding/create-workspace-form.tsx:83-105` — the reusable form
- `apps/app/lib/auth-client.ts:6-15` — anti-#9710 rationale
- `docs/guides/better-auth/org.md:27-37` — User-Created Org via Onboarding
- `docs/guides/better-auth/org.md:221-234` — `allowUserToCreateOrganization` docs
- `temp/audit/2026-07-10-apps-app/problems/06-onboarding-flow.md` — the audit that missed this
- `temp/audit/2026-07-10-apps-app/problems/12-stale-memory-file.md` — related memory rewrite
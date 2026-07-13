---
name: feedback-scope-discipline
description: Stay strictly within defined scope — don't expand to cleanup items not in active fiches, even as "while you're at it" suggestions
metadata:
  type: feedback
---

When recommending work or proposing implementation steps, stay strictly within the defined scope of active fiches. Don't expand scope to include obvious cleanup items that aren't part of any active work item — even framing them as "while you're at it" or "hors scope formel, defer" is too much.

**Why:** User confirmed explicitly on 2026-07-13 that the `apps/app/hooks/use-mobile.ts` cleanup "ne sera pas fait" (will not be done). This was in response to me listing it as a "non-formal-scope" defer option in a top-3-issues recommendation. The user pushed back because:
- The prior fiche #04 that proposed deletion was intentionally removed from the audit set.
- Re-introducing it (even as defer) expands scope and re-opens a closed decision.
- Audit fidelity > opportunistic cleanup.

The same pattern has surfaced repeatedly in the audit work:
- User corrected Option B → Option A for `/organizations/new` (the audit document's primary recommendation).
- User explicitly required `/onboarding` and `/organizations/new` to remain as **two separate pages** with distinct contexts, even when Option B (lift the gate) was a smaller diff.

These are not one-off corrections — they're a consistent preference: **follow the defined scope strictly, don't propose alternatives that weren't in the source material, and don't re-open closed decisions**.

**How to apply:**
- When picking the "next 3 issues to handle", pick from active fiches only. Don't list dead code, refactors, or cleanups as honorable-mentions even in a "what NOT to pick" table — just don't mention them.
- When implementing a fiche, follow the recommended option in the fiche text. If a smaller-diff alternative exists, mention it briefly as a "for awareness" but commit to the documented option.
- When memory or audit text references a removed fiche (e.g., #02, #04 in the 2026-07-10 audit), treat the reference as historical context — do NOT propose recreating the work item, even with a strong rationale.
- When tempted to suggest a "small adjacent fix" not in the current fiche, hold back unless the user explicitly asks for scope expansion.

Related: [[audit-apps-app-fiches]] (which fiches are intentionally absent from the 2026-07-10 audit set), [[apps/app-architecture]] (the use-mobile.ts status note explicitly says NOT tracked for deletion).
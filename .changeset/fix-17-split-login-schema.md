---
"app": patch
---

fix(app): `loginSchema` no longer enforces `password.min(8)`. The minimum-length policy was a registration-only invariant (still applied via `signupSchema`), but better-auth does not enforce it server-side at signin — accounts with shorter passwords (legacy or created before the policy was introduced) were locked out of the login form. `password.min(1)` replaces `min(8)` so the field is non-empty but any length is accepted.
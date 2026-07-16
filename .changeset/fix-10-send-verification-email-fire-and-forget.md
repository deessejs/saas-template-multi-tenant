---
"@workspace/auth": patch
---

fix(auth): `sendVerificationEmail` now uses the fire-and-forget pattern (`void sendAuthEmail(...)`), matching the sibling `sendResetPassword` callback and the upstream Better Auth recommendation. The previous `await` added Resend roundtrip latency to every login (compounded by `sendOnSignIn: true`) and exposed a timing-attack surface that better-auth docs explicitly warn against. Email send errors are now silent on the server side — already tracked by issue #9 (Pino observability + request correlation).
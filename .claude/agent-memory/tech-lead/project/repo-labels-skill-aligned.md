---
name: repo-labels-skill-aligned
description: GitHub repo labels are aligned with .claude/skills/create-issue/SKILL.md. SKILL.md is the canonical source — never use labels outside its allowlist when creating issues or editing PRs.
metadata:
  type: project
---

# Repo labels — skill-aligned (2026-07-16)

The `deessejs/saas-template-multi-tenant` repo's labels were migrated on **2026-07-16** to match `.claude/skills/create-issue/SKILL.md`. **SKILL.md is the canonical source of truth** — don't use labels outside its allowlist when creating issues or editing PRs.

**Why:** The previous label set used `pkg:*` (e.g. `pkg:database`) and ad-hoc labels (`refactor`, `tests`, `performance`, `deps`, `breaking`). These didn't match the `create-issue` skill and would silently fail issue creation or PR label edits. Migrating to the skill's set keeps the tooling and the docs aligned.

**How to apply:**

When creating an issue, always use the skill's structured format. The allowed labels are:

- **`area:*`** (10) — `area:auth`, `area:ui`, `area:web`, `area:app`, `area:docs`, `area:database`, `area:email`, `area:ci`, `area:build`, `area:deploy`
- **`status:*`** (4) — `status:needs-triage`, `status:ready`, `status:in-progress`, `status:blocked`
- **`priority:*`** (3) — `priority:high`, `priority:medium`, `priority:low`
- **Cross-cutting** (3) — `breaking-change`, `dependencies`, `github_actions`
- **GitHub defaults** (keep) — `bug`, `documentation`, `duplicate`, `enhancement`, `invalid`, `question`, `wontfix`, `good first issue`, `help wanted`, `security`

**Dropped (no longer valid):** `pkg:database`, `pkg:auth`, `pkg:api`, `pkg:ui`, `tests`, `refactor`, `performance`, `deps`, `blocked`, `breaking`.

**Mapping for legacy references:**

| Legacy label | Skill replacement |
|---|---|
| `pkg:database` | `area:database` |
| `pkg:auth` | `area:auth` |
| `pkg:api` | `area:build` (no direct equivalent — API work is generic "build") |
| `pkg:ui` | `area:ui` |
| `tests` | drop or attach to description (no skill label) |
| `refactor` | drop or attach to description (no skill label) |
| `performance` | drop |
| `deps` | `dependencies` |
| `blocked` | `status:blocked` |
| `breaking` | `breaking-change` |

PR #5 was re-labeled accordingly (`area:auth`, `area:database` only — the `tests` and `refactor` labels were silently dropped because they no longer exist).

## Related

- [[agents.md]] — project conventions + where SKILL.md lives
- `.claude/skills/create-issue/SKILL.md` — canonical label source

## Follow-up

- If a real need appears for a missing label (e.g., `area:api` for backend API work, `tests` for test-only scope), update SKILL.md first, then add the label. Never add a label without updating SKILL.md in the same change.
---
name: verify-gh-repo-target
description: Read git remote before any `gh --repo` invocation; saas-template vs saas-template-multi-tenant are distinct repos in the deessejs org
metadata:
  type: feedback
---

Local directory name does NOT necessarily match the GitHub remote name. For this project specifically:

- Local dir: `saas-template-multi-tenant` (on disk)
- GitHub origin: `github.com/deessejs/saas-template-multi-tenant`
- **NOT** `github.com/deessejs/saas-template` — a different, older repo that also exists in the same `deessejs` org and was created earlier in the template lineage.

**Why:** I created issue #27 against `deessejs/saas-template` instead of `deessejs/saas-template-multi-tenant` because I inferred the target from the SKILL.md's "saas-template" repo context and from earlier response context, instead of reading the actual local git remote. The user had to interrupt and paste `git remote -v` to correct me. Result: a duplicate workstream in the wrong repo, requiring cleanup.

**How to apply:** Before any `gh` invocation that takes a `--repo` flag (`gh issue create`, `gh pr create`, `gh release create`, `gh api`, etc.), run

```
git -C <workspace_root> remote -v
```

and use the actual `origin` URL as the `--repo` target. Never infer from the directory name, prior conversation context, or skill-prompt repo context. Especially careful when the org has multiple repos with overlapping prefixes (`saas-template`, `saas-template-multi-tenant`, `documentation-template`, etc.).

If the user explicitly specifies a target repo in the message, still cross-check with `git remote -v` — typos happen, and an honest "I see X locally, you said Y, which do you mean?" costs nothing vs. creating an artifact in the wrong place.

Related: [[agents]] (commit message conventions mention the deessejs/impl/* branch namespace, which is NOT the same as the deessejs/<repo> repo namespace).

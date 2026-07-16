---
name: feedback-ts-arrow-style
description: User prefers `const foo = () => {}` over `function foo() {}` in TypeScript code generated in this project
metadata:
  type: feedback
---

En TS dans ce repo, l'utilisateur préfère le pattern `const name = (...) => {}` au keyword `function name() {}`.

**Why:** Préférence stylistique personnelle déclarée explicitement (2026-07-16). Même si la majorité des seniors penchent pour `function` (lisibilité, hoisting, debug stack trace), l'utilisateur choisit l'arrow const — il est cohérent de respecter ce choix dans le code que je produis.

**How to apply:**
- Pour les **fonctions top-level / exportées** : utiliser `export const foo = (...) => { ... }` par défaut, pas `export function foo() {...}`.
- Garder `function` pour : déclarations hoistées volontairement, méthodes de classe (sauf class field arrows), `function*` generators nommés.
- Garder les arrows pour : callbacks (`map`/`filter`/`then`), hooks React (`useEffect`/`useCallback`/`useMemo`), JSX inline, lexical `this`.
- Si ESLint local impose une règle opposée (ex: `func-style: [error, declaration]`), signaler la préférence au lieu de l'ignorer silencieusement.

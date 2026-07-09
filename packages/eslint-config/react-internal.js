import { config as baseConfig } from "./base.js"
import pluginReact from "eslint-plugin-react"
import pluginReactHooks from "eslint-plugin-react-hooks"
import globals from "globals"

const config = [
  ...baseConfig,
  {
    plugins: {
      react: pluginReact,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2025,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // TanStack Form uses `<form.Field>` / `<form.Subscribe>` with `children` as a
      // render-prop function — this is the documented API. The `react/no-children-prop`
      // rule cannot tell that intent apart from "wrong usage" so we disable it globally:
      // the other usages in this codebase (shadcn primitives) don't accept a `children`
      // prop anyway, so a false positive is unlikely.
      "react/no-children-prop": "off",
      // Discourage raw HTML controls in apps/* — prefer @workspace/ui shadcn components
      // See: .claude/skills/use-shadcn/SKILL.md
      "react/forbid-elements": [
        "warn",
        {
          forbid: [
            {
              element: "input",
              message:
                "Use <Input /> from @workspace/ui/components/input (or <InputField /> wrapper in apps/app/components/auth/field.tsx).",
            },
            {
              element: "button",
              message:
                "Use <Button /> from @workspace/ui/components/button with variant/size props.",
            },
            {
              element: "select",
              message: "Use <Select /> from @workspace/ui/components/select.",
            },
            {
              element: "textarea",
              message: "Use <Textarea /> from @workspace/ui/components/textarea.",
            },
          ],
        },
      ],
    },
  },
  // Per-file overrides for canonical shadcn-shipped patterns.
  // `use-mobile` (and similar hooks) compute their initial state on mount via a
  // setState inside useEffect — that's a deliberate one-shot synchronization with
  // a non-React external system (window.matchMedia), not a cascading render.
  // The `react-hooks/set-state-in-effect` rule is too strict for this case.
  {
    files: ["**/hooks/use-*.ts", "**/hooks/use-*.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
    },
  },
]

export { config }

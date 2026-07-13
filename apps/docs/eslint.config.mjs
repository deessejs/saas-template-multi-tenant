import { nextConfig } from "@workspace/eslint-config/next"

// Fumadocs generates `.source/` from MDX/content-collections at build
// time. These files use `@ts-nocheck` and `{}` types by design and
// shouldn't be linted. `nextConfig` is an array of flat-config entries;
// appending our own ignores entry keeps the per-app exclusion local.
export default [
	...nextConfig,
	{
		ignores: [".source/**"],
	},
];
// Test-runner bootstrap. Two jobs, both about getting `node --test` to read the
// app's own TypeScript rather than a compiled copy of it:
//
//  1. Node 22 strips types natively, so a `.ts` file runs as-is — no bundler, no
//     build step, no devDependency. The tests import the SAME modules the app
//     imports; there is no second copy of the money rules to drift.
//  2. Node knows nothing about tsconfig `paths`, and every lib file imports its
//     neighbours as `@/lib/…`. This resolve hook maps `@/x` → `<repo>/x.ts`,
//     exactly like the `"@/*": ["./*"]` mapping in tsconfig.json.
//
// Loaded via `--import ./test/register.mjs` (see the `test` script in package.json).
import { registerHooks } from "node:module";

// The repo root, derived from this file's own location — so the suite runs the
// same from any working directory.
const ROOT = new URL("../", import.meta.url).href;

// Node's ESM resolver wants a real extension; the app's imports never carry one.
const HAS_EXT = /\.[cm]?[jt]sx?$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const rest = specifier.slice(2);
    return nextResolve(new URL(HAS_EXT.test(rest) ? rest : `${rest}.ts`, ROOT).href, context);
  },
});

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import fs from "node:fs";

// next/image refuses a `quality` that is not in next.config.ts's allowlist
// (Next 16), and says so only at runtime, in the browser console. This makes
// it a lint error instead. One list, shared with next.config.ts.
const imageQualities = JSON.parse(
  fs.readFileSync(new URL("./src/lib/site/image-qualities.json", import.meta.url), "utf8"),
);
const notAllowed = imageQualities.map((q) => `[value!=${q}]`).join("");

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `JSXAttribute[name.name="quality"] > JSXExpressionContainer > Literal${notAllowed}`,
          message: `Image quality must be one of ${imageQualities.join(", ")} (src/lib/site/image-qualities.json, used by next.config.ts images.qualities).`,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

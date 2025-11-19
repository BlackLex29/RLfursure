import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Ignore build outputs and dependencies
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "dist/**",
      ".vercel/**",
      ".netlify/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
  // Extend Next.js configs
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Optional: Override specific rules if needed
  {
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
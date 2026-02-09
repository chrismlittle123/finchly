import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Complexity limits
      "max-depth": ["error", { max: 4 }],
      "max-params": ["error", { max: 4 }],
      "max-lines-per-function": ["error", { max: 100 }],
      "max-lines": ["error", { max: 500 }],
      complexity: "error",
      "no-console": ["error", { allow: ["error", "warn"] }],

      // Best practices
      eqeqeq: "error",
      "prefer-const": "error",
      "no-var": "error",

      // Security
      "no-eval": "error",
      "no-implied-eval": "error",

      // Bug prevention
      "array-callback-return": "error",
      "no-template-curly-in-string": "error",
      "consistent-return": "error",

      // TypeScript
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-empty-object-type": "off",

      // Imports
      "import/no-cycle": "off",
    },
  },
  {
    ignores: [".next/**", "out/**", "build/**"],
  },
);

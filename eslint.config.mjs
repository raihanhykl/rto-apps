import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/out/**",
      "**/coverage/**",
      "packages/frontend/**", // Frontend uses its own ESLint config (eslint-config-next)
    ],
  },

  // Base recommended rules
  eslint.configs.recommended,

  // TypeScript rules for backend
  ...tseslint.configs.recommended,

  // Backend-specific config
  {
    files: ["packages/backend/src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Relax some rules for pragmatic development
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },

  // Test files — more relaxed
  {
    files: ["packages/backend/src/__tests__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },

  // Prettier must be last to override formatting rules
  eslintConfigPrettier,
);

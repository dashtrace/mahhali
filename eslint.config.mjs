import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "coverage/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Only the repository layer talks to the database.
    files: ["src/**/*.{ts,tsx}"],
    // auth.ts hands the client to Better Auth's Prisma adapter.
    ignores: ["src/server/repositories/**", "src/server/db.ts", "src/server/auth/auth.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@prisma/client", message: "Use a repository in src/server/repositories instead." },
            { name: "@/server/db", message: "Use a repository in src/server/repositories instead." },
          ],
          patterns: [{ group: ["**/db", "**/server/db"], message: "Use a repository instead." }],
        },
      ],
    },
  },
  {
    // Route handlers go through services, never repositories.
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/server/repositories/*"], message: "Call a service instead." }] },
      ],
    },
  },
];
export default config;

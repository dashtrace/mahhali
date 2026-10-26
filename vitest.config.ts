import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };
const env = { ...loadEnv("test", process.cwd(), ""), ...process.env };

// Integration tests TRUNCATE every table, so they only ever use TEST_DATABASE_URL.
const testDatabaseUrl = env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  resolve: { alias },
  test: {
    // Integration tests share one database, so test files run one at a time.
    fileParallelism: false,
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/globalSetup.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          env: {
            DATABASE_URL: testDatabaseUrl,
            BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
            BETTER_AUTH_URL: "http://localhost:3000",
          },
        },
      },
    ],
  },
});

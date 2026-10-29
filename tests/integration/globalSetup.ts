import { execSync } from "node:child_process";
import { loadEnv } from "vite";

// Brings the test database up to the latest migration once per run.
// TEST_DATABASE_URL must point at a disposable database: tests truncate every table.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? loadEnv("test", process.cwd(), "").TEST_DATABASE_URL;
  if (!url) throw new Error("Set TEST_DATABASE_URL to a disposable test database (see .env.example)");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}

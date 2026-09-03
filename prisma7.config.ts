import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx --no-install tsx prisma/seed.ts",
  },
  datasource: {
    // Serverless requests use DATABASE_URL, while migrations should prefer the
    // direct Supabase connection when it is configured.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});

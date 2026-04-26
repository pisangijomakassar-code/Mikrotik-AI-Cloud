// DATABASE_URL is injected via docker-compose environment — no dotenv needed in production.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.mjs",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});

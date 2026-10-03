import { defineConfig } from "drizzle-kit";
import path from "path";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "./src/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  // Session storage and legacy tables are not owned by this schema. Do not
  // offer to rename or drop them during unattended post-merge setup.
  tablesFilter: Object.values(schema).flatMap((value) =>
    is(value, PgTable) ? [getTableName(value)] : []),
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

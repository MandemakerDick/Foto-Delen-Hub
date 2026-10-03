import { defineConfig } from "drizzle-kit";
import path from "node:path";
import config from "./drizzle.config";

// Only the separately approved ownership constraint is deferred. Retain the
// full table snapshot so unrelated columns and sequence ownership stay intact.
export default defineConfig({
  ...config,
  schema: path.join(__dirname, "./src/schema/ownership-deferred.ts"),
});
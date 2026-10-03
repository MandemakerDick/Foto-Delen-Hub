export * from "./index";
import { photographersTable } from "./photographers";

// CLI-only staging snapshot. Keep the complete schema (including serial
// sequence ownership), but omit this one constraint until its approved rollout.
// The API and normal Drizzle config import index.ts, never this module.
Object.defineProperty(photographersTable.clerkUserId, "isUnique", { value: false });
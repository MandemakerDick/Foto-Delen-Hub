---
name: Drizzle-kit unattended schema sync
description: Interactive prompts, false-success exit codes, and data-preserving constraint alignment.
---

## Rule
Do not assume `drizzle-kit push --force` is non-interactive or that exit code
zero proves schema synchronization succeeded. Reject interactive-prompt errors
explicitly in unattended setup.

**Why:** Drizzle still prompts for some unique-constraint changes under `--force`.
It can then print a non-TTY error and exit zero, causing merge setup to report a
false success.

**How to apply:** Prefer explicit, data-preserving SQL for ambiguous schema
changes. In unattended push wrappers, check both exit status and error output;
never answer a truncate prompt automatically.

Keep schema sync limited to tables owned by the app. Align legacy constraint
names without removing their enforcement or changing rows.

**Why:** Renaming a table can leave its unique constraints named after the old
table. Drizzle interprets the name difference as a new constraint and offers to
truncate populated tables. Unmanaged session and legacy tables also become
unsafe rename/drop candidates if introspection is unrestricted.

**How to apply:** Derive the managed table allowlist from the declared schema.
Use guarded constraint renames for naming drift; leave unrelated tables alone.

When deferring an unapproved constraint, retain the full table snapshot and
defer only that constraint inside the schema-sync CLI process.

**Why:** Drizzle can still introspect an excluded table's serial sequence.
Removing that table from both the source and table filter attempted to drop its
still-used sequence. PostgreSQL blocked the drop, but table filters alone are
not a sufficient sequence-safety boundary.

**How to apply:** Keep existing tables represented in staged snapshots. Do not
mutate runtime models or install a separately approved constraint merely to
make unattended setup pass. Catch lowercase SQL errors too: those can also
be printed with a successful process exit code.

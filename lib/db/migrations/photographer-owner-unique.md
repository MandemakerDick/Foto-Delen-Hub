# One photographer profile per account: rollout plan

## Policy
An account may own at most one photographer profile. A profile may have at most
one owner. Multiple unclaimed profiles (`clerk_user_id IS NULL`) remain allowed.
A matching invite can retry linking the same owned profile, but cannot replace
another owned profile. Ownership conflicts return HTTP 409 without consuming a
browser grant or incrementing authenticated invite usage.

## Approval and deployment
This change does **not** execute database DDL at startup or modify production
records. Do not run a generic schema push/force-push to bypass this plan.

Automatic workspace post-merge setup defers only the ownership constraint
while the named ownership constraint is absent. It continues syncing other
declared schema changes without approving or running this manual migration.
Once the constraint is installed, the normal full schema snapshot is used.
The deferred snapshot is confined to the schema-sync CLI process; runtime
models still declare the intended ownership uniqueness.

1. Deploy all updated ownership writers (browser link, self-service creation,
   authenticated invite redemption). Each takes the same transaction-scoped
   account lock before checking and writing. This protects new API writes even
   before the unique constraint is installed. Complete the rollout of old
   instances and pause external ownership writers before proceeding.
2. With authorized read-only production database access, audit duplicates:

   ```sql
   SELECT clerk_user_id, array_agg(id ORDER BY id) AS photographer_ids, count(*)
   FROM photographer WHERE clerk_user_id IS NOT NULL
   GROUP BY clerk_user_id HAVING count(*) > 1;
   ```

   Treat account identifiers as private operational data; do not publish them.
3. If duplicates exist, stop. Ask the owner to approve a **per-account** resolution
   naming the retained profile and the disposition of every other profile.
   Never choose the first row automatically, delete profiles/photos, or silently
   clear account links. Any merging, reassignment, or unlinking requires its own
   reviewed data migration and backup/recovery plan. Until resolved, affected
   accounts cannot claim/create further profiles, including same-profile retries
   when a second owned profile exists.
4. After explicit rollout approval, a backup, and a clean duplicate audit, apply
   `photographer-owner-unique.sql` in the target environment during a low-traffic
   window using an approved SQL migration runner. It briefly blocks writers,
   rechecks duplicates under a table lock, and adds the named unique constraint.
   On timeout or duplicate error, roll back the transaction and investigate;
   do not force it. NULL owners are intentionally not considered duplicates.
5. Verify the named constraint exists and test claim/create conflicts using
   designated QA accounts. No existing records should have changed.

## Recovery
If application rollback is needed, prefer keeping the uniqueness constraint;
older writers may then return errors on conflicts but cannot create duplicates.
Only drop the constraint with explicit approval, paused ownership writes, and a
replacement integrity plan. Removing it permits older code to recreate the bug.
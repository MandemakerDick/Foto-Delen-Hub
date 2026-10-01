# Staged upload cleanup

New signed uploads are registered before the upload URL is returned. A photo or
avatar save marks its upload attached inside the same database transaction.
Unattached uploads expire after 24 hours; cleanup runs at startup and every
five minutes, deleting at most 50 files per pass. The 24-hour delay exceeds the
15-minute signed PUT lifetime. Failed deletes retry after an hour.

Cleanup never scans the bucket or deletes legacy files, external URLs, imports,
or attached uploads. Deleted ledger entries remain as tombstones so a late save
cannot attach a removed file. A failed request after a successful database commit
does not expose the file to cleanup.

Deleting the last photo reference or replacing/removing an avatar or club logo schedules a
tracked file for another 24-hour grace period. Bulk photo deletion and profile
deletion use the same transaction as that scheduling. Shared references from
other photos, avatars, or club logos keep the file attached; reattaching during
the grace period cancels collection. A failed database mutation rolls back
both the mutation and its collection schedule.

Photos and photographer profiles still used by review-session records cannot
be deleted (HTTP 409). Remove those session references first. New submissions,
reviewer assignments, and reviews lock their referenced records so concurrent
deletion cannot leave a broken review. Removing a reviewed submission also
returns HTTP 409 rather than implicitly deleting its review history; an admin
can explicitly delete the containing session with its existing review cascade.
Gallery-less review uploads count as photo references. Club logo updates lock
the actual current club row before capturing its previous URL and use the same
attachment/retirement transaction. Omitting the logo field preserves it; an
explicit empty string removes it. Club creation and updates require a verified
Clerk or password-session administrator; public browsing is unchanged.

## Publishing and rollback

The new development schema must be included when publishing. For the managed
database, Replit's Publish flow applies that schema before running the new app;
do not add startup-time DDL or manually migrate production.

All API writers must use the staging attachment protocol before cleanup is
enabled. The initial 24-hour staging delay leaves time to complete deployment
of the updated writers. Set `UPLOAD_CLEANUP_ENABLED=false` to disable cleanup
during a mixed-version rollout or before rolling back to a version without
staging-aware writes. Drain the newer cleanup workers before serving an older
version. Leaving cleanup disabled preserves images but delays collection.

## Isolated verification

`pnpm --filter @workspace/api-server test` runs disposable socket-only PostgreSQL
fixtures and mocked storage deletion. It creates no shared development or
production photo/upload records and does not delete real objects.
---
name: Account identity epochs
description: Why account-owned callbacks need a revision as well as a user ID.
---

Private-cache work must belong to an identity epoch, not only a user ID.
Observe identity transitions in an always-mounted auth listener, even when
the user is browsing public pages without a private-profile consumer.

**Why:** In an A → B → A sequence, a callback captured during the first A session
has the same user ID as the final session but must still be obsolete. If only
private pages observe auth changes, the sequence can go unnoticed while those
pages are unmounted. Aborting fetches alone also does not guard late completions
from transports that ignore cancellation.

**How to apply:** Reset private state and advance its epoch on identity changes;
check epoch/request ownership before applying responses or post-save callbacks.
Hide mismatched data during render, before effects run. Keep public-route auth
synchronization free of unnecessary private fetches.
---
name: Mobile account-cache boundary
description: Privacy and public-cache behavior when a native member signs out or switches identities
---

Treat an identity change as a boundary for authenticated query results. Do not keep the previous member's profile, personal photo list, or like status available to the next identity, even briefly; preserve public discovery and Gallery caches.

**Why:** Clearing every query on sign-out discards useful public content, while merely invalidating private entries leaves old values visible until refetch. In-flight responses from the old identity also must not restore private results.

**How to apply:** Unmount identity-bound screens before removing private queries, then mount for the new identity. Test cached data, in-flight responses, and retained public queries across a simulated account change.
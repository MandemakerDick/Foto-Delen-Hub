---
name: Mobile query-key invalidation
description: Why prefix-based React Query invalidation can miss generated API detail and custom screen caches
---

When a mobile mutation changes data shown across list, detail, gallery, and directory screens, invalidate all affected query families, including custom screen keys. An array prefix containing a list URL alone will not cover the generated detail URLs.

**Why:** The generated client uses a whole URL as the first query-key element. The list and detail URLs are different strings, not successive elements in one structured key, so React Query's array-prefix matching misses mounted detail views. Some native screens also override generated keys entirely.

**How to apply:** On shared-data mutations, identify the consuming screens' generated and overridden keys, then verify both active refetch and inactive cache reactivation with a query-client test.
---
name: Shared Gallery pagination contract
description: Compatibility and reuse rules for Gallery data access across web and future native apps.
---

Use the dedicated paginated Gallery API for interactive Gallery browsing on web and future native clients. Keep the legacy photo-list contract stable for administration, detail screens, and Review Club unless all consumers are migrated deliberately.

**Why:** The original unpaginated photo list has multiple consumers with array-response assumptions. A separate Gallery contract allows combined filters, server ordering, and incremental loading without breaking those screens, while giving native apps a reusable low-bandwidth API.

**How to apply:** Add Gallery filters and sorts to the paginated contract first, regenerate clients from OpenAPI, and have clients load small pages. Preserve deterministic ordering and cursor validation so shared URLs and incremental loading remain reproducible.

On native, expose incremental loading with a visible **Load more** control rather than only fetching automatically at the end of a scroll.

**Why:** A tester with more than one page of photos reported that automatic loading gave no apparent pagination, even though the API returned a next cursor.

**How to apply:** Keep the server cursor contract unchanged; show the next-page action when the Gallery response has another page, and show progress or a retry control during/after the request.

The tester subsequently confirmed the visible Load more control works on their Android phone with more than one page of photos.
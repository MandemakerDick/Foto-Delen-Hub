---
name: Long-running task synchronization
description: Avoid auditing stale task files as if they were the user's latest project
---

A long-running isolated task checkout can lag the main project even while incoming task updates report newer fixes as merged.

**Why:** A native parity audit initially reported web/API bugs that were already fixed on the main project, but absent from the older task checkout. The main project also lacked native features still being developed in the task, so replacing either tree wholesale would lose work.

**How to apply:** Before comparing recent user changes with an older assigned task, inspect the latest available main-project history as well as the working tree. Reconcile both sides, preserving the task's tested features and the main project's newer fixes. Task-state messages are not evidence that a fix is present in the current files. After syncing a new schema, check the isolated development database rather than assuming the main project's schema setup ran there.

Publishing updates main, not an active task's isolated changes. Apply the task handoff before production testing; a new mobile manifest timestamp alone does not prove the tested task code is published.

**Why:** A successful republish generated a newer manifest but still served older native routes while the current development bundle contained the task's fixes. Replit's task documentation confirms changes reach main through Apply. The user explicitly approved separating the tested development handoff from remaining production release QA to resolve this dependency.

**How to apply:** Check published bundle feature/route content as well as reachability and timestamps. If an active implementation task also requires production QA before completion, seek explicit scope approval to separate the development handoff from subsequent production QA; do not label untested release behavior as passed.

The same separation can be necessary for repairs discovered during production QA: an active repair can still be absent from main after a successful republish. Obtain approval to hand off and apply the repair before continuing device tests, rather than repeatedly publishing the unchanged source.
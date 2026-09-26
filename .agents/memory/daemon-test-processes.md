---
name: Daemon test processes
description: Why synchronous test harnesses can hang while a child daemon is already running
---

When a test harness launches a background service via a synchronous child-process call, ignore or redirect its standard streams instead of piping them.

**Why:** A daemon can inherit the parent's output pipes. The launcher exits and the service becomes ready, but the synchronous caller keeps waiting for pipe EOF that never arrives.

**How to apply:** For disposable services started in tests, use ignored/redirected stdio, bounded readiness checks, and explicit shutdown in teardown. If a command hangs despite a live service, check open pipes before changing the service.
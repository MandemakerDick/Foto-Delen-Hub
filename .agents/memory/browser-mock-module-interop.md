---
name: Browser mock module interoperability
description: Raw browser mock modules do not receive Vite's CommonJS named-import rewriting.
---

Browser modules supplied directly by request interception must obey the
actual exports of their dependencies, not the source-level import syntax
that Vite normally rewrites.

**Why:** Optimized CommonJS dependencies can expose only a default export
to raw browser ESM. A named React hook import inside a fulfilled mock can
prevent the entire application from loading even though normal app imports
and unit tests work.

**How to apply:** In intercepted modules that import optimized React directly,
import its default export and access hooks from that object. Treat missing
export errors as mock-module interoperability failures before changing
application code or authentication configuration.
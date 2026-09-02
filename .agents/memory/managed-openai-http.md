---
name: Managed OpenAI without SDK
description: Why PhotoMatrix calls Replit's managed OpenAI endpoint directly instead of depending on the OpenAI SDK.
---

The managed OpenAI integration may be called through its OpenAI-compatible HTTP endpoint when the workspace package installer rejects the OpenAI SDK.

**Why:** Two package-install attempts (pinned and latest) were rejected, while the managed endpoint worked successfully for vision analysis. Direct HTTP preserves managed billing and avoids bypassing the package firewall.

**How to apply:** For server-side AI work in this project, prefer the existing managed HTTP pattern unless a future package installation succeeds normally. Never expose or log the managed API key.
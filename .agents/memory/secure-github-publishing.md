---
name: Secure GitHub publishing
description: Safe way to push this project to GitHub without retaining credentials in the repository configuration.
---

Use a GitHub personal access token stored as the `GITHUB_TOKEN` Replit Secret. Push through a temporary authenticated URL, then restore `origin` to the credential-free HTTPS repository URL.

**Why:** A previously stored GitHub token expired, and leaving a replacement token in `.git/config` would expose it to anyone who can inspect the workspace.

**How to apply:** Never paste the token into chat or commit it. Use the secure secret environment variable for the push and reset the remote URL afterward.
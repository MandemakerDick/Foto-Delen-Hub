---
name: PhotoMatrix theme proposal channel
description: Native theme suggestions follow the email-for-review path used by club proposals.
---

Native Upload photo and owned-photo Edit both lead to a theme-proposal form that sends an email for administrator review. Sending a proposal must not add a public theme automatically. Unlike web theme proposals, these emailed native suggestions do not enter the web theme-proposal moderation queue.

**Why:** The user explicitly requested a new-theme proposal from both native photo forms, handled by email like a new-club proposal. The web app already has a separate database-backed theme-proposal workflow, so conflating the two would falsely suggest the native email appears in that review queue. The user later reported that the development phone's theme-proposal email check worked as intended; production delivery has not been confirmed.

**How to apply:** Keep sender name/email sourced from the authenticated server account, preserve the explicit review consent, identify the email as a theme proposal, and tell the photographer the theme has not been added. Verify received email in development and production before claiming delivery passed.
---
name: Feedback diagnostics privacy
description: Privacy rule for optional mobile feedback diagnostics and received-email verification.
---

Optional feedback diagnostics are an opt-in privacy boundary. Forward only reviewed non-sensitive fields from the server; never trust the mobile client alone to limit its payload. Without diagnostics opt-in, omit the entire diagnostics section from both plain-text and HTML emails.

Feedback and club proposals are attributed to the signed-in sender: include their linked photographer name (or account name when unlinked) and primary account email in the administrator email by default, sourced on the server rather than from client-submitted fields. Tell senders this on both forms; this attribution is separate from optional device diagnostics.

**Why:** The client sent only platform and OS version, but the server previously accepted arbitrary extra fields and included an empty diagnostics section in opted-out emails. A successful send did not prove that received email content respected consent; two new received Android emails later confirmed the corrected opt-out and opt-in behavior in development. The user later requested name and email attribution on both feedback and new-club proposals so admins know who to contact, then confirmed correct identity details appeared in received development emails of both types. This does not verify production delivery.

**How to apply:** When changing feedback fields, review the server allowlist and both email representations, then verify newly received emails for both settings. Keep sender identity independent of the diagnostics toggle. Do not treat older emails or a successful submission alert as evidence of the current email format.
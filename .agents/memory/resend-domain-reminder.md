---
name: Resend delivery
description: Durable sender and authentication decisions for PhotoMatrix transactional email.
---

# Resend delivery

Use `PhotoMatrix <noreply@connectingthedots.fit>` from the verified `connectingthedots.fit` domain. Authenticate direct Resend API calls with the securely stored send-only API key; do not use the Replit Resend connector.

**Why:** The connector repeatedly forwarded an invalid credential despite appearing enabled and connected. A direct send on 2026-09-21 was accepted and confirmed received with the restricted key.

**How to apply:** Keep the credential in Replit Secrets, retain sending-only access, and use the shared direct-email path for all transactional messages. Republish backend changes before expecting production to use them.

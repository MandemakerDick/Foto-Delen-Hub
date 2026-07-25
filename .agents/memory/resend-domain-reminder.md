---
name: Resend sending domain reminder
description: Remind the user on 2026-07-27 to configure a verified Resend sending domain for the photographer removal email.
---

# Resend Sending Domain — Action Required by 2026-07-27

**Reminder date:** 2026-07-27

The photographer removal notification email currently uses `onboarding@resend.dev` as the sender, which only works in Resend's test/sandbox mode.

**To fix for production:**
1. Verify a sending domain in the Resend dashboard (e.g. `photomatrix.com`)
2. Set the `EMAIL_FROM` environment variable on the API server:
   - Example value: `PhotoMatrix <noreply@yourdomain.com>`
   - Set it via the Replit environment secrets / env vars

**Why:** Without this, removal notification emails will either not reach photographers in production, or come from an unrecognised test address.

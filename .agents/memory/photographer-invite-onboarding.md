---
name: Photographer invite onboarding (Option B)
description: End-to-end architecture for admin-driven photographer onboarding via pre-linked invite tokens
---

## The flow

1. **Admin creates profile** — in Manage → Photographer tab, fills in the name/bio/clubs form and optionally enters an email address.
2. **Invite token created** — on successful create, if an email was given, `POST /api/invites/send-email` is called. This creates an `invite_token` row with `photographer_id` set to the new profile's ID (max 1 use, 30-day expiry) and emails the join link via Resend.
3. **Standalone invite** — unclaimed photographers (those with `claimed: false` in the API response) show an amber "Not yet signed in" badge and a "Send invite" button in the Manage photographer list. Clicking opens a dialog to enter an email and call the same `POST /api/invites/send-email` endpoint.
4. **Photographer redeems** — visits `/join/:token`, which calls `POST /api/invites/redeem`. If the token has `photographer_id`, the API stores `invitePhotographerId` in the session alongside the existing `inviteGranted` flag.
5. **Auto-link on my-photos** — `GET /api/invites/session` now returns `photographerId` in addition to `hasAccess`. `LinkProfilePanel` in `my-photos.tsx` calls `useGetInviteSession` and, when `photographerId` is present, bypasses the manual link/create form entirely and shows a one-click "Claim my profile" button that calls `POST /api/me/link`.

## Key DB columns added

- `invite_token.photographer_id` — nullable FK to `photographer.id ON DELETE SET NULL`

## Key API changes

- `GET /api/invites/session` — now returns `{ hasAccess, photographerId: number | null }`
- `POST /api/invites` — accepts optional `photographerId`
- `POST /api/invites/send-email` — admin-only; creates token + sends email; returns the token
- `GET /api/photographers` (list) — now includes `claimed: boolean` (`clerkUserId IS NOT NULL`) per row

**Why:** The old flow had no connection between profile creation and invite delivery. Admins had to create a profile in one tab, then generate a generic invite link in the Admins tab, then manually send it. Option B closes all three steps into one action.

**How to apply:** When adding invite-related features, always check `invite_token.photographer_id` — a token may or may not have a pre-linked profile. The `claimed` flag on the photographer list is the source of truth for whether a photographer has a Clerk account.

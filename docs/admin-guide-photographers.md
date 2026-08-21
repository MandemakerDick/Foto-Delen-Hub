# PhotoMatrix — Admin Guide: Managing Photographers

This guide covers the full lifecycle of a photographer in PhotoMatrix: creating their profile, sending an invite so they can claim the profile and sign in, editing existing profiles, and removing members.

All photographer management is done from the **Manage** page (`/manage`) → **Photographer** tab.

---

## Table of Contents

1. [Creating a Photographer Profile](#1-creating-a-photographer-profile)
2. [Sending an Invite Email](#2-sending-an-invite-email)
3. [The Invite & Claim Flow (What the Photographer Sees)](#3-the-invite--claim-flow-what-the-photographer-sees)
4. [Tracking Who Has Signed In](#4-tracking-who-has-signed-in)
5. [Re-sending an Invite](#5-re-sending-an-invite)
6. [Editing a Photographer Profile](#6-editing-a-photographer-profile)
7. [Removing a Photographer](#7-removing-a-photographer)

---

## 1. Creating a Photographer Profile

1. Go to **Manage → Photographer tab**.
2. Fill in the **Create Photographer** form at the top of the tab:

| Field | Required | Notes |
|---|---|---|
| **Photo (avatar)** | No | Click the camera circle to upload a portrait. JPG, PNG, WebP, max 5 MB. |
| **Name** | Yes | The photographer's display name across the site. |
| **Club membership** | No | Tick the clubs they belong to. Optionally enter the year they joined each club. |
| **Preferred themes** | No | Tick themes they specialise in — shown on their public profile. |
| **Biography** | No | A short text shown on their profile page. |
| **Email address** | No | If provided, an invite email is sent automatically the moment the profile is saved (see section 2). |

3. Click **Create photographer**.

If an email was entered, the invite is dispatched immediately — you do not need to take any further action. The email contains a one-time join link valid for 30 days.

---

## 2. Sending an Invite Email

An invite email contains a unique join link that is pre-linked to the photographer's profile. When the photographer opens the link and signs in (or creates an account), their new account is automatically connected to their profile — **no manual linking required**.

### When creating a profile

Enter the photographer's email address in the optional **Email address** field before clicking **Create photographer**. The invite is sent as part of the create action.

### From the photographer list (after creation)

Photographers who have not yet signed in show an amber **"Not yet signed in"** badge. Next to the badge is a **Send invite** button:

1. Click **Send invite**.
2. The dialog opens with the photographer's last-known email **pre-filled** (if an email was used before).
3. Adjust the email address if needed, then click **Send invite**.

The previous email is remembered automatically — you only need to retype it if you want to use a different address.

### From the edit form

When editing an unclaimed photographer, an **Email address** field with a **Send invite** button appears inside the edit form, above the Save / Cancel buttons:

1. Enter or confirm the email address.
2. Click **Send invite** — this sends the invite immediately without saving (or discarding) any other edits you may have open.
3. Continue editing and click **Save changes** when done.

---

## 3. The Invite & Claim Flow (What the Photographer Sees)

1. The photographer receives an email with a **Join PhotoMatrix** link.
2. They click the link and are taken to a sign-in / sign-up page.
3. After signing in (Google, email, or passkey), they see a **"Claim my profile"** screen showing their pre-built profile (name, avatar, clubs).
4. They click **Claim my profile** — their account is linked in one click.
5. They are redirected to their My Photos page, fully set up.

No manual searching or profile selection is needed. The invite token is single-use and expires after 30 days.

---

## 4. Tracking Who Has Signed In

The photographer list shows a status badge next to each name:

| Badge | Meaning |
|---|---|
| **Active** (green) | The photographer has signed in and claimed their profile. |
| **Not yet signed in** (amber) | The profile exists but no account has been linked yet. |

Claimed photographers hide the **Send invite** button — they already have an account and do not need one.

---

## 5. Re-sending an Invite

If a photographer did not receive their invite, lost the link, or the 30-day link expired:

1. Find them in the **Photographer** list.
2. Click **Send invite** next to the **"Not yet signed in"** badge.
3. Their previously used email is pre-filled in the dialog.
4. Click **Send invite** to issue a fresh link.

Each send creates a new token, so previous links are not invalidated automatically — but since each token is single-use, only the first redemption counts.

---

## 6. Editing a Photographer Profile

Click the **Edit** (pencil) button next to any photographer in the list. The form at the top of the tab switches to edit mode.

You can change:

- Avatar
- Name
- Club memberships and join years
- Preferred themes
- Biography

For **unclaimed** photographers, an additional **Email address** field with a **Send invite** button is shown — use it to send or resend an invite without leaving the edit form.

Click **Save changes** to apply edits, or **Cancel** to discard them.

> **Note:** Editing a claimed photographer's name here changes their display name on PhotoMatrix but does not affect their sign-in credentials (managed by Clerk).

---

## 7. Removing a Photographer

Click the **Delete** (bin) button next to a photographer in the list.

- All photos uploaded by that photographer are deleted first.
- If the photographer has a linked account and a removal reason is provided, a notification email is sent to them automatically before deletion.
- The action is **permanent** and cannot be undone.

---

*Last updated: August 2026*

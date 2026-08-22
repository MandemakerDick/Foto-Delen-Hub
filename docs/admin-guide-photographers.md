# PhotoMatrix — Admin Guide: Managing Photographers and Importing Photos

This guide covers the full lifecycle of a photographer in PhotoMatrix: creating their profile, sending an invite so they can claim the profile and sign in, editing existing profiles, removing members, and importing photos from a public portfolio URL.

Photographer management and URL imports are done from the **Manage** page (`/manage`). Photographer profiles use the **Photographer** tab; portfolio imports use the **Import** tab.

---

## Table of Contents

1. [Creating a Photographer Profile](#1-creating-a-photographer-profile)
2. [Sending an Invite Email](#2-sending-an-invite-email)
3. [The Invite & Claim Flow (What the Photographer Sees)](#3-the-invite--claim-flow-what-the-photographer-sees)
4. [Tracking Who Has Signed In](#4-tracking-who-has-signed-in)
5. [Re-sending an Invite](#5-re-sending-an-invite)
6. [Editing a Photographer Profile](#6-editing-a-photographer-profile)
7. [Removing a Photographer](#7-removing-a-photographer)
8. [Importing Photos from a URL](#8-importing-photos-from-a-url)

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

## 8. Importing Photos from a URL

The **Import** tab lets you pull photos from any public photographer portfolio page and add them to PhotoMatrix in four steps — without ever leaving the browser.

### 8.1 Opening the Import Tab

1. Sign in as an admin and navigate to **Manage** (`/manage`).
2. Select the **Import** tab in the top navigation row.

### 8.2 Step 1 — Enter a URL and Choose Storage Mode

| Field | What to do |
|---|---|
| **Portfolio URL** | Paste the full URL of the photographer's portfolio or gallery page (e.g. `https://janedoe.photography/gallery`). |
| **Storage mode** | Choose how images are stored (see below). |

#### Storage modes

**Download & store** *(recommended)*

The server downloads each selected image and saves it in PhotoMatrix's own object storage. Photos remain available even if the original website changes or disappears.

**Link only**

Records are created that point back to the original image URL. No storage is used, but photos will break if the source removes them.

Click **Scan for Photos** when ready. The server fetches the page and extracts every `<img>` element. Large pages may take a few seconds.

> **Note:** Password-protected pages, pages that require JavaScript rendering, or sites that block bots may not scan successfully. If the scan returns no photos, check that the URL is publicly accessible.

### 8.3 Step 2 — Select Photos

After a successful scan, a thumbnail grid appears showing every image found on the page.

- Click a thumbnail (or its checkbox) to **select / deselect** it.
- Use **Select All / Deselect All** to toggle the whole set.
- The counter in the top-right shows how many photos are currently selected.
- The original `alt` text appears below each thumbnail as a preview of the title that will be used.

Click **Next: Assign & Import** to continue. You must select at least one photo.

### 8.4 Step 3 — Assign Photographer, Club, and Titles

This is where you tell PhotoMatrix who took the photos and optionally group them.

#### Photographer

| Option | When to use |
|---|---|
| **+ Add new photographer** | The photographer does not yet exist in PhotoMatrix. Fill in their name and (optionally) a short bio — the bio is pre-filled from text the scanner found on the page; edit it as needed. |
| Select an existing name | The photographer already has a profile. Their photos will be added to their existing portfolio. |

> The **Import** button stays disabled until a photographer name is provided when **Add new** is selected.

#### Club

A club is **required** before you can import. Select an existing club from the list, or choose **+ Add new club** and type the club name. The Import button stays disabled until a club is chosen.

#### Per-photo Title and Theme

Every selected photo appears in a scrollable list with two editable fields:

| Field | Notes |
|---|---|
| **Title** | **Required.** The scanner pre-fills this from the image's `alt` text. Titles that look like camera filenames (e.g. `IMG_20240315_123456.jpg`, `DSC_0042`, `PXL_20230901`) are automatically cleared and shown with a **red border** — you must type a real title before importing. |
| **Theme** | Optional. Assign the photo to one of the site's themes. Defaults to **No theme**. |

> You can scroll through the list and edit titles/themes before clicking **Import**. All red-bordered fields must be filled in — if you click Import with any title still empty, a toast message will tell you which photo needs a title.

Click **Import *N* photos** to start. A spinner shows progress; do not close the tab while importing.

### 8.5 Step 4 — Import Complete

A confirmation screen shows:

- How many photos were **imported successfully**.
- How many **failed** (network errors, unsupported formats, etc.).

Click **Import More** to return to Step 1 and start a new import session.

> Photos that fail do not create partial records. You can safely re-scan the same URL and import only the failed ones.

### 8.6 Tips and Edge Cases

#### Photographer already exists but their name is slightly different

Choose their existing entry from the dropdown rather than creating a duplicate. You can always edit the photographer's name and bio later from the **Photographers** tab.

#### Some photos scanned but are showing as broken thumbnails

The proxy preview in Step 2 fetches images through the server to bypass CORS restrictions. A broken thumbnail usually means the source URL requires a session cookie or referrer header. Those photos will most likely fail to download — deselect them.

#### File-slug titles were cleared but the scanner found no `alt` text

This happens on sites that use filenames as `alt` attributes or that omit `alt` entirely. Simply type a descriptive title in the red field.

#### “Download & store” vs “Link only” — which to choose?

Use **Download & store** unless you are running a storage-constrained pilot or the photographer explicitly wants to keep photos on their own server. Link-only imports are fragile and can leave broken images in the gallery if the source disappears.

#### Importing the same photo twice

The import does not deduplicate by image URL. If you re-scan and re-import the same URL, you will create duplicate records. Always check whether the photos are already in the gallery before re-importing.

---

*Last updated: August 2026*

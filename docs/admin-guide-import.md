# PhotoMatrix — Admin Guide: Importing Photos from a URL

This guide walks through the **Import** tab in the admin panel. It lets you pull photos from any public photographer portfolio page and add them to PhotoMatrix in four steps — without ever leaving the browser.

---

## Table of Contents

1. [Opening the Import Tab](#1-opening-the-import-tab)
2. [Step 1 — Enter a URL and Choose Storage Mode](#2-step-1--enter-a-url-and-choose-storage-mode)
3. [Step 2 — Select Photos](#3-step-2--select-photos)
4. [Step 3 — Assign Photographer, Club, and Titles](#4-step-3--assign-photographer-club-and-titles)
5. [Step 4 — Import Complete](#5-step-4--import-complete)
6. [Tips and Edge Cases](#6-tips-and-edge-cases)

---

## 1. Opening the Import Tab

1. Sign in as an admin and navigate to **Manage** (`/admin`).
2. Select the **Import** tab in the top navigation row.

---

## 2. Step 1 — Enter a URL and Choose Storage Mode

| Field | What to do |
|---|---|
| **Portfolio URL** | Paste the full URL of the photographer's portfolio or gallery page (e.g. `https://janedoe.photography/gallery`). |
| **Storage mode** | Choose how images are stored (see below). |

### Storage modes

**Download & store** *(recommended)*
The server downloads each selected image and saves it in PhotoMatrix's own object storage. Photos remain available even if the original website changes or disappears.

**Link only**
Records are created that point back to the original image URL. No storage is used, but photos will break if the source removes them.

Click **Scan for Photos** when ready. The server fetches the page and extracts every `<img>` element. Large pages may take a few seconds.

> **Note:** Password-protected pages, pages that require JavaScript rendering, or sites that block bots may not scan successfully. If the scan returns no photos, check that the URL is publicly accessible.

---

## 3. Step 2 — Select Photos

After a successful scan, a thumbnail grid appears showing every image found on the page.

- Click a thumbnail (or its checkbox) to **select / deselect** it.
- Use **Select All / Deselect All** to toggle the whole set.
- The counter in the top-right shows how many photos are currently selected.
- The original `alt` text appears below each thumbnail as a preview of the title that will be used.

Click **Next: Assign & Import** to continue. You must select at least one photo.

---

## 4. Step 3 — Assign Photographer, Club, and Titles

This is where you tell PhotoMatrix who took the photos and optionally group them.

### Photographer

| Option | When to use |
|---|---|
| **+ Add new photographer** | The photographer does not yet exist in PhotoMatrix. Fill in their name and (optionally) a short bio — the bio is pre-filled from text the scanner found on the page; edit it as needed. |
| Select an existing name | The photographer already has a profile. Their photos will be added to their existing portfolio. |

> The **Import** button stays disabled until a photographer name is provided when "Add new" is selected.

### Club (Optional)

Leave this on **None** if the photos should not be linked to a club. Otherwise:
- Select an existing club from the list, or
- Choose **+ Add new club** and type the club name.

### Per-photo Title and Theme

Every selected photo appears in a scrollable list with two editable fields:

| Field | Notes |
|---|---|
| **Title** | **Required.** The scanner pre-fills this from the image's `alt` text. Titles that look like camera filenames (e.g. `IMG_20240315_123456.jpg`, `DSC_0042`, `PXL_20230901`) are automatically cleared and shown with a **red border** — you must type a real title before importing. |
| **Theme** | Optional. Assign the photo to one of the site's themes. Defaults to "No theme". |

> You can scroll through the list and edit titles/themes before clicking Import. All red-bordered fields must be filled in — if you click Import with any title still empty, a toast message will tell you which photo needs a title.

Click **Import *N* photos** to start. A spinner shows progress; do not close the tab while importing.

---

## 5. Step 4 — Import Complete

A confirmation screen shows:

- How many photos were **imported successfully**.
- How many **failed** (network errors, unsupported formats, etc.).

Click **Import More** to return to Step 1 and start a new import session.

> Photos that fail do not create partial records. You can safely re-scan the same URL and import only the failed ones.

---

## 6. Tips and Edge Cases

### Photographer already exists but their name is slightly different
Choose their existing entry from the dropdown rather than creating a duplicate. You can always edit the photographer's name and bio later from the **Photographers** tab.

### Some photos scanned but are showing as broken thumbnails
The proxy preview in Step 2 fetches images through the server to bypass CORS restrictions. A broken thumbnail usually means the source URL requires a session cookie or referrer header. Those photos will most likely fail to download — deselect them.

### File-slug titles were cleared but the scanner found no `alt` text
This happens on sites that use filenames as `alt` attributes or that omit `alt` entirely. Simply type a descriptive title in the red field.

### "Download & store" vs "Link only" — which to choose?
Use **Download & store** unless you are running a storage-constrained pilot or the photographer explicitly wants to keep photos on their own server. Link-only imports are fragile and can leave broken images in the gallery if the source disappears.

### Importing the same photo twice
The import does not deduplicate by image URL. If you re-scan and re-import the same URL, you will create duplicate records. Always check whether the photos are already in the gallery before re-importing.

---

*Last updated: July 2026*

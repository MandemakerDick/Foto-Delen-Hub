# PhotoMatrix — Web Admin Guide: Importing Photos from a URL

Use the admin **Import** tab to scan a portfolio page, select images, and create photo records. Scan and import are admin-only API operations. A scan may not find every image on a site, and availability depends on the source page and image URLs.

---

## Table of Contents

1. [Open Import](#1-open-import)
2. [Enter a URL and Choose Storage](#2-enter-a-url-and-choose-storage)
3. [Select Photos](#3-select-photos)
4. [Assign Photographer, Club, and Photo Details](#4-assign-photographer-club-and-photo-details)
5. [Review the Result](#5-review-the-result)
6. [API and Practical Notes](#6-api-and-practical-notes)

---

## 1. Open Import

1. Sign in as an administrator and open **Manage** at `/manage`.
2. Choose the **Import** tab inside Manage.

**Import** is not a top-level site-navigation link. The import UI calls the admin-only API routes `POST /api/admins/import-from-url/scan`, `GET /api/admins/import-from-url/proxy` for image previews, and `POST /api/admins/import-from-url/import`.

---

## 2. Enter a URL and Choose Storage

In **Import Photos from URL**, enter a portfolio page URL in **Portfolio URL**, then choose **Storage mode**:

- **Download & store** downloads each selected image and stores a copy in PhotoMatrix storage. The source is still needed for scanning and fetching the image during import; a failed image fetch can fail that image's import.
- **Link only** creates a record using the source image URL rather than downloading a copy. The source must continue serving the image for it to remain available.

Click **Scan for Photos**. The scan attempts to retrieve the page and discover candidate images; pages requiring a login, JavaScript rendering, or special access may not produce usable results. A successful scan can include a guessed photographer name, biography text, image URLs, and alt text where available. These are suggestions, not verified metadata.

---

## 3. Select Photos

The **Select Photos** step shows a preview grid. The UI selects all discovered images initially.

- Click a thumbnail or its checkbox to select or deselect it.
- Use **Select All** or **Deselect All** to change the selection.
- The count shows how many of the scanned images are selected.
- The text shown on a thumbnail comes from its available alt text, or **Untitled** when none is available; it is not necessarily the final photo title.

Click **Next: Assign & Import (N photos)** to continue. This button is disabled if no images are selected. **Back** returns to the URL step.

---

## 4. Assign Photographer, Club, and Photo Details

The next step is **Assign & Import**. The page says how many photos are selected.

### Photographer

Choose **+ Add new photographer** or an existing photographer. For a new profile, the **New Photographer Name** is required by the UI before import; the name and optional **Bio** are prefilled from scan results when available. If you select an existing profile, its existing profile is used instead.

### Club (optional)

**Club** is explicitly optional. Choose **No club** to leave imported photos without a club, an existing club to assign one, or **+ Add new club** and enter a name. A new photographer is associated with the selected club when a club is chosen.

### Per-photo title and theme

Each selected photo has an editable title field and a theme selector. The UI also offers an **Apply theme to all** selector.

- The title starts with the image alt text when usable. Blank, generic, or filename-like titles may be replaced with a generated `Photo import #N` title.
- Blank or filename-like titles receive an amber warning. This is a warning, not a hard import requirement: the current Import button enablement checks selection, pending state, a new photographer's name, and a new club's name; it does not require a manually entered title. The API also falls back to a title derived from the image URL if the submitted title is blank.
- Theme is optional; **No theme** is available. The UI notes that unthemed imports may receive an AI theme suggestion after import. AI analysis is asynchronous, so do not treat a suggestion as a guaranteed import result.

Click **Import N photos**. The button changes to an importing state while the request is in progress.

---

## 5. Review the Result

The **Import Complete** view reports the number imported successfully and, when applicable, the number that failed. The API processes images individually, so a response may contain both successful and failed items. It does not promise that every selected image will import.

Click **Import More** to reset the form and start another scan.

---

## 6. API and Practical Notes

- The scan, preview proxy, and import routes require admin access. The import request accepts image URLs and optional photographer, club, theme, and link-only settings. The UI sends per-photo title and theme values; club assignment is optional.
- With **Download & store**, the API fetches each image and creates a storage copy. With **Link only**, it records the source URL. Fetch failures and non-image or unusably small responses can cause individual failures.
- The API returns imported and failed counts. Since imports are not guaranteed to succeed as a whole, check the result before deciding whether to retry. The interface does not identify failed items individually for selective retry.
- The import flow does not provide a guarantee of duplicate detection. Check the gallery before importing the same portfolio again.

---

*Last updated: September 2026*
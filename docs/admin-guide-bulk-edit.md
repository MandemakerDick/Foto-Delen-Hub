# PhotoMatrix — Admin Guide: Bulk-Editing Photos

Admins can edit the title, theme, and club of multiple photos at once directly from a **photographer's portfolio page** or a **club's photo list**. This is faster than opening each photo individually and is the recommended way to correct metadata after an import.

---

## Table of Contents

1. [Opening the Bulk Editor](#1-opening-the-bulk-editor)
2. [Editing Fields](#2-editing-fields)
3. [Saving Changes](#3-saving-changes)
4. [Tips](#4-tips)

---

## 1. Opening the Bulk Editor

The **Edit photos** button appears next to the **Portfolio** or **Photos** heading whenever you are signed in as an admin and the photographer or club has at least one photo.

- **Photographer page** — navigate to a photographer's profile. The button sits beside the "Portfolio" heading.
- **Club page** — navigate to a club's detail page. The button sits beside the "Photos" heading.

Click **Edit photos** to enter bulk-edit mode. The photo grid is replaced by a scrollable list of rows, one per photo.

> Theme filter chips (if active on the photographer page) are hidden while bulk-edit mode is open, but the **Edit photos** button remains visible while filtering — so you can filter to a theme, spot a mislabelled photo, and immediately open the editor.

---

## 2. Editing Fields

Each row in the bulk editor shows:

| Element | Description |
|---|---|
| **Thumbnail** | A square preview of the photo — for quick identification. |
| **Title** | Free-text field. A row with a blank title gets an amber highlight. |
| **Theme** | Drop-down. Select a theme or leave as "No theme". |
| **Club** | Drop-down. Select a club or leave as "No club". |

Rows you have changed turn **blue** (primary colour highlight) so you can see at a glance what is pending. Unchanged rows have no highlight.

---

## 3. Saving Changes

The bottom bar shows two buttons:

- **Cancel** — discards all unsaved changes and returns to the normal photo view.
- **Save *N* changes** — sends a PATCH request for each modified photo and refreshes the list. The button is labelled **No changes** and disabled when nothing has been edited.

A spinner replaces the button label while saving. After a successful save, a toast confirms how many photos were updated.

---

## 4. Tips

### Filtering first
On the photographer page, apply a theme filter before clicking **Edit photos**. Only photos matching the filter will appear in the bulk editor — useful when you want to rename all photos in a specific theme.

### Importing and then correcting
After importing a batch of photos, check their themes on the photographer's page. If titles or themes were not set correctly during import, use the bulk editor to fix them without re-importing.

### Partial saves are safe
If you close the editor (Cancel) before saving, no changes are applied. Only the rows you explicitly save are touched.

---

*Last updated: August 2026*

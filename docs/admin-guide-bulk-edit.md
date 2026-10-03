# PhotoMatrix — Web Admin Guide: Bulk Photo Management

PhotoMatrix's bulk photo tools are selection-based modes on **Manage > Photos** (`/manage`). They are not a per-photo detail-page editor: they do not provide bulk title or theme editing. The available bulk actions are assigning a club to selected photos and permanently deleting selected photos.

---

## Table of Contents

1. [Open a Bulk Mode](#1-open-a-bulk-mode)
2. [Filter and Select Photos](#2-filter-and-select-photos)
3. [Assign a Club](#3-assign-a-club)
4. [Delete Selected Photos](#4-delete-selected-photos)
5. [API Behavior](#5-api-behavior)

---

## 1. Open a Bulk Mode

1. Sign in as an administrator and open **Manage** (`/manage`).
2. Choose **Photos**.
3. Under **Bulk photo management**, choose one of the displayed modes:
   - **Bulk Club Assignment**
   - **Bulk Delete Photos**

The mode opens a filterable list of photos. Use **Change** to return to the mode picker.

---

## 2. Filter and Select Photos

In either mode, narrow the list with the club filter (**All clubs**, **No club**, or a specific club) and the photographer filter (**All photographers** or a specific photographer). Changing either filter clears the current selection.

- Select individual photos with their checkboxes.
- **Select All** selects every photo currently shown by the filters.
- **Clear Selection** removes the current selection.
- The count beside the controls shows how many photos are selected.

Rows display a thumbnail, title, club, and photographer when available. These are identification details, not editable fields.

---

## 3. Assign a Club

Choose **Bulk Club Assignment**. After selecting one or more photos, choose a destination club and click **Assign Club (N)**. The action is disabled until there is a selection and a club has been chosen. The operation changes the selected photos' club assignment; it does not edit their titles, themes, or photographer.

The UI reports the number of photos updated and clears the selection after success.

---

## 4. Delete Selected Photos

Choose **Bulk Delete Photos**, select the photos, and click **Delete (N)**. Review the confirmation dialog, then choose **Delete photos** to confirm. This permanently removes the selected photo records; the action cannot be undone. On success, the UI reports the count and clears the selection.

---

## 5. API Behavior

The web UI uses the admin-only `PATCH /api/photos/bulk-club` endpoint with selected `photoIds` and a destination `clubId`, and `DELETE /api/photos/bulk-delete` with selected `photoIds`. The API validates that the ID list is non-empty and contains positive integers. The club-assignment endpoint applies a single club to all submitted photo IDs; it does not expose title or theme editing.

---

*Last updated: September 2026*
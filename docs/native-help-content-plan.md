# PhotoMatrix — Native Help Content Candidates

The updated [PhotoMatrix web guide](user-guide.md) is a **content source**, not a set of instructions to paste into the native app. Web and native share the photo, club, theme, and photographer concepts, but their controls and some workflows differ. The three [web admin guides](admin-guide-photographers.md) should remain web-only: the native app has no Manage/import/bulk-admin screens.

## Short native Help topics

| Topic | Native-specific guidance to write |
|---|---|
| Get started | Sign in, verify email when asked, redeem an invite, then claim/link the correct photographer profile. Explain when to paste an invite code instead of opening its web link. |
| Explore | Find the Gallery, use search and Filters, browse Clubs/Themes/Photographers, open details, and use Load more. |
| Share a photo | Choose camera or photo library, allow access if desired, review the draft, enter title/optional club/theme/description, then explicitly confirm Upload. Explain that choosing a photo alone does not upload it. |
| Manage your work | Open My photos, edit or delete your own photos, and use the native tap-to-move reorder grid followed by Save order or Cancel. |
| Participate | Like and comment when signed in; join or leave a club from Club detail with a linked photographer profile. |
| Profile and proposals | Edit name, bio, memberships, and themes in Edit photographer profile; Propose theme and Propose club are alongside their pickers. Native proposals go by review email, **not** to the web's tracked theme-proposal queue. General Send feedback sits below Save and Cancel. |
| Troubleshooting and contact | Camera/library permissions after denial, sign-in or invite trouble, upload failure, and Send feedback. Explain that diagnostics are optional and only included with consent. |

Keep each article brief and available in **English and Dutch**. A labeled Help link on Home (or the account area) can open a dedicated screen; do not add another bottom tab. End each topic with a relevant in-app destination and a general Send feedback link. Avoid copying web-only instructions such as Add to Home Screen, web passkeys, URL import, drag-and-drop reordering, the web theme proposal status queue, or admin bulk edit.

**Release gate:** Confirm exact wording on installed iOS and Android builds before shipping Help claims about camera/photo-library denial and re-enabling, Clerk verification, invite deep-link handoff, presigned uploads, and production feedback delivery. The current browser preview does not verify those device behaviors. See [native release checks](../artifacts/photomatrix-native/RELEASE.md). This is a content plan, not a shipped Help screen.
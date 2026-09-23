# PhotoMatrix native release handoff

PhotoMatrix is an Expo companion to PhotographersHub. It uses the same Clerk identity and the existing PhotoMatrix API, so the API and web service must be published and reachable before a store release. Review the production API domain injected into `EXPO_PUBLIC_DOMAIN`; do not hardcode a development `.replit.dev` hostname in an app-store build.

## Before submission

1. On physical iOS and Android devices, check public discovery, a full 24-photo Gallery page followed by the next cursor, combined filters, grouping, seeded random links, photo details, and Dutch/English labels.
2. With a test account, verify sign-in, sign-out, invite redemption/profile linking, a gallery/camera photo upload, update and delete of **only your own** photos, likes, comments, and denied/re-enabled media permissions. Check that cancelled uploads and failed requests show a retry path.
3. Test the `photomatrix-native://` links with filter parameters and an invite link. Web invite links still open the website; a member can paste their invitation token into the native sign-in flow.
4. Send feedback with diagnostic consent both unchecked and checked. Diagnostic information should be sent only on explicit consent and should never contain tokens, contact lists, image bytes, or stored session details.
5. Confirm the final app icon, display name, splash/background, camera/photo-library usage descriptions, privacy disclosures, accessibility labels, supported language screenshots, and support contact. Confirm backend and Clerk production origins allow mobile bearer tokens.

## Publishing

- **iOS:** Replit's Expo Launch handles build, signing, and App Store submission. An Apple Developer Program membership and App Store Connect review are required. Confirm the permanent iOS bundle identifier before the first submission; changing it later creates a different store app.
- **Android:** Replit currently previews Android but does not submit to Google Play. A separate Android build/signing and Play Console submission workflow is required outside Replit. Keep the Android package identifier, signing key, privacy declaration, and store listing consistent with this project.
- Publish only after physical-device QA. Replit's web preview is useful for layout checks but is not a substitute for camera, media-library, deep-link, and Clerk redirects on a device.

## Operational diagnostics

Use the API workflow logs to investigate upload/link/feedback failures. If a member reports an error, request the screen, approximate time, platform, and whether they chose to include diagnostic context; never ask them to send their Clerk session token or invitation URL. Keep server email delivery non-blocking for successful uploads/comments.
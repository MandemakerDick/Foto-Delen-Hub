# PhotoMatrix — Web Admin Guide: Managing Photographers

This guide covers creating and maintaining photographer profiles in the PhotoMatrix web admin, sending profile-claim invitations, and removing profiles. URL photo imports have their own focused guide: [Importing Photos from a URL](admin-guide-import.md).

Photographer administration is on **Manage > Photographer** at `/manage`. The **Manage** page is an admin area; **Import** is one of its internal tabs, not a top-level site-navigation item.

---

## Table of Contents

1. [Creating a Photographer Profile](#1-creating-a-photographer-profile)
2. [Sending an Invite](#2-sending-an-invite)
3. [The Invite and Claim Flow](#3-the-invite-and-claim-flow)
4. [Checking Claim Status](#4-checking-claim-status)
5. [Editing a Photographer Profile](#5-editing-a-photographer-profile)
6. [Removing a Photographer](#6-removing-a-photographer)

---

## 1. Creating a Photographer Profile

1. Sign in with an admin account and open **Manage** (`/manage`).
2. Choose the **Photographer** tab.
3. Complete the **Add Photographer** form:

| Field | Required | Notes |
|---|---|---|
| **Photo** | No | Click the photo area to upload an avatar. The UI accepts one file up to 5 MB. |
| **Name** | Yes | The photographer's display name. |
| **Club memberships** | No | Select any clubs they belong to. A **Since year** field appears for each selected club. |
| **Preferred Themes** | No | Select themes associated with the photographer's profile. |
| **Biography** | No | Optional profile text. |
| **Email address** | No | On the create form this field is labelled “Email address — sends a join link immediately (optional).” If provided, the UI creates the profile and then makes a separate invite-email request. Email delivery is not guaranteed; see [Sending an Invite](#2-sending-an-invite). |

4. Click **Add Photographer**.

The profile is created independently of the invite request. If the invite attempt fails, the profile remains created. You can use **Send invite** in the photographer list afterward.

---

## 2. Sending an Invite

An invitation creates a single-use link associated with a specific photographer profile. The current invite endpoint sets the link to expire after 30 days. The admin UI reports a successful request as **Invite sent**, but that response does not guarantee the message reached the recipient (the mail provider may fail after the invite record is created).

### From the photographer list

1. In **Manage > Photographer**, find the intended profile. Unclaimed profiles display **Not yet signed in**.
2. Click **Send invite**. The dialog is titled **Send invite to [name]**. If an email address has previously been used for that profile, it is prefilled.
3. Confirm or change the address and click **Send invite** in the dialog.

### From the edit form

For an unclaimed photographer, **Edit** opens the profile form with an email field and a separate **Send invite** button. Enter the address and click **Send invite** to issue the invite. This is a separate action from **Save Changes**; editing a profile or entering an address in this form alone does not send an invite. The edit-form email value is supplied to the invite action, not saved by the profile update.

Claimed profiles do not show the invite controls.

If the photographer cannot find the message, verify the address and use **Send invite** to make another attempt. Do not treat the UI's success notice as confirmation of email delivery.

---

## 3. The Invite and Claim Flow

1. The invitation points to a `/join/<token>` page. The recipient redeems the invite and signs in or creates an account.
2. The invite is associated with the profile in advance; it does not ask the recipient to search through profiles.
3. In the web flow, the recipient opens **My Photos** and sees a pre-linked profile claim prompt with the **Claim my profile** action.
4. After they claim it, their account is connected to that photographer profile.

Invite tokens can expire or be revoked, and a single-use invitation cannot be redeemed repeatedly. The claim is conditional on the profile not already being linked to another account.

---

## 4. Checking Claim Status

The list under **Existing Photographers** shows **Not yet signed in** for profiles that have not been claimed. A profile without this marker is already claimed. **Send invite** is only shown for unclaimed profiles.

---

## 5. Editing a Photographer Profile

Click **Edit** beside a photographer in **Existing Photographers**. The form changes to **Edit Photographer** and is brought into view.

You can update the avatar, name, club memberships and their **Since year** values, preferred themes, and biography. Click **Save Changes** to apply those profile edits, or **Cancel** to discard them. For an unclaimed profile, use the separate invite controls described above; the edit form does not provide an email field for claimed photographers.

---

## 6. Removing a Photographer

Click **Delete** beside the profile and review the removal dialog before confirming. Removal permanently deletes the photographer and their photos. The dialog includes an optional reason; when a linked photographer account and a reason are both present, the server attempts to send a removal notification. Delivery is not guaranteed.

---

*Last updated: September 2026*
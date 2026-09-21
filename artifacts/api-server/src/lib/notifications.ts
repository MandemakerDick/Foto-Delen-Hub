import { clerkClient } from "@clerk/express";
import { db, photographersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { sendEmail } from "./email";

type EmailMessage = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getPhotographerClerkUserId(photographerId: number) {
  const [photographer] = await db
    .select({ clerkUserId: photographersTable.clerkUserId })
    .from(photographersTable)
    .where(eq(photographersTable.id, photographerId));
  return photographer?.clerkUserId ?? null;
}

async function sendToClerkUser(clerkUserId: string | null, message: EmailMessage) {
  if (!clerkUserId) return;

  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const primaryEmail = clerkUser.emailAddresses.find(
      (address) => address.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
    if (!primaryEmail) return;

    await sendEmail({
      to: primaryEmail,
      ...message,
    });
  } catch (err) {
    logger.warn({ err, clerkUserId }, "Unable to send PhotoMatrix notification email");
  }
}

export async function sendPhotoUploadConfirmation(photographerId: number, photoTitle: string) {
  const clerkUserId = await getPhotographerClerkUserId(photographerId);
  const title = escapeHtml(photoTitle);
  await sendToClerkUser(clerkUserId, {
    subject: `Your photo "${photoTitle}" is now in PhotoMatrix`,
    html: `<p>Your photo <strong>${title}</strong> has been added to the PhotoMatrix gallery.</p><p>Thank you for sharing your work.</p><p>— The PhotoMatrix Team</p>`,
    text: `Your photo "${photoTitle}" has been added to the PhotoMatrix gallery.\n\nThank you for sharing your work.\n\n— The PhotoMatrix Team`,
  });
}

export async function sendPhotoCommentNotification(
  ownerPhotographerId: number,
  photoTitle: string,
  commenterName: string,
  commentBody: string,
) {
  const clerkUserId = await getPhotographerClerkUserId(ownerPhotographerId);
  const safeTitle = escapeHtml(photoTitle);
  const safeCommenter = escapeHtml(commenterName);
  const safeComment = escapeHtml(commentBody);
  await sendToClerkUser(clerkUserId, {
    subject: `New comment on "${photoTitle}"`,
    html: `<p><strong>${safeCommenter}</strong> commented on your photo <strong>${safeTitle}</strong>:</p><blockquote>${safeComment}</blockquote><p>— The PhotoMatrix Team</p>`,
    text: `${commenterName} commented on your photo "${photoTitle}":\n\n${commentBody}\n\n— The PhotoMatrix Team`,
  });
}
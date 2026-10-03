import { Router } from "express";
import { clerkClient } from "@clerk/express";
import { db, adminsTable, photographersTable } from "@workspace/db";
import { eq, isNotNull } from "drizzle-orm";
import { sendEmail } from "../lib/email";
import { formatFeedbackEmail } from "../lib/feedbackEmail";
import { requireAuth } from "./auth";

const router = Router();

// Diagnostics are opt-in and deliberately constrained to non-sensitive fields.
// The endpoint accepts Clerk bearer auth, so native clients do not need a
// browser session cookie.
router.post("/feedback", requireAuth, async (req: any, res) => {
  const { consent, message, diagnostics } = req.body ?? {};
  if (typeof message !== "string" || message.trim().length < 1 || message.length > 4000) {
    res.status(400).json({ error: "Feedback message is required and must be at most 4000 characters" });
    return;
  }
  if (diagnostics !== undefined && (typeof diagnostics !== "object" || diagnostics === null || Array.isArray(diagnostics))) {
    res.status(400).json({ error: "Diagnostics must be an object" });
    return;
  }
  if (diagnostics !== undefined && consent !== true) {
    res.status(400).json({ error: "Explicit diagnostics consent is required to include diagnostics" });
    return;
  }

  let recipient = process.env.FEEDBACK_EMAIL ?? process.env.ADMIN_EMAIL;
  if (!recipient) {
    // Admin email records are the configured application recipient fallback;
    // this avoids requiring a second environment setting for feedback.
    const admins = await db
      .select({ email: adminsTable.email })
      .from(adminsTable)
      .where(isNotNull(adminsTable.email));
    recipient = admins.map((admin) => admin.email?.trim()).find(Boolean);
  }
  if (!recipient) {
    res.status(503).json({ error: "Feedback delivery is not configured" });
    return;
  }

  try {
    const [account, linkedPhotographers] = await Promise.all([
      clerkClient.users.getUser(req.clerkUserId),
      db.select({ name: photographersTable.name })
        .from(photographersTable)
        .where(eq(photographersTable.clerkUserId, req.clerkUserId))
        .limit(1),
    ]);
    const email = account.emailAddresses.find(address => address.id === account.primaryEmailAddressId)?.emailAddress
      ?? account.emailAddresses[0]?.emailAddress;
    if (!email) {
      res.status(422).json({ error: "An account email is required to send feedback" });
      return;
    }
    const name = linkedPhotographers[0]?.name?.trim()
      || [account.firstName, account.lastName].filter(Boolean).join(" ").trim()
      || "No linked photographer profile";
    await sendEmail({
      to: recipient,
      subject: "PhotoMatrix mobile feedback",
      ...formatFeedbackEmail(message, { name, email }, consent === true ? diagnostics : undefined),
    });
  } catch (error) {
    req.log.error({ error }, "Failed to deliver feedback");
    res.status(502).json({ error: "Feedback could not be delivered" });
    return;
  }
  res.status(202).json({ ok: true });
});

export default router;
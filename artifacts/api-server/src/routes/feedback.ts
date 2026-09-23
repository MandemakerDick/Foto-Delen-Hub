import { Router } from "express";
import { db, adminsTable } from "@workspace/db";
import { isNotNull } from "drizzle-orm";
import { sendEmail } from "../lib/email";
import { requireAuth } from "./auth";

const router = Router();

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

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

  const safeDiagnostics = consent === true && diagnostics
    ? Object.fromEntries(Object.entries(diagnostics).slice(0, 20).map(([key, value]) => [
      key.slice(0, 80),
      typeof value === "string" ? value.slice(0, 500) : String(value).slice(0, 500),
    ]))
    : {};
  const diagnosticText = JSON.stringify(safeDiagnostics, null, 2);
  try {
    await sendEmail({
      to: recipient,
      subject: "PhotoMatrix mobile feedback",
      html: `<p>${escapeHtml(message.trim())}</p><pre>${escapeHtml(diagnosticText)}</pre>`,
      text: `${message.trim()}\n\nDiagnostics (consented):\n${diagnosticText}`,
    });
  } catch (error) {
    req.log.error({ error }, "Failed to deliver feedback");
    res.status(502).json({ error: "Feedback could not be delivered" });
    return;
  }
  res.status(202).json({ ok: true });
});

export default router;
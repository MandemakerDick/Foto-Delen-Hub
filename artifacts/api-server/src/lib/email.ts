type EmailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  from?: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

export async function sendEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: message.from ?? process.env.EMAIL_FROM ?? "PhotoMatrix <noreply@connectingthedots.fit>",
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  const result = await response.json().catch(() => ({})) as ResendResponse;
  if (!response.ok) {
    throw new Error(`Resend email failed (${response.status}): ${result.message ?? result.name ?? "Unknown error"}`);
  }

  return result.id ?? null;
}
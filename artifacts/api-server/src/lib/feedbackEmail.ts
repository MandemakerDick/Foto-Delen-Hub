function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

// Never forward arbitrary client-supplied diagnostic fields into an email.
export function formatFeedbackEmail(
  message: string,
  sender: { name: string; email: string },
  diagnostics?: Record<string, unknown>,
) {
  const safeDiagnostics: Record<string, string> = {};
  if (diagnostics?.platform === "android" || diagnostics?.platform === "ios" || diagnostics?.platform === "web") {
    safeDiagnostics.platform = diagnostics.platform;
  }
  const version = diagnostics?.version;
  if ((typeof version === "string" || typeof version === "number") && /^\d{1,3}(?:\.\d{1,3}){0,3}$/.test(String(version))) {
    safeDiagnostics.version = String(version);
  }

  const diagnosticText = Object.keys(safeDiagnostics).length ? JSON.stringify(safeDiagnostics, null, 2) : null;
  const body = message.trim();
  return {
    html: `<p><strong>Photographer:</strong> ${escapeHtml(sender.name)}<br /><strong>Email:</strong> ${escapeHtml(sender.email)}</p><p>${escapeHtml(body)}</p>${diagnosticText ? `<p>Diagnostics (consented):</p><pre>${escapeHtml(diagnosticText)}</pre>` : ""}`,
    text: `Photographer: ${sender.name}\nEmail: ${sender.email}\n\n${body}${diagnosticText ? `\n\nDiagnostics (consented):\n${diagnosticText}` : ""}`,
  };
}
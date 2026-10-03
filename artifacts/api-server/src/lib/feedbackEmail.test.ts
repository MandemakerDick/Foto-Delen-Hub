import { describe, expect, it } from "vitest";
import { formatFeedbackEmail } from "./feedbackEmail";

describe("feedback email diagnostics", () => {
  const sender = { name: "Photographer A", email: "photo@example.com" };
  it("omits the diagnostics section entirely without opt-in data", () => {
    const email = formatFeedbackEmail("Test feedback", sender);
    expect(email.text).toBe("Photographer: Photographer A\nEmail: photo@example.com\n\nTest feedback");
    expect(email.html).toContain("<strong>Photographer:</strong> Photographer A<br /><strong>Email:</strong> photo@example.com");
    expect(email.html).not.toContain("Diagnostics");
  });

  it("includes only platform and OS version from opted-in diagnostics", () => {
    const email = formatFeedbackEmail("Test feedback", sender, {
      platform: "android",
      version: 17,
      sessionToken: "sensitive",
      contacts: "private",
    });
    expect(email.text).toContain('"platform": "android"');
    expect(email.text).toContain('"version": "17"');
    expect(email.html).toContain("Diagnostics (consented):");
    expect(email.text).not.toContain("sensitive");
    expect(email.text).not.toContain("private");
    expect(email.html).not.toContain("sessionToken");
  });

  it("omits invalid values and escapes feedback in HTML", () => {
    const email = formatFeedbackEmail("<script>alert(1)</script>", { name: "<b>Photographer</b>", email: "a&b@example.com" }, {
      platform: "private-token",
      version: "secret",
    });
    expect(email.text).not.toContain("Diagnostics");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;b&gt;Photographer&lt;/b&gt;");
    expect(email.html).toContain("a&amp;b@example.com");
  });
  it("includes the sender with a club proposal too", () => {
    const email = formatFeedbackEmail("[Club proposal]\nName: Example Club", sender);
    expect(email.text).toContain("Photographer: Photographer A\nEmail: photo@example.com");
    expect(email.text).toContain("[Club proposal]\nName: Example Club");
  });
  it("identifies theme proposals and their sender without diagnostic data", () => {
    const email = formatFeedbackEmail("[Theme proposal]\nName: Night portraits\nDescription: Available light", sender);
    expect(email.text).toContain("Photographer: Photographer A\nEmail: photo@example.com");
    expect(email.text).toContain("[Theme proposal]\nName: Night portraits\nDescription: Available light");
    expect(email.text).not.toContain("Diagnostics");
    expect(email.html).toContain("[Theme proposal]");
  });
});
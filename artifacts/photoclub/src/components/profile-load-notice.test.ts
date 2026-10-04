import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../i18n/en.json";
import nl from "../i18n/nl.json";
import { ProfileLoadNotice } from "./profile-load-notice";
import { ProfileLoadError } from "../hooks/my-profile-store";

const fixture = vi.hoisted(() => ({ locale: "en" as "en" | "nl" }));
vi.mock("@clerk/react", () => ({ useClerk: () => ({ signOut: vi.fn() }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      let value: unknown = { en, nl }[fixture.locale];
      for (const part of key.split(".")) value = (value as Record<string, unknown>)[part];
      return value;
    },
  }),
}));

const render = (error: Error | null, extra = {}) => renderToStaticMarkup(
  createElement(ProfileLoadNotice, { error, retry: async () => {}, ...extra }),
);

beforeEach(() => { fixture.locale = "en"; });

describe("ProfileLoadNotice", () => {
  it("renders nothing without an error", () => {
    expect(render(null)).toBe("");
  });
  it("explains an unknown profile and offers retry without exposing raw errors", () => {
    const html = render(new Error("Sensitive fixture detail"));
    expect(html).toContain('role="alert"');
    expect(html).toContain(en.profileLoad.body);
    expect(html).toContain(">Retry<");
    expect(html).not.toContain("Sensitive fixture detail");
    expect(html).not.toContain(en.profileLoad.signInAgain);
  });
  it("offers explicit reauthentication for HTTP 401, not ordinary server errors", () => {
    const html = render(new ProfileLoadError(401));
    expect(html).toContain(en.profileLoad.authBody);
    expect(html).toContain(en.profileLoad.signInAgain);
    expect(render(new ProfileLoadError(500))).not.toContain(en.profileLoad.signInAgain);
  });
  it("describes retained information during a background failure", () => {
    const html = render(new ProfileLoadError(500), { background: true });
    expect(html).toContain(en.profileLoad.refreshTitle);
    expect(html).toContain(en.profileLoad.refreshBody);
  });
  it("makes clear that public browsing is not blocked", () => {
    expect(render(new Error("Fixture"), { publicView: true })).toContain(en.profileLoad.publicBody);
  });
  it("renders Dutch error and retry messages", () => {
    fixture.locale = "nl";
    const html = render(new Error("Fixture"));
    expect(html).toContain(nl.profileLoad.title);
    expect(html).toContain(nl.profileLoad.body);
    expect(html).toContain(">Opnieuw proberen<");
  });
});
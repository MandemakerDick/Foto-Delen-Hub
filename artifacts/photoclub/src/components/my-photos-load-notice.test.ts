import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../i18n/en.json";
import nl from "../i18n/nl.json";
import { MyPhotosLoadNotice } from "./my-photos-load-notice";

const fixture = vi.hoisted(() => ({ locale: "en" as "en" | "nl" }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      let value: unknown = { en, nl }[fixture.locale];
      for (const part of key.split(".")) value = (value as Record<string, unknown>)[part];
      return value;
    },
  }),
}));
const render = (error: unknown, background = false, fetching = false) =>
  renderToStaticMarkup(createElement(MyPhotosLoadNotice, {
    error, background, fetching, retry: async () => {},
  })).replaceAll("&#x27;", "'");

describe("My Photos load notice", () => {
  it("renders nothing without a failure", () => expect(render(null)).toBe(""));
  for (const locale of ["en", "nl"] as const) {
    it(`renders initial and retained-list failures in ${locale}`, () => {
      fixture.locale = locale;
      const copy = { en, nl }[locale];
      expect(render(new Error("Sensitive detail"))).toContain(copy.myPhotos.loadErrorTitle);
      expect(render(new Error("Sensitive detail"))).not.toContain("Sensitive detail");
      expect(render(new Error("Fixture"), true)).toContain(copy.myPhotos.refreshErrorTitle);
      expect(render(new Error("Fixture"), true)).toContain(copy.myPhotos.refreshErrorBody);
    });
    it(`explains auth failures and disables pending retry in ${locale}`, () => {
      fixture.locale = locale;
      const copy = { en, nl }[locale];
      for (const status of [401, 403]) {
        expect(render({ status })).toContain(copy.myPhotos.authErrorBody);
      }
      expect(render({ status: 503 })).not.toContain(copy.myPhotos.authErrorBody);
      expect(render({ status: 503 }, true, true)).toContain("disabled");
      expect(render({ status: 503 }, true, true)).toContain(copy.profileLoad.retrying);
    });
  }
});
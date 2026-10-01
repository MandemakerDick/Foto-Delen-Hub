import { describe, expect, it } from "vitest";
import { getClubLogoPayload } from "./club-logo-payload";

describe("club logo payload", () => {
  it("omits the logo URL when creating a club without a logo", () => {
    expect(getClubLogoPayload(false, null, null)).toEqual({});
  });

  it("includes an uploaded logo when creating a club", () => {
    expect(getClubLogoPayload(false, null, "/api/storage/new-logo")).toEqual({
      logoUrl: "/api/storage/new-logo",
    });
  });

  it("omits the logo URL when editing without changing the existing logo", () => {
    expect(getClubLogoPayload(true, "/api/storage/existing-logo", "/api/storage/existing-logo")).toEqual({});
  });

  it("sends the replacement URL when editing with a different logo", () => {
    expect(getClubLogoPayload(true, "/api/storage/existing-logo", "/api/storage/replacement-logo")).toEqual({
      logoUrl: "/api/storage/replacement-logo",
    });
  });

  it("sends an empty URL when clearing an existing logo", () => {
    expect(getClubLogoPayload(true, "/api/storage/existing-logo", null)).toEqual({ logoUrl: "" });
  });
});
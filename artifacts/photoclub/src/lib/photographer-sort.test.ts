import { describe, expect, it } from "vitest";
import { sortPhotographersBySurname, surnameSortKey } from "./photographer-sort";

const photographer = (id: number, name: string) => ({ id, name });

describe("surname sorting", () => {
  it("uses the final word, ignoring lowercase infixes and extra whitespace", () => {
    expect(surnameSortKey("  Jan   van der Dijk  ")).toBe("Dijk");
    expect(surnameSortKey("Bakker")).toBe("Bakker");
    expect(surnameSortKey("  ")).toBe("");

    const names = [
      photographer(1, "Abel van Zanten"),
      photographer(2, "Jan van der Dijk"),
      photographer(3, "Bakker"),
      photographer(4, "  Eva   de   Vries  "),
    ];
    expect(sortPhotographersBySurname(names).map((p) => p.id)).toEqual([3, 2, 4, 1]);
    expect(names.map((p) => p.id)).toEqual([1, 2, 3, 4]);
  });

  it("sorts hyphenated and accented surnames consistently", () => {
    const names = [
      photographer(1, "Zoë Éclair"),
      photographer(2, "Piet Eclair"),
      photographer(3, "Anne Dijk-Smit"),
      photographer(4, "Eva Faber"),
    ];
    expect(sortPhotographersBySurname(names).map((p) => p.id)).toEqual([3, 2, 1, 4]);
  });

  it("uses the full name then ID for matching surnames", () => {
    const names = [
      photographer(7, "Jan van Dijk"),
      photographer(4, "Jan van Dijk"),
      photographer(9, "Anne de Dijk"),
    ];
    expect(sortPhotographersBySurname(names).map((p) => p.id)).toEqual([9, 4, 7]);
  });

  it("retains surname order after search and API-side club/theme filtering", () => {
    const names = [
      { id: 1, name: "Anne de Zwart", bio: "nature", clubId: 1, themeId: 2 },
      { id: 2, name: "Jan van Dijk", bio: "nature", clubId: 1, themeId: 2 },
      { id: 3, name: "Bert Bakker", bio: "street", clubId: 2, themeId: 1 },
    ];
    const filtered = names.filter((p) => p.clubId === 1 && p.themeId === 2 && p.bio.includes("nature"));
    expect(sortPhotographersBySurname(filtered).map((p) => p.id)).toEqual([2, 1]);
    expect(sortPhotographersBySurname(names.filter((p) => p.name.includes("Bakker"))).map((p) => p.id)).toEqual([3]);
  });
});
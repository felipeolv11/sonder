import { describe, expect, it } from "vitest";
import { formatDate, formatFact, formatReasons } from "@/i18n/format";

describe("formatReasons", () => {
  it("phrases each data point in the reader's language", () => {
    const reasons = [
      { t: "related", top: true, seed: "Radiohead" },
      { t: "sharesTag", tag: "Rock", title: "Creep" },
      { t: "era", album: "Grace", year: 1994, diff: 2, title: "Creep" },
    ] as const;
    expect(formatReasons("en", [...reasons])).toBe(
      "Among the three artists Deezer relates most closely to Radiohead. Shares the rock tag with “Creep”. From Grace (1994), two years after “Creep”.",
    );
    expect(formatReasons("pt", [...reasons])).toBe(
      "Entre os três artistas que o Deezer mais relaciona a Radiohead. Tem o mesmo gênero que “Creep”: rock. Do álbum Grace (1994), dois anos depois de “Creep”.",
    );
  });

  it("keeps acronyms in genre names and avoids a doubled full stop after a label", () => {
    expect(formatReasons("en", [{ t: "leans", genre: "MPB" }])).toBe("Leans toward MPB.");
    expect(formatReasons("en", [{ t: "label", label: "Universal Music Ltda." }])).toBe("Also released on Universal Music Ltda.");
  });
});

describe("formatDate", () => {
  it("shows a Wikidata date at its own precision", () => {
    expect(formatDate("en", "1997-05-21T00:00:00Z", 11)).toBe("May 21, 1997");
    expect(formatDate("pt", "1997-05-00T00:00:00Z", 10)).toBe("maio de 1997");
    expect(formatDate("es", "1997-00-00T00:00:00Z", 9)).toBe("1997");
  });
});

describe("formatFact", () => {
  it("labels and formats credits and track positions", () => {
    expect(formatFact("en", { key: "writtenBy", source: "Wikidata", values: ["Thom Yorke", "Jonny Greenwood"] })).toEqual({
      label: "Written by",
      value: "Thom Yorke and Jonny Greenwood",
    });
    expect(formatFact("pt", { key: "track", source: "Deezer", track: { n: 2, total: 12, album: "Pablo Honey" } })).toEqual({
      label: "Faixa",
      value: "2 de 12 em Pablo Honey",
    });
  });
});

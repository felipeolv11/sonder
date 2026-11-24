import { describe, expect, it } from "vitest";
import { translateHeading } from "@/lib/headings";
import { baseTitle, editionless, norm, sameTitle, yearOf } from "@/lib/text";

describe("baseTitle", () => {
  it("drops version suffixes so recordings of one song compare equal", () => {
    expect(baseTitle("Creep (Remastered 2009)")).toBe("Creep");
    expect(baseTitle("Karma Police - Live at the Astoria")).toBe("Karma Police");
    expect(baseTitle("Get Lucky (Radio Edit - feat. Pharrell Williams)")).toBe("Get Lucky");
    expect(baseTitle("Nude (From the Basement)")).toBe("Nude");
  });

  it("keeps parentheses that are part of the title", () => {
    expect(baseTitle("Street Spirit (Fade Out)")).toBe("Street Spirit (Fade Out)");
  });
});

describe("editionless", () => {
  it("drops reissue markers only", () => {
    expect(editionless("Discovery (Deluxe Edition)")).toBe("Discovery");
    expect(editionless("OK Computer - Remastered")).toBe("OK Computer");
  });

  it("keeps markers that make a different record", () => {
    expect(editionless("Hail to the Thief (Live Recordings 2003-2009)")).toBe("Hail to the Thief (Live Recordings 2003-2009)");
  });
});

describe("norm and sameTitle", () => {
  it("ignores accents, case, punctuation and a leading article", () => {
    expect(norm("Águas de Março")).toBe("aguas de marco");
    expect(norm("The Smashing Pumpkins")).toBe("smashing pumpkins");
    expect(norm("Simon & Garfunkel")).toBe("simon and garfunkel");
  });

  it("treats a remaster and the original as the same song", () => {
    expect(sameTitle("No Surprises (Remastered)", "No Surprises")).toBe(true);
    expect(sameTitle("No Surprises", "Let Down")).toBe(false);
  });
});

describe("yearOf", () => {
  it("reads the year from Deezer and Wikidata dates", () => {
    expect(yearOf("1997-05-21")).toBe(1997);
    expect(yearOf("+1985-00-00T00:00:00Z")).toBe(1985);
    expect(yearOf(undefined)).toBeUndefined();
    expect(yearOf("0000-00-00")).toBeUndefined();
  });
});

describe("translateHeading", () => {
  it("uses the glossary for common Wikipedia headings", () => {
    expect(translateHeading("Background", "pt")).toBe("Contexto");
    expect(translateHeading("Recording", "es")).toBe("Grabación");
  });

  it("joins combined headings in the target language", () => {
    expect(translateHeading("Background and recording", "pt")).toBe("Contexto e gravação");
    expect(translateHeading("Writing, recording and release", "es")).toBe("Creación, grabación y lanzamiento");
  });

  it("leaves unknown headings to machine translation", () => {
    expect(translateHeading("Plagiarism allegations", "pt")).toBeUndefined();
  });
});

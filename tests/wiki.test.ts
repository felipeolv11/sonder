import { beforeEach, describe, expect, it, vi } from "vitest";

// "use cache" functions call cacheLife(), which only works inside Next's runtime.
vi.mock("next/cache", () => ({ cacheLife: () => {} }));

const { findSongArticle, matches } = await import("@/lib/wiki");
type Page = Parameters<typeof matches>[0];

const page = (title: string, description: string, extract = "", extra: Partial<Page> = {}): Page => ({
  title,
  description,
  extract,
  pageprops: { wikibase_item: "Q1" },
  ...extra,
});

describe("matches: is this Wikipedia page about this song?", () => {
  it("accepts the song's own article", () => {
    expect(matches(page("Creep (Radiohead song)", "1992 single by Radiohead"), "song", "Creep", "Radiohead")).toBe(true);
  });

  it("finds the artist in the opening text when the description doesn't name them", () => {
    const p = page("Teardrop (song)", "1998 single", "\"Teardrop\" is a song by the English trip hop group Massive Attack.");
    expect(matches(p, "song", "Teardrop", "Massive Attack")).toBe(true);
  });

  it("rejects a song of the same name by someone else", () => {
    expect(matches(page("Creep (TLC song)", "1994 single by TLC"), "song", "Creep", "Radiohead")).toBe(false);
  });

  it("rejects pages that aren't songs, even by the right artist", () => {
    expect(matches(page("Pablo Honey", "1993 studio album by Radiohead"), "song", "Pablo Honey", "Radiohead")).toBe(false);
  });

  it("rejects disambiguation and missing pages", () => {
    expect(matches(page("Creep", "Topics referred to by the same term", "", { pageprops: { disambiguation: "" } }), "song", "Creep", "Radiohead")).toBe(false);
    expect(matches({ title: "Creep (Radiohead song)", missing: "" }, "song", "Creep", "Radiohead")).toBe(false);
  });

  it("requires the title itself to match, not just the subject", () => {
    expect(matches(page("Karma Police", "1997 single by Radiohead"), "song", "No Surprises", "Radiohead")).toBe(false);
  });
});

describe("findSongArticle", () => {
  const respond = (pages: Page[]) => new Response(JSON.stringify({ query: { pages: Object.fromEntries(pages.map((p, i) => [String(i), p])) } }));
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("prefers the most specific title guess that validates", async () => {
    fetchMock.mockResolvedValueOnce(
      respond([
        page("Creep (Radiohead song)", "1992 single by Radiohead", "\"Creep\" is the debut single by the English rock band Radiohead."),
        page("Creep (song)", "Topics referred to by the same term", "", { pageprops: { disambiguation: "" } }),
        page("Creep", "Topics referred to by the same term", "", { pageprops: { disambiguation: "" } }),
      ]),
    );
    const article = await findSongArticle("Creep", "Radiohead");
    expect(article?.title).toBe("Creep (Radiohead song)");
    expect(article?.url).toBe("https://en.wikipedia.org/wiki/Creep_(Radiohead_song)");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to search, and returns nothing rather than another artist's song", async () => {
    fetchMock
      .mockResolvedValueOnce(respond([{ title: "Obscure Song (Some Band song)", missing: "" }, { title: "Obscure Song", missing: "" }]))
      .mockResolvedValueOnce(respond([page("Obscure Song (Other Band song)", "2004 single by Other Band", "", { index: 1 })]));
    expect(await findSongArticle("Obscure Song", "Some Band")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("gsrsearch");
  });
});

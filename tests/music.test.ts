import { describe, expect, it, vi } from "vitest";
import type { DzAlbum, DzArtist, DzTrack } from "@/lib/deezer";

/*
 * The recommender and search ranking, run against a small fictional catalogue. Deezer and
 * Wikipedia are mocked, so these check Sonder's own rules rather than live data.
 */

vi.mock("next/cache", () => ({ cacheLife: () => {} }));

const artist = (id: number, name: string, fans: number): DzArtist => ({ id, name, nb_fan: fans, picture_big: `https://img/${id}.jpg` });
const cover = { cover_medium: "m.jpg", cover_big: "b.jpg", cover_xl: "xl.jpg" };

function album(id: number, title: string, by: DzArtist, opts: { year: number; genre: string; type?: string; label?: string }): DzAlbum {
  return {
    id,
    title,
    ...cover,
    record_type: opts.type ?? "album",
    release_date: `${opts.year}-06-01`,
    label: opts.label,
    nb_tracks: 10,
    genres: { data: [{ id: 1, name: opts.genre }] },
    artist: by,
    tracks: { data: [] },
  };
}

function track(id: number, title: string, by: DzArtist, on: DzAlbum, bpm?: number): DzTrack {
  return { id, title, title_short: title, duration: 240, rank: 500_000, bpm, artist: by, album: { id: on.id, title: on.title, ...cover } };
}

// The song recommendations start from.
const seedArtist = artist(1, "Seed Band", 2_000_000);
const seedAlbum = album(100, "Seed Album", seedArtist, { year: 1997, genre: "Rock", label: "EMI" });
const seed = track(1000, "Seed Song", seedArtist, seedAlbum, 100);

// Related artists, in Deezer's order of closeness.
const close = artist(2, "Close Band", 900_000);
const closeAlbum = album(200, "Close Album", close, { year: 1996, genre: "Rock", label: "EMI" });
const covers = artist(3, "Covers Band", 400_000);
const coversAlbum = album(300, "Covers Album", covers, { year: 1999, genre: "Rock" });
const hits = artist(4, "Hits Band", 300_000);
const greatestHits = album(400, "Greatest Hits", hits, { year: 2010, genre: "Rock", type: "compile" });
const hitsOriginal = album(401, "Original LP", hits, { year: 1995, genre: "Rock" });
const far = artist(5, "Far Band", 3_000);
const farAlbum = album(500, "Far Album", far, { year: 2015, genre: "Electronic" });

const albums = new Map([seedAlbum, closeAlbum, coversAlbum, greatestHits, hitsOriginal, farAlbum].map((a) => [a.id, a]));
const tracks = new Map<number, DzTrack>();
const add = (t: DzTrack) => (tracks.set(t.id, t), t);
add(seed);
const tops = new Map<number, DzTrack[]>([
  // A live version comes first in the chart but isn't the recording to recommend.
  [close.id, [add(track(2001, "Close Song (Live)", close, closeAlbum, 103)), add(track(2002, "Close Song", close, closeAlbum, 103))]],
  // This artist's biggest song shares the seed's title, so their next one is used.
  [covers.id, [add(track(3001, "Seed Song", covers, coversAlbum)), add(track(3002, "Another Song", covers, coversAlbum))]],
  // The popular version sits on a compilation; the same recording exists on an original album.
  [hits.id, [add(track(4001, "Hit Song", hits, greatestHits))]],
  [far.id, [add(track(5001, "Far Song", far, farAlbum, 140))]],
]);
const original = add(track(4002, "Hit Song", hits, hitsOriginal));

vi.mock("@/lib/deezer", () => ({
  NotFoundError: class NotFoundError extends Error {},
  getTrack: async (id: number) => tracks.get(Number(id)),
  getAlbum: async (id: number) => albums.get(Number(id)),
  getRelatedArtists: async () => [seedArtist, close, covers, hits, far],
  getTopTracks: async (id: number) => tops.get(id) ?? [],
  searchTracks: async (q: string) => (q.includes("Hit Song") ? [tops.get(hits.id)![0], original] : searchResults),
  searchAlbums: async () => [],
}));

vi.mock("@/lib/wiki", () => ({
  articleUrl: (t: string) => `https://en.wikipedia.org/wiki/${t}`,
  findSongArticle: async () => null,
  findAlbumArticle: async () => null,
  findArtistArticle: async () => null,
  getSections: async () => ({ lead: [], sections: [] }),
  getSitelinks: async () => ({}),
  getWikidataFacts: async () => null,
  getArtistEvents: async () => ({}),
  getReleaseDates: async () => [],
  translateTexts: async (texts: string[]) => texts,
  publishedYear: () => undefined,
}));

// Results Deezer might return for "radiohead creep".
const radiohead = artist(10, "Radiohead", 4_000_000);
const pabloHoney = album(1100, "Pablo Honey", radiohead, { year: 1993, genre: "Rock" });
const karaoke = artist(11, "Karaoke Kings", 500);
const quartet = artist(12, "String Quartet", 800);
const searchResults: DzTrack[] = [
  track(9001, "Creep (Karaoke Version)", karaoke, album(1101, "Karaoke Hits", karaoke, { year: 2020, genre: "Pop" })),
  track(9002, "Creep", quartet, album(1102, "Plays Radiohead", quartet, { year: 2018, genre: "Classical" })),
  track(9003, "Creep", radiohead, pabloHoney),
  track(9004, "Creep (Remastered)", radiohead, pabloHoney),
  track(9005, "Creep - Live", radiohead, album(1103, "Live in Paris", radiohead, { year: 2001, genre: "Rock" })),
];

const { getRecommendations, searchSongs } = await import("@/lib/music");

describe("getRecommendations", async () => {
  const recs = await getRecommendations(seed.id, "en");
  const byArtist = (name: string) => recs.find((r) => r.artist === name);

  it("recommends one song from each related artist, never the seed artist", () => {
    expect(recs.map((r) => r.artist).sort()).toEqual(["Close Band", "Covers Band", "Far Band", "Hits Band"]);
  });

  it("ranks the closest artist with a shared genre and era first", () => {
    expect(recs[0].artist).toBe("Close Band");
  });

  it("skips live versions and songs with the seed's title", () => {
    expect(byArtist("Close Band")?.title).toBe("Close Song");
    expect(byArtist("Covers Band")?.title).toBe("Another Song");
  });

  it("swaps a compilation for the original album, with its year", () => {
    const hit = byArtist("Hits Band");
    expect(hit?.album).toBe("Original LP");
    expect(hit?.year).toBe(1995);
  });

  it("explains each recommendation only with data it has", () => {
    const top = byArtist("Close Band")!;
    expect(top.reasons[0]).toEqual({ t: "related", top: true, seed: "Seed Band" });
    expect(top.reasons).toContainEqual({ t: "sharesTag", tag: "Rock", title: "Seed Song" });
    expect(top.reasons).toContainEqual({ t: "tempo", bpm: 103, seed: 100 });
    expect(top.reasons.length).toBeLessThanOrEqual(3);
    expect(byArtist("Far Band")?.reasons).toContainEqual({ t: "leans", genre: "Electronic" });
  });

  it("tags songs for the era, lesser-known and other-genre filters", () => {
    expect(byArtist("Close Band")?.filters).toContain("sameEra");
    expect(byArtist("Close Band")?.filters).not.toContain("otherGenre");
    expect(byArtist("Far Band")?.filters).toEqual(expect.arrayContaining(["lesserKnown", "otherGenre"]));
    expect(byArtist("Far Band")?.filters).not.toContain("sameEra");
  });
});

describe("searchSongs", () => {
  it("puts the named artist's original first and drops tributes and duplicate versions", async () => {
    const results = await searchSongs("radiohead creep");
    expect(results[0]).toMatchObject({ id: 9003, title: "Creep", artist: "Radiohead" });
    // "Plays Radiohead" names another artist from the results: a tribute, left out.
    expect(results.some((r) => r.album === "Plays Radiohead")).toBe(false);
    // The remaster and the live take are the same song by the same artist: listed once.
    expect(results.filter((r) => r.artist === "Radiohead")).toHaveLength(1);
    // Karaoke stays, but below the original.
    expect(results.findIndex((r) => r.artist === "Karaoke Kings")).toBeGreaterThan(0);
  });
});

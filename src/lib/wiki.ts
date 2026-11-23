import { cacheLife } from "next/cache";
import { createLimiter, shareInFlight, UpstreamError } from "./http";
import { baseTitle, norm, yearOf } from "./text";

/*
 * Wikimedia rate-limits API clients per minute: about 10 requests for clients that only send a
 * generic User-Agent, 200 for clients whose User-Agent names a contact (email or URL).
 * Set WIKIMEDIA_CONTACT in .env.local to identify this app and get the higher limit.
 * https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits
 */
const contact = process.env.WIKIMEDIA_CONTACT?.trim();
const WIKIMEDIA_UA = contact ? `Sonder/0.1 (${contact}) music-discovery-app` : "Sonder/0.1 (music discovery app; no contact configured)";

// Their best practices ask for 3 or fewer concurrent requests.
const wikimedia = createLimiter(2, 150);

// After a 429, stop calling until Retry-After has passed instead of piling on more requests.
let blockedUntil = 0;

async function wikimediaFetch(url: string, source: string): Promise<unknown> {
  if (Date.now() < blockedUntil) throw new UpstreamError(`${source} is rate limiting requests`, source);
  return wikimedia(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": WIKIMEDIA_UA, Accept: "application/json", "Api-User-Agent": WIKIMEDIA_UA },
      signal: AbortSignal.timeout(9000),
    });
    if (res.status === 429) {
      const after = Number(res.headers.get("retry-after"));
      blockedUntil = Date.now() + (Number.isFinite(after) && after > 0 ? after : 30) * 1000;
      throw new UpstreamError(`${source} is rate limiting requests`, source);
    }
    if (!res.ok) throw new UpstreamError(`${source} responded ${res.status}`, source);
    return res.json();
  });
}

const WP = "https://en.wikipedia.org/w/api.php";
const WD = "https://www.wikidata.org/w/api.php";

type WpPage = {
  pageid?: number;
  title: string;
  missing?: string;
  description?: string;
  extract?: string;
  pageprops?: { wikibase_item?: string; disambiguation?: string };
  index?: number;
};

type WpQuery = { query?: { pages?: Record<string, WpPage> } };

export type WikiArticle = {
  title: string;
  url: string;
  description?: string;
  wikidataId?: string;
  intro: string;
};

export type WikiSection = {
  heading: string;
  level: number;
  anchor: string;
  paragraphs: string[];
};

// Identical concurrent requests (several parts of a page asking about one song) share one fetch.
const sharedGet = shareInFlight(
  (url: string, source: string) => `${source}:${url}`,
  (url: string, source: string) => wikimediaFetch(url, source),
);
function getJson<T>(url: string, source: string) {
  return sharedGet(url, source) as Promise<T>;
}

async function wp(params: Record<string, string>): Promise<WpQuery> {
  const url = new URL(WP);
  const all = { action: "query", format: "json", formatversion: "1", redirects: "1", ...params };
  for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v);
  return getJson<WpQuery>(url.toString(), "Wikipedia");
}

export function articleUrl(title: string, anchor?: string) {
  const t = encodeURIComponent(title.replace(/ /g, "_"));
  return `https://en.wikipedia.org/wiki/${t}${anchor ? `#${encodeURIComponent(anchor.replace(/ /g, "_"))}` : ""}`;
}

function toArticle(p: WpPage): WikiArticle {
  return {
    title: p.title,
    url: articleUrl(p.title),
    description: p.description,
    wikidataId: p.pageprops?.wikibase_item,
    intro: p.extract ?? "",
  };
}

const INFO = { prop: "description|pageprops|extracts", ppprop: "wikibase_item|disambiguation", exintro: "1", explaintext: "1", exlimit: "20" };

type Kind = "song" | "album" | "artist";

const KIND_WORDS: Record<Kind, RegExp> = {
  song: /\b(song|single|track|instrumental|ballad|anthem)\b/i,
  album: /\b(album|ep|extended play|mixtape|soundtrack|record)\b/i,
  artist: /\b(band|singer|musician|rapper|group|duo|trio|songwriter|composer|producer|dj|artist|vocalist|guitarist|pianist|orchestra|ensemble|collective|act)\b/i,
};

/** Does this page plausibly describe `name` (a song/album) by `artist`? */
function matches(p: WpPage, kind: Kind, name: string, artist: string): boolean {
  if (p.missing !== undefined || p.pageprops?.disambiguation !== undefined) return false;
  const titleCore = p.title.replace(/\s*\([^)]*\)\s*$/, "");
  const paren = /\(([^)]*)\)\s*$/.exec(p.title)?.[1] ?? "";
  if (norm(titleCore) !== norm(name)) return false;

  const desc = p.description ?? "";
  const intro = (p.extract ?? "").slice(0, 900);
  const a = norm(artist);

  if (kind === "artist") {
    return KIND_WORDS.artist.test(desc) || KIND_WORDS.artist.test(paren) || KIND_WORDS.artist.test(intro.slice(0, 300));
  }
  const kindOk = KIND_WORDS[kind].test(desc) || KIND_WORDS[kind].test(paren) || KIND_WORDS[kind].test(intro.slice(0, 250));
  const artistOk = norm(desc).includes(a) || norm(paren).includes(a) || norm(intro).includes(a);
  return kindOk && artistOk;
}

async function findArticle(kind: Kind, name: string, artist: string): Promise<WikiArticle | null> {
  const clean = kind === "artist" ? name : baseTitle(name);
  const guesses =
    kind === "song"
      ? [`${clean} (${artist} song)`, `${clean} (song)`, clean]
      : kind === "album"
        ? [`${clean} (${artist} album)`, `${clean} (album)`, `${clean} (EP)`, clean]
        : [`${clean} (band)`, `${clean} (musician)`, `${clean} (singer)`, `${clean} (rapper)`, clean];

  const direct = await wp({ ...INFO, titles: guesses.join("|") });
  const pages = Object.values(direct.query?.pages ?? {});
  // Prefer the most specific guess that validates.
  for (const g of guesses) {
    const p = pages.find((x) => norm(x.title) === norm(g)) ?? pages.find((x) => x.title === g);
    if (p && matches(p, kind, clean, artist)) return toArticle(p);
  }
  for (const p of pages) if (matches(p, kind, clean, artist)) return toArticle(p);

  // Fall back to full-text search.
  const term = kind === "song" ? `"${clean}" ${artist} song` : kind === "album" ? `"${clean}" ${artist} album` : `"${clean}" musician band`;
  const found = await wp({ ...INFO, generator: "search", gsrsearch: term, gsrlimit: "8" });
  const ranked = Object.values(found.query?.pages ?? {}).sort((x, y) => (x.index ?? 0) - (y.index ?? 0));
  for (const p of ranked) if (matches(p, kind, clean, artist)) return toArticle(p);
  return null;
}

export async function findSongArticle(title: string, artist: string) {
  "use cache";
  cacheLife("days");
  return findArticle("song", title, artist);
}
export async function findAlbumArticle(album: string, artist: string) {
  "use cache";
  cacheLife("days");
  return findArticle("album", album, artist);
}
export async function findArtistArticle(artist: string) {
  "use cache";
  cacheLife("days");
  return findArticle("artist", artist, artist);
}

/** Full plain-text article split into sections. */
export async function getSections(title: string): Promise<{ lead: string[]; sections: WikiSection[] }> {
  "use cache";
  cacheLife("days");
  const res = await wp({ prop: "extracts", explaintext: "1", exsectionformat: "wiki", titles: title });
  const page = Object.values(res.query?.pages ?? {})[0];
  const text = page?.extract ?? "";
  const lines = text.split("\n");

  const lead: string[] = [];
  const sections: WikiSection[] = [];
  let current: WikiSection | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    const h = /^(={2,6})\s*(.*?)\s*\1$/.exec(line);
    if (h) {
      current = { heading: h[2], level: h[1].length, anchor: h[2], paragraphs: [] };
      sections.push(current);
      continue;
    }
    if (!line) continue;
    (current ? current.paragraphs : lead).push(line);
  }
  return { lead, sections };
}

/* ---------- Wikidata ---------- */

type WdSnak = { datavalue?: { value: unknown; type: string } };
type WdClaim = { mainsnak: WdSnak; rank?: string };
type WdEntity = { claims?: Record<string, WdClaim[]>; labels?: Record<string, { value: string }> };
type WdResponse = { entities?: Record<string, WdEntity> };

export type WikidataFacts = {
  producers: string[];
  writers: string[];
  composers: string[];
  lyricists: string[];
  recordedAt: string[];
  labels: string[];
  genres: string[];
  partOf: string[];
  published?: { iso: string; precision: number };
};

const PROPS = {
  producers: "P162",
  composers: "P86",
  lyricists: "P676",
  writers: "P50",
  recordedAt: "P483",
  labels: "P264",
  genres: "P136",
  partOfA: "P361",
  partOfB: "P1433",
} as const;

async function wd(params: Record<string, string>): Promise<WdResponse> {
  const url = new URL(WD);
  for (const [k, v] of Object.entries({ format: "json", ...params })) url.searchParams.set(k, v);
  return getJson<WdResponse>(url.toString(), "Wikidata");
}

function itemIds(claims: WdClaim[] | undefined): string[] {
  return (claims ?? [])
    .filter((c) => c.rank !== "deprecated")
    .map((c) => (c.mainsnak.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((x): x is string => !!x);
}

export async function getWikidataFacts(qid: string): Promise<WikidataFacts> {
  "use cache";
  cacheLife("days");
  const res = await wd({ action: "wbgetentities", ids: qid, props: "claims" });
  const claims = res.entities?.[qid]?.claims ?? {};

  const ids: Record<string, string[]> = {};
  for (const [key, prop] of Object.entries(PROPS)) ids[key] = itemIds(claims[prop]);

  const all = [...new Set(Object.values(ids).flat())].slice(0, 50);
  const labels: Record<string, string> = {};
  if (all.length) {
    const lres = await wd({ action: "wbgetentities", ids: all.join("|"), props: "labels", languages: "en", languagefallback: "1" });
    for (const [id, ent] of Object.entries(lres.entities ?? {})) {
      const l = ent.labels?.en?.value;
      if (l) labels[id] = l;
    }
  }
  const named = (key: string) => [...new Set(ids[key].map((id) => labels[id]).filter(Boolean))];

  let published: WikidataFacts["published"];
  for (const c of claims.P577 ?? []) {
    const v = c.mainsnak.datavalue?.value as { time?: string; precision?: number } | undefined;
    if (!v?.time) continue;
    const iso = v.time.replace(/^\+/, "");
    if (!published || iso < published.iso) published = { iso, precision: v.precision ?? 9 };
  }

  return {
    producers: named("producers"),
    composers: named("composers"),
    lyricists: named("lyricists"),
    writers: named("writers"),
    recordedAt: named("recordedAt"),
    labels: named("labels"),
    genres: named("genres"),
    partOf: [...named("partOfA"), ...named("partOfB")],
    published,
  };
}

export function publishedYear(f?: WikidataFacts | null) {
  return yearOf(f?.published?.iso);
}

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

async function wikimediaFetch(url: string, source: string, body?: unknown, timeoutMs = 9000): Promise<unknown> {
  if (Date.now() < blockedUntil) throw new UpstreamError(`${source} is rate limiting requests`, source);
  return wikimedia(async () => {
    const res = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "User-Agent": WIKIMEDIA_UA,
        Accept: "application/json",
        "Api-User-Agent": WIKIMEDIA_UA,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
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

/** Wikipedia editions the app can read; matches the interface languages. */
export type WikiLang = "en" | "pt" | "es";
const wpApi = (lang: WikiLang) => `https://${lang}.wikipedia.org/w/api.php`;
const WD = "https://www.wikidata.org/w/api.php";

export type WpPage = {
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

async function wp(params: Record<string, string>, lang: WikiLang = "en"): Promise<WpQuery> {
  const url = new URL(wpApi(lang));
  const all = { action: "query", format: "json", formatversion: "1", redirects: "1", ...params };
  for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v);
  return getJson<WpQuery>(url.toString(), "Wikipedia");
}

export function articleUrl(title: string, anchor?: string, lang: WikiLang = "en") {
  const t = encodeURIComponent(title.replace(/ /g, "_"));
  return `https://${lang}.wikipedia.org/wiki/${t}${anchor ? `#${encodeURIComponent(anchor.replace(/ /g, "_"))}` : ""}`;
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

/** Does this page plausibly describe `name` (a song/album) by `artist`? Exported for tests. */
export function matches(p: WpPage, kind: Kind, name: string, artist: string): boolean {
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

/** Full plain-text article split into sections, from the given Wikipedia edition. */
export async function getSections(title: string, lang: WikiLang = "en"): Promise<{ lead: string[]; sections: WikiSection[] }> {
  "use cache";
  cacheLife("days");
  const res = await wp({ prop: "extracts", explaintext: "1", exsectionformat: "wiki", titles: title }, lang);
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

/** Titles of the same article in other Wikipedia editions, from Wikidata sitelinks. */
export async function getSitelinks(qid: string): Promise<Partial<Record<WikiLang, string>>> {
  "use cache";
  cacheLife("days");
  const res = await wd({ action: "wbgetentities", ids: qid, props: "sitelinks", sitefilter: "enwiki|ptwiki|eswiki" });
  const links = (res.entities?.[qid] as { sitelinks?: Record<string, { title: string }> } | undefined)?.sitelinks ?? {};
  const out: Partial<Record<WikiLang, string>> = {};
  for (const lang of ["en", "pt", "es"] as const) {
    const t = links[`${lang}wiki`]?.title;
    if (t) out[lang] = t;
  }
  return out;
}

/**
 * Credits for a Wikidata item, with names in `lang` (falling back to English).
 * `partOf` stays in English because it's used to look up the album on Deezer and English Wikipedia.
 */
export async function getWikidataFacts(qid: string, lang: WikiLang = "en"): Promise<WikidataFacts> {
  "use cache";
  cacheLife("days");
  const res = await wd({ action: "wbgetentities", ids: qid, props: "claims" });
  const claims = res.entities?.[qid]?.claims ?? {};

  const ids: Record<string, string[]> = {};
  for (const [key, prop] of Object.entries(PROPS)) ids[key] = itemIds(claims[prop]);

  const all = [...new Set(Object.values(ids).flat())].slice(0, 50);
  const labels: Record<string, string> = {};
  const english: Record<string, string> = {};
  if (all.length) {
    const languages = lang === "en" ? "en" : `${lang}|en`;
    const lres = await wd({ action: "wbgetentities", ids: all.join("|"), props: "labels", languages });
    for (const [id, ent] of Object.entries(lres.entities ?? {})) {
      const en = ent.labels?.en?.value;
      const local = ent.labels?.[lang]?.value ?? en;
      if (local) labels[id] = local;
      if (en) english[id] = en;
    }
  }
  const named = (key: string, from = labels) => [...new Set(ids[key].map((id) => from[id]).filter(Boolean))];

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
    partOf: [...named("partOfA", english), ...named("partOfB", english)],
    published,
  };
}

export function publishedYear(f?: WikidataFacts | null) {
  return yearOf(f?.published?.iso);
}

/* ---------- Artist timeline (Wikidata) ---------- */

export type WdDate = { iso: string; precision: number };

export type ArtistEvents = {
  formed?: WdDate;
  born?: WdDate;
  activeFrom?: WdDate;
  dissolved?: WdDate;
  died?: WdDate;
};

function dates(claims: WdClaim[] | undefined): WdDate[] {
  return (claims ?? [])
    .filter((c) => c.rank !== "deprecated")
    .map((c) => c.mainsnak.datavalue?.value as { time?: string; precision?: number } | undefined)
    .filter((v): v is { time: string; precision?: number } => !!v?.time && !v.time.startsWith("-"))
    .map((v) => ({ iso: v.time.replace(/^\+/, ""), precision: v.precision ?? 9 }))
    .sort((a, b) => a.iso.localeCompare(b.iso));
}

/** Formation, birth, start of career, break-up and death of an artist, as Wikidata records them. */
export async function getArtistEvents(qid: string): Promise<ArtistEvents> {
  "use cache";
  cacheLife("days");
  const res = await wd({ action: "wbgetentities", ids: qid, props: "claims" });
  const claims = res.entities?.[qid]?.claims ?? {};
  return {
    formed: dates(claims.P571)[0],
    born: dates(claims.P569)[0],
    activeFrom: dates(claims.P2031)[0],
    dissolved: dates(claims.P576).at(-1),
    died: dates(claims.P570).at(-1),
  };
}

export type WdRelease = { qid: string; title: string; englishTitle?: string; date: string; kind: "album" | "ep" | "live" };

// Studio album, EP, live album, then plain "album" (used when an item isn't more specific).
const RELEASE_TYPES: Record<string, WdRelease["kind"]> = { Q208569: "album", Q169930: "ep", Q209939: "live", Q482994: "album" };
const TYPE_PRIORITY = ["Q208569", "Q169930", "Q209939", "Q482994"];

type SparqlValue = { value: string };
type SparqlResult = { results?: { bindings?: Record<string, SparqlValue | undefined>[] } };

/**
 * The artist's albums, EPs and live albums with their first publication date, from the Wikidata
 * Query Service. Titles are in `lang` when Wikidata has them, with the English title for matching.
 */
export async function getReleaseDates(qid: string, lang: WikiLang = "en"): Promise<WdRelease[]> {
  "use cache";
  cacheLife("days");
  if (!/^Q\d+$/.test(qid)) return [];

  const query = `
    SELECT ?item ?type (MIN(?d) AS ?date) (SAMPLE(?en) AS ?enLabel) (SAMPLE(?loc) AS ?localLabel) WHERE {
      ?item wdt:P175 wd:${qid}; wdt:P31 ?type; wdt:P577 ?d.
      VALUES ?type { ${Object.keys(RELEASE_TYPES).map((q) => `wd:${q}`).join(" ")} }
      OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
      OPTIONAL { ?item rdfs:label ?loc FILTER(LANG(?loc) = "${lang}") }
    } GROUP BY ?item ?type LIMIT 300`;
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  const res = (await getJson<SparqlResult>(url.toString(), "Wikidata Query Service")) ?? {};

  // An item can carry several types ("album" and "studio album"): keep the most specific.
  const byItem = new Map<string, WdRelease & { priority: number }>();
  for (const b of res.results?.bindings ?? []) {
    const item = b.item?.value.split("/").pop();
    const type = b.type?.value.split("/").pop();
    const date = b.date?.value;
    const title = b.localLabel?.value ?? b.enLabel?.value;
    if (!item || !type || !date || !title || date.startsWith("-")) continue;
    const priority = TYPE_PRIORITY.indexOf(type);
    const prev = byItem.get(item);
    if (prev && prev.priority <= priority) continue;
    byItem.set(item, { qid: item, title, englishTitle: b.enLabel?.value, date: date.slice(0, 10), kind: RELEASE_TYPES[type], priority });
  }
  return [...byItem.values()]
    .map((r) => ({ qid: r.qid, title: r.title, englishTitle: r.englishTitle, date: r.date, kind: r.kind }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- Machine translation (MinT) ---------- */

/*
 * MinT is Wikimedia's open machine-translation service, the one behind Wikipedia's Content
 * Translation tool. It takes HTML and keeps element ids, so many paragraphs go in one request.
 */
const MINT = (from: WikiLang, to: WikiLang) => `https://cxserver.wikimedia.org/v2/translate/${from}/${to}/MinT`;
const BATCH_CHARS = 4500;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const decodeHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

async function translateBatch(texts: string[], offset: number, from: WikiLang, to: WikiLang): Promise<string[]> {
  // MinT only translates the first top-level element, so everything goes inside one root.
  const html = `<div>${texts.map((t, i) => `<p id="t${offset + i}">${escapeHtml(t)}</p>`).join("")}</div>`;
  const res = (await wikimediaFetch(MINT(from, to), "MinT", { html }, 30000)) as { contents?: string };
  const found = new Map<number, string>();
  for (const m of (res.contents ?? "").matchAll(/<p[^>]*\bid="t(\d+)"[^>]*>([\s\S]*?)<\/p>/g)) {
    found.set(Number(m[1]), decodeHtml(m[2]));
  }
  return texts.map((_, i) => {
    const out = found.get(offset + i);
    if (!out) throw new UpstreamError("MinT returned an incomplete translation", "MinT");
    return out;
  });
}

/**
 * Translates plain-text strings, keeping their order. Throws if any piece comes back missing,
 * so callers can fall back to the original language rather than show a half-translated story.
 */
export async function translateTexts(texts: string[], from: WikiLang, to: WikiLang): Promise<string[]> {
  "use cache";
  cacheLife("days");
  if (from === to || texts.length === 0) return texts;

  const batches: { start: number; items: string[] }[] = [];
  let size = 0;
  texts.forEach((t, i) => {
    const last = batches[batches.length - 1];
    if (!last || size + t.length > BATCH_CHARS) {
      batches.push({ start: i, items: [t] });
      size = t.length;
    } else {
      last.items.push(t);
      size += t.length;
    }
  });

  const results = await Promise.all(batches.map((b) => translateBatch(b.items, b.start, from, to)));
  return results.flat();
}

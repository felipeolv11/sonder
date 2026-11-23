import { cacheLife } from "next/cache";
import * as dz from "./deezer";
import { mapLimit } from "./http";
import { translateHeading } from "./headings";
import { baseTitle, capitalize, norm, sameTitle, yearOf } from "./text";
import {
  articleUrl,
  findAlbumArticle,
  findArtistArticle,
  findSongArticle,
  getSections,
  getSitelinks,
  getWikidataFacts,
  translateTexts,
  publishedYear,
  type WikiArticle,
  type WikiLang,
  type WikidataFacts,
} from "./wiki";

/** Content language: which Wikipedia edition, Wikidata labels and Deezer genre names to use. */
export type Lang = WikiLang;

/* ---------- Types shared with the UI ---------- */

export type SongCard = {
  id: number;
  title: string;
  artist: string;
  album: string;
  cover: string;
  coverSmall: string;
};

export type FactKey = "writtenBy" | "producedBy" | "recordedAt" | "released" | "label" | "track" | "length" | "tempo";

/** A credit or release detail. The UI turns it into text in the reader's language. */
export type Fact = {
  key: FactKey;
  source: "Wikidata" | "Deezer";
  /** Names or a plain value (joined as a list by the UI). */
  values?: string[];
  date?: { iso: string; precision: number };
  track?: { n: number; total: number; album: string };
};

export type Song = {
  id: number;
  title: string;
  artist: { id: number; name: string; picture?: string };
  album: { id: number; title: string; cover: string; coverSmall: string; recordType: string; trackCount?: number };
  year?: number;
  genres: string[];
  facts: Fact[];
  deezerUrl: string;
  songArticle?: { title: string; url: string };
  albumName?: string;
  /** Signals the recommender compares candidates against. */
  seed: { genres: string[]; year?: number; bpm?: number; label?: string };
};

export type StoryKind = "documented" | "interpretation" | "opinion";

export type StorySection = {
  heading: string;
  kind: StoryKind;
  paragraphs: string[];
  subsections: { heading: string; paragraphs: string[] }[];
  source: { title: string; url: string };
};

type Source = { title: string; url: string };

export type Story = {
  /** "song" when Wikipedia has an article for the track itself. */
  focus: "song" | "album" | "artist" | "none";
  /**
   * Wikipedia edition each block was read from; differs from the request when no local article exists.
   * `translated` means the block was machine-translated (MinT) from that edition into the reader's language.
   */
  songLang?: Lang;
  songTranslated?: boolean;
  standfirst?: { paragraphs: string[]; source: Source };
  sections: StorySection[];
  album?: { title: string; lang: Lang; translated?: boolean; paragraphs: string[]; sections: StorySection[]; source: Source };
  artist?: { name: string; lang: Lang; translated?: boolean; paragraphs: string[]; source: Source };
};

/** One data-backed reason a song was recommended; the UI phrases it. */
export type ReasonPart =
  | { t: "related"; top: boolean; seed: string }
  | { t: "sharesTag"; tag: string; title: string }
  | { t: "leans"; genre: string }
  | { t: "tempo"; bpm: number; seed: number }
  | { t: "era"; album: string; year: number; diff: number; title: string }
  | { t: "label"; label: string };

export type Recommendation = SongCard & {
  year?: number;
  reasons: ReasonPart[];
  signals: string[];
};

/* ---------- Search ---------- */

const TRIBUTE =
  /\b(tribute|karaoke|lullaby|lullabies|8-bit|instrumental|piano version|string quartet|performs|plays|in the style of|cover|covers|renditions|reimagin|for babies|made famous|originally performed|backing track|music box|orchestral versions|rockabye|twinkle)\b/i;

function toCard(t: dz.DzTrack): SongCard {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist.name,
    album: t.album.title,
    cover: t.album.cover_xl || t.album.cover_big,
    coverSmall: t.album.cover_medium,
  };
}

export async function searchSongs(query: string, limit = 24): Promise<SongCard[]> {
  "use cache";
  cacheLife("hours");

  const q = query.trim();
  if (!q) return [];
  const tracks = await dz.searchTracks(q, 60);
  const qn = ` ${norm(q)} `;

  // Artists whose name appears in the query are almost certainly what the person meant.
  const namedArtists = new Set(tracks.map((t) => norm(t.artist.name)).filter((a) => a.length > 1 && qn.includes(` ${a} `)));

  // No playback here, so a track's regional "readable" flag doesn't matter: the server may run in a
  // country where Deezer marks most of the catalogue unplayable.
  const scored = tracks
    .map((t, i) => {
      const artist = norm(t.artist.name);
      let score = 100 - i; // Deezer relevance order
      score += Math.log10(1 + t.rank) * 4; // popularity
      if (namedArtists.has(artist)) score += 60;
      const text = `${t.title} ${t.album.title} ${t.artist.name}`;
      if (TRIBUTE.test(text)) score -= 80;
      // Album or title naming a different artist from the results ("Plays Radiohead") marks a tribute.
      for (const named of namedArtists) {
        if (named !== artist && ` ${norm(`${t.album.title} ${t.title}`)} `.includes(` ${named} `)) score = -Infinity;
      }
      if (/\b(live|remix|sped up|slowed|acoustic|demo|take \d|sessions?|outtakes?|rough|alternate|instrumental)\b/i.test(t.title)) score -= 25;
      return { t, score };
    })
    .filter((x) => x.score > -Infinity)
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const out: SongCard[] = [];
  for (const { t } of scored) {
    const key = `${norm(t.artist.name)}|${norm(baseTitle(t.title))}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(toCard(t));
    if (out.length >= limit) break;
  }
  return out;
}

/* ---------- Song ---------- */

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

/** Finds the studio album a track first appeared on, when Deezer handed us a single or compilation. */
async function canonicalAlbum(track: dz.DzTrack, album: dz.DzAlbum, candidates: string[], lang: Lang): Promise<dz.DzAlbum> {
  if (album.record_type === "album") return album;
  for (const name of candidates) {
    if (sameTitle(name, track.title)) continue;
    const found = await safe(dz.searchAlbums(`${track.artist.name} ${name}`, 15));
    const hit = (found ?? []).find((a) => a.artist?.id === track.artist.id && norm(a.title) === norm(name) && a.record_type === "album");
    if (!hit) continue;
    const full = await safe(dz.getAlbum(hit.id, lang));
    if (full?.tracks?.data.some((t) => sameTitle(t.title, track.title))) return full;
  }
  return album;
}

function albumFromIntro(intro: string): string[] {
  const out: string[] = [];
  const re = /\b(?:album|EP)s?,?\s+(?:titled\s+)?["“]?([A-Z0-9][^,(."”]{1,60}?)["”]?\s+\((\d{4})\)/g;
  for (const m of intro.matchAll(re)) out.push(m[1].trim());
  return out;
}

export async function getSong(id: number, lang: Lang = "en"): Promise<Song | null> {
  "use cache";

  let track: dz.DzTrack;
  try {
    track = await dz.getTrack(id);
  } catch (e) {
    if (e instanceof dz.NotFoundError) {
      cacheLife("hours");
      return null;
    }
    throw e;
  }
  const firstAlbum = await dz.getAlbum(track.album.id, lang);

  // Wikipedia/Wikidata are enrichment: if they fail, still show the song, but only cache it briefly.
  let degraded = false;
  const enrich = <T,>(p: Promise<T>) =>
    p.catch((err) => {
      console.error("[sonder] enrichment failed for track", id, err);
      degraded = true;
      return null;
    });

  const article = await enrich(findSongArticle(track.title, track.artist.name));
  const songFacts = article?.wikidataId ? await enrich(getWikidataFacts(article.wikidataId, lang)) : null;

  const albumCandidates = [
    ...(songFacts?.partOf ?? []),
    ...albumFromIntro(article?.intro ?? ""),
  ].filter((n, i, arr) => arr.indexOf(n) === i);

  const album = await canonicalAlbum(track, firstAlbum, albumCandidates, lang);
  const albumName = album.record_type === "album" ? album.title : albumCandidates.find((n) => !sameTitle(n, track.title));

  const dzGenres = (album.genres?.data ?? firstAlbum.genres?.data ?? []).map((g) => g.name);
  const wdGenres = (songFacts?.genres ?? []).map(capitalize);

  const writers = [...new Set([...(songFacts?.lyricists ?? []), ...(songFacts?.composers ?? []), ...(songFacts?.writers ?? [])])];

  const facts: Fact[] = [];
  const names = (key: FactKey, xs: string[] | undefined) => {
    if (xs && xs.length) facts.push({ key, source: "Wikidata", values: xs.slice(0, 4) });
  };
  names("writtenBy", writers);
  names("producedBy", songFacts?.producers);
  names("recordedAt", songFacts?.recordedAt);
  if (songFacts?.published) facts.push({ key: "released", source: "Wikidata", date: songFacts.published });
  const label = songFacts?.labels[0] ?? album.label;
  if (label) facts.push({ key: "label", source: songFacts?.labels[0] ? "Wikidata" : "Deezer", values: [label] });

  const position = album.tracks?.data.findIndex((t) => sameTitle(t.title, track.title)) ?? -1;
  if (album.record_type === "album" && position >= 0 && album.nb_tracks) {
    facts.push({ key: "track", source: "Deezer", track: { n: position + 1, total: album.nb_tracks, album: album.title } });
  }
  const m = Math.floor(track.duration / 60);
  facts.push({ key: "length", source: "Deezer", values: [`${m}:${String(track.duration % 60).padStart(2, "0")}`] });
  if (track.bpm && track.bpm > 0) facts.push({ key: "tempo", source: "Deezer", values: [`${Math.round(track.bpm)} BPM`] });

  const year = publishedYear(songFacts) ?? yearOf(album.release_date) ?? yearOf(track.release_date);
  if (degraded) cacheLife("minutes");
  else cacheLife("days");

  return {
    id: track.id,
    title: baseTitle(track.title) || track.title,
    artist: { id: track.artist.id, name: track.artist.name, picture: track.artist.picture_xl },
    album: {
      id: album.id,
      title: album.title,
      cover: album.cover_xl || album.cover_big,
      coverSmall: album.cover_medium,
      recordType: album.record_type,
      trackCount: album.nb_tracks,
    },
    year,
    genres: (wdGenres.length ? wdGenres : dzGenres).slice(0, 3),
    facts,
    deezerUrl: `https://www.deezer.com/track/${track.id}`,
    songArticle: article ? { title: article.title, url: article.url } : undefined,
    albumName,
    seed: {
      genres: dzGenres,
      year: year ?? yearOf(album.release_date),
      bpm: track.bpm && track.bpm > 0 ? track.bpm : undefined,
      label: album.label,
    },
  };
}

/* ---------- Story ---------- */

// Section headings to leave out, in English, Portuguese and Spanish Wikipedia.
const SKIP = new RegExp(
  [
    "references|external links|^notes|further reading|see also|track ?listing|personnel|credits|charts?$|chart performance|certifications|release history|sales|bibliography|sources|citations|footnotes|formats|year-end|weekly|decade-end|all-time|accolades|awards|cover versions|^covers|in popular culture|other versions|live performances|in media|appearances|tour$|setlist|videography|discography|samples|\\bversions?$|remix(es)?$",
    "refer[eê]ncias|liga[çc][õo]es externas|enlaces externos|bibliograf[ií]a|ver tamb[ée]m|v[ée]ase tambi[ée]n|lista de (faixas|canciones|temas)|faixas|cr[ée]ditos|^personal$|^equipe|paradas|desempenho|posi[çc][õo]es|posicionamiento|listas|certifica[çc]|hist[óo]rico de lan[çc]amento|historial de lanzamiento|vendas|ventas|pr[êé]mios|premios|vers[õo]es|versiones|^vers[ãa]o (de|em|por)|^versi[óo]n (de|en|por)|regrava[çc]|cultura popular|ao vivo|en vivo|turn[êe]|^gira|^fontes|^fuentes|^formatos",
  ].join("|"),
  "i",
);
const INTERPRETATION =
  /lyric|meaning|theme|composition|music and|interpretation|style|analysis|content|songwriting|sound|letra|significado|tema|composi[çc][ãa]o|composici[óo]n|interpreta[çc]|estilo|an[áa]lis|conte[úu]do|contenido|sonoridad/i;
const OPINION =
  /reception|critical|legacy|review|influence|impact|response|retrospective|recep[çc][ãa]o|recepci[óo]n|cr[íi]tica|legado|influ[êe]ncia|influencia|impacto|avalia[çc]|rese[ñn]as|resenhas/i;

function clean(p: string) {
  return p
    .replace(/\(\s*[;,]?\s*\)/g, "")
    .replace(/\s+([,.;:])/g, "$1")
    // Paragraph joins in the source text, e.g. "singing.The video"
    .replace(/([a-z]{2}[.!?]["”]?)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function usable(paragraphs: string[]) {
  return paragraphs.map(clean).filter((p) => p.length > 60 && /[.!?"”]$/.test(p));
}

// Headings that lead with history ("Background and composition") are mostly documented events.
const DOCUMENTED_FIRST =
  /^(background|history|origins?|writing|recording|production|development|conception|release|inspiration|antecedentes|hist[óo]ria|origem|origen|contexto|escrita|grava[çc][ãa]o|grabaci[óo]n|produ[çc][ãa]o|producci[óo]n|desenvolvimento|desarrollo|concep[çc]|lan[çc]amento|lanzamiento|inspira[çc])/i;

function classify(heading: string): StoryKind {
  if (DOCUMENTED_FIRST.test(heading)) return "documented";
  if (OPINION.test(heading)) return "opinion";
  if (INTERPRETATION.test(heading)) return "interpretation";
  return "documented";
}

async function articleStory(title: string, lang: Lang, maxSections: number) {
  const { lead, sections } = await getSections(title, lang);
  const out: StorySection[] = [];
  let current: StorySection | null = null;

  for (const s of sections) {
    if (s.level === 2) {
      current = null;
      if (SKIP.test(s.heading)) continue;
      current = {
        heading: s.heading,
        kind: classify(s.heading),
        paragraphs: usable(s.paragraphs),
        subsections: [],
        source: { title, url: articleUrl(title, s.anchor, lang) },
      };
      out.push(current);
    } else if (current && !SKIP.test(s.heading)) {
      const paragraphs = usable(s.paragraphs);
      if (paragraphs.length) current.subsections.push({ heading: s.heading, paragraphs });
    }
  }
  return {
    lead: usable(lead),
    sections: out.filter((s) => s.paragraphs.length || s.subsections.length).slice(0, maxSections),
  };
}

function paragraphCount(s: { lead: string[]; sections: StorySection[] }) {
  return s.lead.length + s.sections.reduce((n, x) => n + x.paragraphs.length + x.subsections.reduce((m, y) => m + y.paragraphs.length, 0), 0);
}

/** The article in the reader's language when Wikipedia has a substantial one, otherwise English. */
async function localizedStory(article: WikiArticle, lang: Lang, maxSections: number) {
  if (lang !== "en" && article.wikidataId) {
    const local = (await getSitelinks(article.wikidataId))[lang];
    if (local) {
      const s = await articleStory(local, lang, maxSections);
      if (paragraphCount(s) >= 3) return { ...s, title: local, lang, url: articleUrl(local, undefined, lang) };
    }
  }
  const s = await articleStory(article.title, "en", maxSections);
  return { ...s, title: article.title, lang: "en" as Lang, url: article.url };
}

const stripQualifier = (title: string) => title.replace(/\s*\([^)]*\)$/, "");

export async function getStory(id: number, lang: Lang = "en"): Promise<Story> {
  "use cache";

  const song = await getSong(id, lang);
  if (!song) {
    cacheLife("days");
    return { focus: "none", sections: [] };
  }

  // Failures throw (and aren't cached) so a Wikipedia hiccup never becomes "no story" for days.
  const [songArticle, albumArticle] = await Promise.all([
    song.songArticle ? findSongArticle(song.title, song.artist.name) : null,
    song.albumName ? findAlbumArticle(song.albumName, song.artist.name) : null,
  ]);
  const sameArticle = songArticle && albumArticle && songArticle.title === albumArticle.title;

  const story: Story = { focus: "none", sections: [] };

  if (songArticle) {
    const s = await localizedStory(songArticle, lang, 8);
    if (s.lead.length || s.sections.length) {
      story.focus = "song";
      story.songLang = s.lang;
      story.standfirst = { paragraphs: s.lead, source: { title: s.title, url: s.url } };
      story.sections = s.sections;
    }
  }

  if (albumArticle && !sameArticle) {
    const s = await localizedStory(albumArticle, lang, story.focus === "song" ? 2 : 6);
    if (s.lead.length || s.sections.length) {
      // When the song has its own article, keep only the album's origin story.
      const sections = story.focus === "song" ? s.sections.filter((x) => x.kind === "documented").slice(0, 2) : s.sections;
      story.album = { title: stripQualifier(s.title), lang: s.lang, paragraphs: s.lead, sections, source: { title: s.title, url: s.url } };
      if (story.focus === "none") story.focus = "album";
    }
  }

  if (story.focus === "none" || !story.album) {
    const artistArticle = await findArtistArticle(song.artist.name);
    if (artistArticle?.intro) {
      let artist: NonNullable<Story["artist"]> = {
        name: song.artist.name,
        lang: "en",
        paragraphs: usable(artistArticle.intro.split("\n")).slice(0, 3),
        source: { title: artistArticle.title, url: artistArticle.url },
      };
      if (lang !== "en" && artistArticle.wikidataId) {
        const local = (await getSitelinks(artistArticle.wikidataId))[lang];
        const lead = local ? usable((await getSections(local, lang)).lead).slice(0, 3) : [];
        if (local && lead.length >= 2) {
          artist = { name: song.artist.name, lang, paragraphs: lead, source: { title: local, url: articleUrl(local, undefined, lang) } };
        }
      }
      story.artist = artist;
      if (story.focus === "none" && artist.paragraphs.length) story.focus = "artist";
    }
  }

  // Blocks only available in English are machine-translated. If that fails, they stay in English
  // (the UI says so) and the result is cached briefly so the translation is retried soon.
  const translated = await translateStory(story, lang);
  if (translated) cacheLife("days");
  else cacheLife("minutes");
  return story;
}

type AddText = (text: string, set: (v: string) => void) => void;

function sectionTexts(sections: StorySection[], lang: Lang, add: AddText, onSuccess: (fn: () => void) => void) {
  // Known headings come from a hand-made glossary; only unfamiliar ones go to machine translation.
  // Both are applied only if the whole translation succeeds, so a story is never half-translated.
  const heading = (text: string, set: (v: string) => void) => {
    const known = translateHeading(text, lang);
    if (known) onSuccess(() => set(known));
    else add(text, set);
  };
  for (const s of sections) {
    heading(s.heading, (v) => (s.heading = v));
    s.paragraphs.forEach((p, i) => add(p, (v) => (s.paragraphs[i] = v)));
    for (const sub of s.subsections) {
      heading(sub.heading, (v) => (sub.heading = v));
      sub.paragraphs.forEach((p, i) => add(p, (v) => (sub.paragraphs[i] = v)));
    }
  }
}

/** Translates the story's English-only blocks in place. Returns false if translation failed. */
async function translateStory(story: Story, lang: Lang): Promise<boolean> {
  if (lang === "en") return true;
  const jobs: { text: string; set: (v: string) => void }[] = [];
  const add: AddText = (text, set) => jobs.push({ text, set });
  const marks: (() => void)[] = [];
  const onSuccess = (fn: () => void) => marks.push(fn);

  if (story.focus === "song" && story.songLang && story.songLang !== lang) {
    story.standfirst?.paragraphs.forEach((p, i) => add(p, (v) => (story.standfirst!.paragraphs[i] = v)));
    sectionTexts(story.sections, lang, add, onSuccess);
    marks.push(() => (story.songTranslated = true));
  }
  const album = story.album;
  if (album && album.lang !== lang) {
    album.paragraphs.forEach((p, i) => add(p, (v) => (album.paragraphs[i] = v)));
    sectionTexts(album.sections, lang, add, onSuccess);
    marks.push(() => (album.translated = true));
  }
  const artist = story.artist;
  if (artist && artist.lang !== lang) {
    artist.paragraphs.forEach((p, i) => add(p, (v) => (artist.paragraphs[i] = v)));
    marks.push(() => (artist.translated = true));
  }
  if (jobs.length === 0 && marks.length === 0) return true;

  try {
    const out = jobs.length ? await translateTexts(jobs.map((j) => j.text), "en", lang) : [];
    out.forEach((v, i) => jobs[i].set(v));
    marks.forEach((m) => m());
    return true;
  } catch (err) {
    console.error("[sonder] translation failed", err);
    return false;
  }
}

/* ---------- Recommendations ---------- */

const NOT_ORIGINAL = /\b(live|remix|mix\)|edit\)|demo|karaoke|instrumental|acoustic version|sped up|slowed)\b/i;

type Candidate = { artist: dz.DzArtist; relatedRank: number; track: dz.DzTrack };

function pickTrack(artist: dz.DzArtist, tracks: dz.DzTrack[], seedTitle: string): dz.DzTrack | undefined {
  return tracks.find(
    (t) => t.artist.id === artist.id && !NOT_ORIGINAL.test(t.title) && !sameTitle(t.title, seedTitle),
  );
}

// Compilations and reissues carry the wrong date for a song, so look past them.
const REISSUE =
  /\b(best of|greatest|hits|collection|anthology|essential|essentials|compilation|pre-cleared|deluxe|remaster(ed)?|anniversary|edition|expanded|reissue|definitive|ultimate|love rocks|live|b-sides|rarities|years)\b/i;

function isOriginalRelease(a: dz.DzAlbum | null, artistId: number): a is dz.DzAlbum {
  return !!a && a.artist?.id === artistId && ["album", "single", "ep"].includes(a.record_type) && !REISSUE.test(a.title);
}

/**
 * Popular tracks often surface from a compilation or reissue. When that happens, look for the
 * same studio recording on an original release; otherwise keep it and describe the album as is.
 */
async function originalRelease(c: Candidate, lang: Lang) {
  const album = await safe(dz.getAlbum(c.track.album.id, lang));
  if (isOriginalRelease(album, c.artist.id)) return { track: c.track, album };

  const found = await safe(dz.searchTracks(`${c.artist.name} ${baseTitle(c.track.title)}`, 25));
  const option = (found ?? []).find(
    (t) =>
      t.artist.id === c.artist.id &&
      sameTitle(t.title, c.track.title) &&
      !NOT_ORIGINAL.test(t.title) &&
      !/\b(mix|mixes|remix|live|session|version)\b/i.test(`${t.title} ${t.album.title}`) &&
      !REISSUE.test(t.album.title) &&
      t.album.id !== c.track.album.id,
  );
  const alt = option ? await safe(dz.getAlbum(option.album.id, lang)) : null;
  if (option && isOriginalRelease(alt, c.artist.id)) return { track: option, album: alt };
  return { track: c.track, album };
}

export async function getRecommendations(id: number, lang: Lang = "en"): Promise<Recommendation[]> {
  "use cache";
  cacheLife("days");

  const song = await getSong(id, lang);
  if (!song) return [];

  const related = (await dz.getRelatedArtists(song.artist.id, 20)).filter((a) => a.id !== song.artist.id).slice(0, 14);
  if (!related.length) return [];

  const tops = await mapLimit(related, 4, (a) => safe(dz.getTopTracks(a.id, 6)));
  const candidates: Candidate[] = [];
  related.forEach((artist, i) => {
    const track = pickTrack(artist, tops[i] ?? [], song.title);
    if (track) candidates.push({ artist, relatedRank: i, track });
  });

  const detailed = await mapLimit(candidates.slice(0, 11), 3, async (c) => {
    const original = await originalRelease(c, lang);
    const detail = await safe(dz.getTrack(original.track.id));
    return { ...c, ...original, detail };
  });

  const seedGenres = new Set(song.seed.genres.map(norm));
  const seedName = song.artist.name;

  const scored = detailed.map((c) => {
    const genres = (c.album?.genres?.data ?? []).map((g) => g.name);
    const sharedGenres = genres.filter((g) => seedGenres.has(norm(g)));
    const year = yearOf(c.album?.release_date);
    const albumTitle = baseTitle(c.album?.title ?? c.track.album.title) || c.track.album.title;
    const bpm = c.detail?.bpm && c.detail.bpm > 0 ? c.detail.bpm : undefined;
    const label = c.album?.label;

    let score = 1 - c.relatedRank / (related.length * 2);
    if (sharedGenres.length) score += 0.25;
    if (year && song.seed.year) score += 0.2 * (1 - Math.min(Math.abs(year - song.seed.year), 20) / 20);
    if (bpm && song.seed.bpm) score += 0.1 * (1 - Math.min(Math.abs(bpm - song.seed.bpm), 30) / 30);

    // Every reason restates a data point; nothing is invented.
    const parts: ReasonPart[] = [{ t: "related", top: c.relatedRank < 3, seed: seedName }];
    if (sharedGenres.length) parts.push({ t: "sharesTag", tag: sharedGenres[0], title: song.title });
    else if (genres.length) parts.push({ t: "leans", genre: genres[0] });
    if (bpm && song.seed.bpm && Math.abs(bpm - song.seed.bpm) <= 6) {
      parts.push({ t: "tempo", bpm: Math.round(bpm), seed: Math.round(song.seed.bpm) });
    } else if (year && song.seed.year && Math.abs(year - song.seed.year) <= 3) {
      parts.push({ t: "era", album: albumTitle, year, diff: year - song.seed.year, title: song.title });
    }
    if (label && song.seed.label && norm(label) === norm(song.seed.label)) parts.push({ t: "label", label });

    const signals = [
      ...(genres.length ? [genres[0]] : []),
      ...(year ? [String(year)] : []),
      ...(bpm ? [`${Math.round(bpm)} BPM`] : []),
    ];

    const card = toCard(c.track);
    return {
      score,
      rec: {
        ...card,
        title: baseTitle(card.title) || card.title,
        album: albumTitle,
        cover: c.album?.cover_xl || c.track.album.cover_xl || c.track.album.cover_big,
        year,
        reasons: parts.slice(0, 3),
        signals,
      } satisfies Recommendation,
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((s) => s.rec);
}

/* ---------- Ambience ---------- */

export async function getAmbientCovers(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  const albums = await safe(dz.getChartAlbums(10));
  return (albums ?? []).map((a) => a.cover_big).filter(Boolean).slice(0, 6);
}

export type { WikidataFacts };

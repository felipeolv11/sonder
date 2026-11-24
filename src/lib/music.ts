import { cacheLife } from "next/cache";
import * as dz from "./deezer";
import { mapLimit } from "./http";
import { translateHeading } from "./headings";
import { baseTitle, capitalize, editionless, norm, sameTitle, yearOf } from "./text";
import {
  articleUrl,
  findAlbumArticle,
  findArtistArticle,
  findSongArticle,
  getSections,
  getSitelinks,
  getArtistEvents,
  getReleaseDates,
  getWikidataFacts,
  translateTexts,
  publishedYear,
  type WikiArticle,
  type WdDate,
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

export type FactKey = "writtenBy" | "producedBy" | "recordedAt" | "released" | "label" | "track" | "tracks" | "length" | "tempo";

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

/** Filters the reader can apply to recommendations, each derived from data the ranking already uses. */
export type RecFilter = "sameEra" | "lesserKnown" | "otherGenre";

export type Recommendation = SongCard & {
  year?: number;
  reasons: ReasonPart[];
  signals: string[];
  filters: RecFilter[];
};

/** One Wikipedia article, cut down to its quotable parts, for the artist and album pages. */
export type ArticleBlock = {
  title: string;
  lang: Lang;
  translated?: boolean;
  paragraphs: string[];
  sections: StorySection[];
  source: Source;
};

export type ReleaseCard = {
  id: number;
  title: string;
  artist: string;
  cover: string;
  coverSmall: string;
  year?: number;
  recordType: string;
};

export type ArtistCard = { id: number; name: string; picture: string };

export type TrackRow = { id: number; title: string; artist: string; album: string; coverSmall: string; duration: number };

export type Artist = {
  id: number;
  name: string;
  picture: string;
  fans?: number;
  deezerUrl: string;
  topTracks: TrackRow[];
  albums: ReleaseCard[];
  singles: ReleaseCard[];
  related: ArtistCard[];
};

export type Album = {
  id: number;
  title: string;
  cover: string;
  coverSmall: string;
  recordType: string;
  year?: number;
  artist: { id: number; name: string };
  genres: string[];
  facts: Fact[];
  tracks: (TrackRow & { n: number })[];
  deezerUrl: string;
  article?: { title: string; url: string; wikidataId?: string };
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
    "references|external links|^notes|further reading|see also|track ?listing|personnel|credits|charts?$|chart performance|certifications|release history|sales|bibliography|sources|citations|footnotes|formats|year-end|weekly|decade-end|all-time|accolades|awards|cover versions|^covers|in popular culture|other versions|live performances|in media|appearances|tour$|setlist|videography|discography|samples|\\bversions?$|remix(es)?$|^(band )?members|^line-?ups?$|filmography|^tours$|concert tours",
    "refer[eê]ncias|liga[çc][õo]es externas|enlaces externos|bibliograf[ií]a|ver tamb[ée]m|v[ée]ase tambi[ée]n|lista de (faixas|canciones|temas)|faixas|cr[ée]ditos|^personal$|^equipe|paradas|desempenho|posi[çc][õo]es|posicionamiento|listas|certifica[çc]|hist[óo]rico de lan[çc]amento|historial de lanzamiento|vendas|ventas|pr[êé]mios|premios|vers[õo]es|versiones|^vers[ãa]o (de|em|por)|^versi[óo]n (de|en|por)|regrava[çc]|cultura popular|ao vivo|en vivo|turn[êe]|^gira|^fontes|^fuentes|^formatos|^(membros|integrantes|miembros|forma[çc][ãa]o|formaci[óo]n|pessoal|ficha t[ée]cnica)$|^discografia",
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

/**
 * Collects English-only text to machine-translate into `lang`, then applies it all at once.
 * `run` returns false if translation failed; the text is then left in English, untouched.
 */
function translation(lang: Lang) {
  const jobs: { text: string; set: (v: string) => void }[] = [];
  const marks: (() => void)[] = [];
  const add: AddText = (text, set) => jobs.push({ text, set });
  const onSuccess = (fn: () => void) => marks.push(fn);

  return {
    add,
    onSuccess,
    sections: (sections: StorySection[]) => sectionTexts(sections, lang, add, onSuccess),
    /** Queues a block read from another Wikipedia edition; it's flagged `translated` on success. */
    block(b: { lang: Lang; translated?: boolean; paragraphs: string[]; sections?: StorySection[] }) {
      if (b.lang === lang) return;
      b.paragraphs.forEach((p, i) => add(p, (v) => (b.paragraphs[i] = v)));
      if (b.sections) sectionTexts(b.sections, lang, add, onSuccess);
      onSuccess(() => (b.translated = true));
    },
    async run(): Promise<boolean> {
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
    },
  };
}

/** Translates the story's English-only blocks in place. Returns false if translation failed. */
async function translateStory(story: Story, lang: Lang): Promise<boolean> {
  const tr = translation(lang);
  if (story.focus === "song" && story.songLang && story.songLang !== lang) {
    story.standfirst?.paragraphs.forEach((p, i) => tr.add(p, (v) => (story.standfirst!.paragraphs[i] = v)));
    tr.sections(story.sections);
    tr.onSuccess(() => (story.songTranslated = true));
  }
  if (story.album) tr.block(story.album);
  if (story.artist) tr.block(story.artist);
  return tr.run();
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

  const related = (await dz.getRelatedArtists(song.artist.id, 20)).filter((a) => a.id !== song.artist.id).slice(0, 18);
  if (!related.length) return [];

  const tops = await mapLimit(related, 4, (a) => safe(dz.getTopTracks(a.id, 6)));
  const candidates: Candidate[] = [];
  related.forEach((artist, i) => {
    const track = pickTrack(artist, tops[i] ?? [], song.title);
    if (track) candidates.push({ artist, relatedRank: i, track });
  });

  // A pool larger than the ten shown, so each filter still has songs to offer.
  const detailed = await mapLimit(candidates.slice(0, 16), 3, async (c) => {
    const original = await originalRelease(c, lang);
    const detail = await safe(dz.getTrack(original.track.id));
    return { ...c, ...original, detail };
  });

  const seedGenres = new Set(song.seed.genres.map(norm));
  const seedName = song.artist.name;
  // "Lesser known" means fewer Deezer fans than most of the other candidates.
  const fanCounts = detailed.map((c) => c.artist.nb_fan).filter((n): n is number => typeof n === "number").sort((a, b) => a - b);
  const medianFans = fanCounts.length ? fanCounts[Math.floor(fanCounts.length / 2)] : undefined;

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

    const filters: RecFilter[] = [];
    if (year && song.seed.year && Math.abs(year - song.seed.year) <= 5) filters.push("sameEra");
    if (medianFans !== undefined && c.artist.nb_fan !== undefined && c.artist.nb_fan < medianFans) filters.push("lesserKnown");
    if (genres.length && !sharedGenres.length) filters.push("otherGenre");

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
        filters,
      } satisfies Recommendation,
    };
  });

  return scored.sort((a, b) => b.score - a.score).map((s) => s.rec);
}

/* ---------- Artist ---------- */

function toRelease(a: dz.DzAlbum, artist: string): ReleaseCard {
  return {
    id: a.id,
    title: a.title,
    artist: a.artist?.name ?? artist,
    cover: a.cover_xl || a.cover_big,
    coverSmall: a.cover_medium,
    year: yearOf(a.release_date),
    recordType: a.record_type,
  };
}

function toRow(t: dz.DzTrack, album?: dz.DzAlbumRef): TrackRow {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist.name,
    album: (album ?? t.album)?.title ?? "",
    coverSmall: (album ?? t.album)?.cover_medium ?? "",
    duration: t.duration,
  };
}

/** Drops reissues of the same release ("Remastered", "Deluxe Edition"), keeping the earliest. */
function uniqueReleases(list: ReleaseCard[]) {
  const best = new Map<string, ReleaseCard>();
  for (const r of list) {
    const key = norm(editionless(r.title));
    const prev = best.get(key);
    if (!prev || (r.year ?? 9999) < (prev.year ?? 9999)) best.set(key, r);
  }
  const keep = new Set(best.values());
  return list.filter((r) => keep.has(r));
}

export async function getArtist(id: number): Promise<Artist | null> {
  "use cache";

  let artist: dz.DzArtist;
  try {
    artist = await dz.getArtist(id);
  } catch (e) {
    if (e instanceof dz.NotFoundError) {
      cacheLife("hours");
      return null;
    }
    throw e;
  }

  // The artist's own record is enough to show the page; the lists around it are best effort.
  let degraded = false;
  const part = <T,>(p: Promise<T[]>) =>
    p.catch((err) => {
      console.error("[sonder] artist data failed for", id, err);
      degraded = true;
      return [] as T[];
    });
  const [top, releases, related] = await Promise.all([
    part(dz.getTopTracks(id, 20)),
    part(dz.getArtistAlbums(id, 100)),
    part(dz.getRelatedArtists(id, 14)),
  ]);

  const seen = new Set<string>();
  const topTracks = top
    .filter((t) => !NOT_ORIGINAL.test(t.title))
    .filter((t) => {
      const key = norm(baseTitle(t.title));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10)
    .map((t) => ({ ...toRow(t), title: baseTitle(t.title) || t.title }));

  // Deezer lists releases newest first; compilations are left out.
  const cards = releases.filter((a) => a.record_type !== "compile").map((a) => toRelease(a, artist.name));

  if (degraded) cacheLife("minutes");
  else cacheLife("days");

  return {
    id: artist.id,
    name: artist.name,
    picture: artist.picture_xl || artist.picture_big || "",
    fans: artist.nb_fan,
    deezerUrl: `https://www.deezer.com/artist/${artist.id}`,
    topTracks,
    albums: uniqueReleases(cards.filter((c) => c.recordType === "album")),
    singles: uniqueReleases(cards.filter((c) => c.recordType === "ep" || c.recordType === "single")),
    related: related
      .filter((a) => a.id !== artist.id && (a.picture_xl || a.picture_big))
      .slice(0, 12)
      .map((a) => ({ id: a.id, name: a.name, picture: a.picture_big || a.picture_xl || "" })),
  };
}

/** Limits a long article (artist pages run to dozens of sections) to what a reader will open. */
function trimSections(sections: StorySection[], max: number, maxSubsections: number) {
  return sections.slice(0, max).map((s) => ({ ...s, subsections: s.subsections.slice(0, maxSubsections) }));
}

async function articleBlock(article: WikiArticle, lang: Lang, maxSections: number, maxSubsections = 6): Promise<ArticleBlock | null> {
  const s = await localizedStory(article, lang, maxSections);
  if (!s.lead.length && !s.sections.length) return null;
  return {
    title: stripQualifier(s.title),
    lang: s.lang,
    paragraphs: s.lead,
    sections: trimSections(s.sections, maxSections, maxSubsections),
    source: { title: s.title, url: s.url },
  };
}

/** The artist's Wikipedia biography, in the reader's language when possible. Null if there's none. */
export async function getArtistBio(id: number, lang: Lang = "en"): Promise<ArticleBlock | null> {
  "use cache";

  const artist = await getArtist(id);
  const article = artist ? await findArtistArticle(artist.name) : null;
  const block = article ? await articleBlock(article, lang, 4, 4) : null;
  if (!block) {
    cacheLife("days");
    return null;
  }
  const tr = translation(lang);
  tr.block(block);
  if (await tr.run()) cacheLife("days");
  else cacheLife("minutes");
  return block;
}

/* ---------- Artist timeline ---------- */

export type TimelineEntry =
  | { t: "event"; kind: "formed" | "born" | "activeFrom" | "dissolved" | "died"; year: number; date: WdDate }
  | { t: "release"; year: number; release: ReleaseCard; source: "Wikidata" | "Deezer" };

/**
 * The artist's releases year by year, with formation, birth, break-up and death from Wikidata.
 * Releases follow the Deezer discography (Wikidata's lists mix in demos, singles and box sets),
 * but their dates come from Wikidata when it knows the release, since Deezer often has a reissue date.
 */
export async function getArtistTimeline(id: number, lang: Lang = "en"): Promise<TimelineEntry[]> {
  "use cache";

  const artist = await getArtist(id);
  if (!artist) {
    cacheLife("days");
    return [];
  }

  let degraded = false;
  const enrich = <T,>(p: Promise<T>) =>
    p.catch((err) => {
      console.error("[sonder] timeline enrichment failed for artist", id, err);
      degraded = true;
      return null;
    });
  const article = await enrich(findArtistArticle(artist.name));
  const qid = article?.wikidataId;
  const [events, wdReleases] = qid
    ? await Promise.all([enrich(getArtistEvents(qid)), enrich(getReleaseDates(qid, lang))])
    : [null, null];

  const firstYear = new Map<string, number>();
  for (const r of wdReleases ?? []) {
    const y = yearOf(r.date);
    for (const name of [r.englishTitle, r.title]) {
      if (!name || !y) continue;
      const key = norm(editionless(name));
      if (!firstYear.has(key) || y < firstYear.get(key)!) firstYear.set(key, y);
    }
  }

  // After an artist's death, Deezer's "albums" are mostly compilations and reissues with new dates:
  // from then on, only releases Wikidata documents make the timeline.
  const deathYear = yearOf(events?.died?.iso);
  const entries: TimelineEntry[] = [];
  for (const release of [...artist.albums, ...artist.singles.filter((s) => s.recordType === "ep")]) {
    const wdYear = firstYear.get(norm(editionless(release.title)));
    const year = wdYear ?? release.year;
    if (!year) continue;
    if (deathYear && !wdYear && year > deathYear) continue;
    entries.push({ t: "release", year, release: { ...release, year }, source: wdYear ? "Wikidata" : "Deezer" });
  }

  const lastRelease = Math.max(0, ...entries.map((e) => e.year));
  const event = (kind: Extract<TimelineEntry, { t: "event" }>["kind"], date?: WdDate) => {
    const year = yearOf(date?.iso);
    if (date && year) entries.push({ t: "event", kind, year, date });
  };
  if (events?.formed) event("formed", events.formed);
  else if (events?.born) event("born", events.born);
  if (events?.activeFrom && !events.formed) event("activeFrom", events.activeFrom);
  // A band that "dissolved" and kept releasing albums afterwards has reunited: leave the break-up out.
  if (events?.dissolved && (yearOf(events.dissolved.iso) ?? 0) >= lastRelease) event("dissolved", events.dissolved);
  if (events?.died) event("died", events.died);

  // Chronological; within a year, beginnings first, endings last.
  const order = (e: TimelineEntry) =>
    e.t === "release" ? 1 : e.kind === "dissolved" || e.kind === "died" ? 2 : 0;
  entries.sort((a, b) => a.year - b.year || order(a) - order(b));

  if (degraded) cacheLife("minutes");
  else cacheLife("days");
  return entries;
}

/* ---------- Album ---------- */

export async function getAlbum(id: number, lang: Lang = "en"): Promise<Album | null> {
  "use cache";

  let album: dz.DzAlbum;
  try {
    album = await dz.getAlbum(id, lang);
  } catch (e) {
    if (e instanceof dz.NotFoundError) {
      cacheLife("hours");
      return null;
    }
    throw e;
  }

  let degraded = false;
  const enrich = <T,>(p: Promise<T>) =>
    p.catch((err) => {
      console.error("[sonder] enrichment failed for album", id, err);
      degraded = true;
      return null;
    });

  // A single is usually documented in the song's own article.
  let article = await enrich(findAlbumArticle(album.title, album.artist.name));
  if (!article && album.record_type === "single") article = await enrich(findSongArticle(album.title, album.artist.name));
  const wd = article?.wikidataId ? await enrich(getWikidataFacts(article.wikidataId, lang)) : null;

  const facts: Fact[] = [];
  const names = (key: FactKey, xs: string[] | undefined) => {
    if (xs && xs.length) facts.push({ key, source: "Wikidata", values: xs.slice(0, 4) });
  };
  names("producedBy", wd?.producers);
  names("recordedAt", wd?.recordedAt);
  // Deezer's date is often that of a reissue, so Wikidata's first publication date wins.
  if (wd?.published) facts.push({ key: "released", source: "Wikidata", date: wd.published });
  else if (album.release_date) facts.push({ key: "released", source: "Deezer", date: { iso: album.release_date, precision: 11 } });
  const label = wd?.labels[0] ?? album.label;
  if (label) facts.push({ key: "label", source: wd?.labels[0] ? "Wikidata" : "Deezer", values: [label] });
  if (album.nb_tracks) facts.push({ key: "tracks", source: "Deezer", values: [String(album.nb_tracks)] });
  if (album.duration) facts.push({ key: "length", source: "Deezer", values: [`${Math.round(album.duration / 60)} min`] });

  const dzGenres = (album.genres?.data ?? []).map((g) => g.name);
  const wdGenres = (wd?.genres ?? []).map(capitalize);

  if (degraded) cacheLife("minutes");
  else cacheLife("days");

  return {
    id: album.id,
    title: album.title,
    cover: album.cover_xl || album.cover_big,
    coverSmall: album.cover_medium,
    recordType: album.record_type,
    year: publishedYear(wd) ?? yearOf(album.release_date),
    artist: { id: album.artist.id, name: album.artist.name },
    genres: (wdGenres.length ? wdGenres : dzGenres).slice(0, 3),
    facts,
    tracks: (album.tracks?.data ?? []).map((t, i) => ({ ...toRow(t, album), n: i + 1 })),
    deezerUrl: `https://www.deezer.com/album/${album.id}`,
    article: article ? { title: article.title, url: article.url, wikidataId: article.wikidataId } : undefined,
  };
}

/** The album's Wikipedia article as a story, in the reader's language when possible. Null if there's none. */
export async function getAlbumStory(id: number, lang: Lang = "en"): Promise<ArticleBlock | null> {
  "use cache";

  const album = await getAlbum(id, lang);
  const ref = album?.article;
  const block = ref ? await articleBlock({ ...ref, intro: "" }, lang, 6) : null;
  if (!block) {
    cacheLife("days");
    return null;
  }
  const tr = translation(lang);
  tr.block(block);
  if (await tr.run()) cacheLife("days");
  else cacheLife("minutes");
  return block;
}

/* ---------- Catalogue search (artists and albums) ---------- */

/** The artist a query names, and albums matching it, to show above the song results. */
export async function searchCatalog(query: string): Promise<{ artist: ArtistCard | null; albums: ReleaseCard[] }> {
  "use cache";
  cacheLife("hours");

  const q = query.trim();
  if (!q) return { artist: null, albums: [] };
  const qn = ` ${norm(q)} `;
  const [artists, albums] = await Promise.all([safe(dz.searchArtists(q, 5)), safe(dz.searchAlbums(q, 20))]);

  // Only an artist whose whole name is in the query: "radiohead creep" -> Radiohead.
  const named = (artists ?? []).find((a) => norm(a.name).length > 1 && qn.includes(` ${norm(a.name)} `));
  const artist = named ? { id: named.id, name: named.name, picture: named.picture_big || named.picture_xl || "" } : null;

  const matching = (albums ?? [])
    .filter((a) => a.record_type !== "compile" && !TRIBUTE.test(`${a.title} ${a.artist?.name ?? ""}`))
    .filter((a) => (artist ? a.artist?.id === artist.id : true))
    .map((a) => toRelease(a, a.artist?.name ?? ""));

  return { artist, albums: uniqueReleases(matching).slice(0, 6) };
}

/* ---------- Ambience ---------- */

export async function getAmbientCovers(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  const albums = await safe(dz.getChartAlbums(10));
  return (albums ?? []).map((a) => a.cover_big).filter(Boolean).slice(0, 6);
}

export type { WikidataFacts };

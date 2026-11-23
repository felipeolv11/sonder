import { cacheLife } from "next/cache";
import * as dz from "./deezer";
import { mapLimit } from "./http";
import { baseTitle, capitalize, listJoin, norm, numberWord, sameTitle, yearOf } from "./text";
import {
  articleUrl,
  findAlbumArticle,
  findArtistArticle,
  findSongArticle,
  getSections,
  getWikidataFacts,
  publishedYear,
  type WikiArticle,
  type WikidataFacts,
} from "./wiki";

/* ---------- Types shared with the UI ---------- */

export type SongCard = {
  id: number;
  title: string;
  artist: string;
  album: string;
  cover: string;
  coverSmall: string;
};

export type Fact = { label: string; value: string; source: "Wikidata" | "Deezer" };

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

export type Story = {
  /** "song" when Wikipedia has an article for the track itself. */
  focus: "song" | "album" | "artist" | "none";
  standfirst?: { paragraphs: string[]; source: { title: string; url: string } };
  sections: StorySection[];
  album?: { title: string; paragraphs: string[]; sections: StorySection[]; source: { title: string; url: string } };
  artist?: { name: string; paragraphs: string[]; source: { title: string; url: string } };
};

export type Recommendation = SongCard & {
  year?: number;
  reason: string;
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

  const scored = tracks
    .filter((t) => t.readable !== false)
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
async function canonicalAlbum(track: dz.DzTrack, album: dz.DzAlbum, candidates: string[]): Promise<dz.DzAlbum> {
  if (album.record_type === "album") return album;
  for (const name of candidates) {
    if (sameTitle(name, track.title)) continue;
    const found = await safe(dz.searchAlbums(`${track.artist.name} ${name}`, 15));
    const hit = (found ?? []).find((a) => a.artist?.id === track.artist.id && norm(a.title) === norm(name) && a.record_type === "album");
    if (!hit) continue;
    const full = await safe(dz.getAlbum(hit.id));
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

function precisionDate(iso: string, precision: number) {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso.slice(0, 4);
  if (precision >= 11) return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  if (precision === 10) return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return iso.slice(0, 4);
}

export async function getSong(id: number): Promise<Song | null> {
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
  const firstAlbum = await dz.getAlbum(track.album.id);

  // Wikipedia/Wikidata are enrichment: if they fail, still show the song, but only cache it briefly.
  let degraded = false;
  const enrich = <T,>(p: Promise<T>) =>
    p.catch((err) => {
      console.error("[sonder] enrichment failed for track", id, err);
      degraded = true;
      return null;
    });

  const article = await enrich(findSongArticle(track.title, track.artist.name));
  const songFacts = article?.wikidataId ? await enrich(getWikidataFacts(article.wikidataId)) : null;

  const albumCandidates = [
    ...(songFacts?.partOf ?? []),
    ...albumFromIntro(article?.intro ?? ""),
  ].filter((n, i, arr) => arr.indexOf(n) === i);

  const album = await canonicalAlbum(track, firstAlbum, albumCandidates);
  const albumName = album.record_type === "album" ? album.title : albumCandidates.find((n) => !sameTitle(n, track.title));

  const dzGenres = (album.genres?.data ?? firstAlbum.genres?.data ?? []).map((g) => g.name);
  const wdGenres = (songFacts?.genres ?? []).map(capitalize);

  const credits = (xs: string[] | undefined) => (xs && xs.length ? listJoin(xs.slice(0, 4)) : undefined);
  const writers = [...new Set([...(songFacts?.lyricists ?? []), ...(songFacts?.composers ?? []), ...(songFacts?.writers ?? [])])];

  const facts: Fact[] = [];
  const push = (label: string, value: string | undefined, source: Fact["source"]) => {
    if (value) facts.push({ label, value, source });
  };
  push("Written by", credits(writers), "Wikidata");
  push("Produced by", credits(songFacts?.producers), "Wikidata");
  push("Recorded at", credits(songFacts?.recordedAt), "Wikidata");
  push("Released", songFacts?.published ? precisionDate(songFacts.published.iso, songFacts.published.precision) : undefined, "Wikidata");
  push("Label", songFacts?.labels[0] ?? album.label, songFacts?.labels[0] ? "Wikidata" : "Deezer");

  const position = album.tracks?.data.findIndex((t) => sameTitle(t.title, track.title)) ?? -1;
  if (album.record_type === "album" && position >= 0 && album.nb_tracks) {
    push("Track", `${position + 1} of ${album.nb_tracks} on ${album.title}`, "Deezer");
  }
  const m = Math.floor(track.duration / 60);
  push("Length", `${m}:${String(track.duration % 60).padStart(2, "0")}`, "Deezer");
  if (track.bpm && track.bpm > 0) push("Tempo", `${Math.round(track.bpm)} BPM`, "Deezer");

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

const SKIP =
  /references|external links|^notes|further reading|see also|track ?listing|personnel|credits|charts?$|chart performance|certifications|release history|sales|bibliography|sources|citations|footnotes|formats|year-end|weekly|decade-end|all-time|accolades|awards|cover versions|^covers|in popular culture|other versions|live performances|in media|appearances|tour$|setlist|videography|discography|samples|\bversions?$|remix(es)?$/i;
const INTERPRETATION = /lyric|meaning|theme|composition|music and|interpretation|style|analysis|content|songwriting|sound/i;
const OPINION = /reception|critical|legacy|review|influence|impact|response|retrospective/i;

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
const DOCUMENTED_FIRST = /^(background|history|origins?|writing|recording|production|development|conception|release|inspiration)/i;

function classify(heading: string): StoryKind {
  if (DOCUMENTED_FIRST.test(heading)) return "documented";
  if (OPINION.test(heading)) return "opinion";
  if (INTERPRETATION.test(heading)) return "interpretation";
  return "documented";
}

async function articleStory(article: WikiArticle, maxSections: number) {
  const { lead, sections } = await getSections(article.title);
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
        source: { title: article.title, url: articleUrl(article.title, s.anchor) },
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

export async function getStory(id: number): Promise<Story> {
  "use cache";
  cacheLife("days");

  const song = await getSong(id);
  if (!song) return { focus: "none", sections: [] };

  // Failures throw (and aren't cached) so a Wikipedia hiccup never becomes "no story" for days.
  const [songArticle, albumArticle] = await Promise.all([
    song.songArticle ? findSongArticle(song.title, song.artist.name) : null,
    song.albumName ? findAlbumArticle(song.albumName, song.artist.name) : null,
  ]);
  const sameArticle = songArticle && albumArticle && songArticle.title === albumArticle.title;

  const story: Story = { focus: "none", sections: [] };

  if (songArticle) {
    const s = await articleStory(songArticle, 8);
    if (s && (s.lead.length || s.sections.length)) {
      story.focus = "song";
      story.standfirst = { paragraphs: s.lead, source: { title: songArticle.title, url: songArticle.url } };
      story.sections = s.sections;
    }
  }

  if (albumArticle && !sameArticle) {
    const s = await articleStory(albumArticle, story.focus === "song" ? 2 : 6);
    if (s && (s.lead.length || s.sections.length)) {
      // When the song has its own article, keep only the album's origin story.
      const sections = story.focus === "song" ? s.sections.filter((x) => x.kind === "documented").slice(0, 2) : s.sections;
      story.album = {
        title: albumArticle.title.replace(/\s*\([^)]*\)$/, ""),
        paragraphs: s.lead,
        sections,
        source: { title: albumArticle.title, url: albumArticle.url },
      };
      if (story.focus === "none") story.focus = "album";
    }
  }

  if (story.focus === "none" || !story.album) {
    const artistArticle = await findArtistArticle(song.artist.name);
    if (artistArticle?.intro) {
      story.artist = {
        name: song.artist.name,
        paragraphs: usable(artistArticle.intro.split("\n")).slice(0, 3),
        source: { title: artistArticle.title, url: artistArticle.url },
      };
      if (story.focus === "none" && story.artist.paragraphs.length) story.focus = "artist";
    }
  }
  return story;
}

/* ---------- Recommendations ---------- */

const NOT_ORIGINAL = /\b(live|remix|mix\)|edit\)|demo|karaoke|instrumental|acoustic version|sped up|slowed)\b/i;

type Candidate = { artist: dz.DzArtist; relatedRank: number; track: dz.DzTrack };

function pickTrack(artist: dz.DzArtist, tracks: dz.DzTrack[], seedTitle: string): dz.DzTrack | undefined {
  return tracks.find(
    (t) => t.artist.id === artist.id && t.readable !== false && !NOT_ORIGINAL.test(t.title) && !sameTitle(t.title, seedTitle),
  );
}

function eraPhrase(album: string, year: number | undefined, seedYear: number | undefined, seedTitle: string) {
  if (!year || !seedYear) return undefined;
  const d = year - seedYear;
  if (d === 0) return `From ${album} (${year}), the same year as “${seedTitle}”.`;
  if (Math.abs(d) <= 3) {
    const n = Math.abs(d);
    return `From ${album} (${year}), ${numberWord(n)} year${n > 1 ? "s" : ""} ${d > 0 ? "after" : "before"} “${seedTitle}”.`;
  }
  return undefined;
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
async function originalRelease(c: Candidate) {
  const album = await safe(dz.getAlbum(c.track.album.id));
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
  const alt = option ? await safe(dz.getAlbum(option.album.id)) : null;
  if (option && isOriginalRelease(alt, c.artist.id)) return { track: option, album: alt };
  return { track: c.track, album };
}

export async function getRecommendations(id: number): Promise<Recommendation[]> {
  "use cache";
  cacheLife("days");

  const song = await getSong(id);
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
    const original = await originalRelease(c);
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

    // Every sentence below restates a data point; nothing is invented.
    const parts: string[] = [];
    parts.push(
      c.relatedRank < 3
        ? `Among the three artists Deezer relates most closely to ${seedName}.`
        : `One of the artists Deezer relates to ${seedName}.`,
    );
    if (sharedGenres.length) parts.push(`Shares the ${sharedGenres[0].toLowerCase()} tag with “${song.title}”.`);
    else if (genres.length) parts.push(`Leans toward ${genres[0].toLowerCase()}.`);
    if (bpm && song.seed.bpm && Math.abs(bpm - song.seed.bpm) <= 6) {
      parts.push(`A similar tempo: ${Math.round(bpm)} BPM against ${Math.round(song.seed.bpm)}.`);
    } else {
      const era = eraPhrase(albumTitle, year, song.seed.year, song.title);
      if (era) parts.push(era);
    }
    if (label && song.seed.label && norm(label) === norm(song.seed.label)) parts.push(`Also released on ${label}.`);

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
        reason: parts.slice(0, 3).join(" "),
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

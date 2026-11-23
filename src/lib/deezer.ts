import { createLimiter, fetchJson, UpstreamError, wait } from "./http";

const API = "https://api.deezer.com";

export type DzArtist = {
  id: number;
  name: string;
  picture_xl?: string;
  picture_big?: string;
  nb_fan?: number;
};

export type DzAlbumRef = {
  id: number;
  title: string;
  cover_medium: string;
  cover_big: string;
  cover_xl: string;
  md5_image?: string;
};

export type DzTrack = {
  id: number;
  title: string;
  title_short: string;
  duration: number;
  rank: number;
  readable?: boolean;
  release_date?: string;
  bpm?: number;
  track_position?: number;
  disk_number?: number;
  artist: DzArtist;
  album: DzAlbumRef;
  contributors?: DzArtist[];
};

export type DzAlbum = DzAlbumRef & {
  record_type: "album" | "single" | "ep" | "compile" | string;
  release_date?: string;
  label?: string;
  nb_tracks?: number;
  genres?: { data: { id: number; name: string }[] };
  artist: DzArtist;
  tracks?: { data: DzTrack[] };
};

type DzError = { error?: { type: string; message: string; code: number } };
type DzList<T> = { data: T[]; total?: number } & DzError;

// Deezer allows about 50 requests per 5 seconds; stay just under it.
const slot = createLimiter(6, 105);

export class NotFoundError extends Error {}

// Genre names come back in the Accept-Language language.
const ACCEPT_LANGUAGE: Record<string, string> = { en: "en", pt: "pt-BR", es: "es" };

async function dz<T extends DzError>(path: string, params: Record<string, string | number> = {}, lang = "en"): Promise<T> {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  for (let attempt = 0; attempt < 3; attempt++) {
    const body = await slot(() =>
      fetchJson<T>(url.toString(), { source: "Deezer", headers: { "Accept-Language": ACCEPT_LANGUAGE[lang] ?? "en" } }),
    );
    if (!body.error) return body;
    if (body.error.code === 800) throw new NotFoundError(body.error.message);
    if (body.error.code === 4) {
      await wait(1200 * (attempt + 1)); // quota exceeded, back off
      continue;
    }
    throw new UpstreamError(`Deezer: ${body.error.message}`, "Deezer");
  }
  throw new UpstreamError("Deezer is rate limiting requests", "Deezer");
}

export async function searchTracks(q: string, limit = 50) {
  const res = await dz<DzList<DzTrack>>("/search/track", { q, limit });
  return res.data ?? [];
}

export async function searchAlbums(q: string, limit = 12) {
  const res = await dz<DzList<DzAlbum>>("/search/album", { q, limit });
  return res.data ?? [];
}

export function getTrack(id: number | string) {
  return dz<DzTrack & DzError>(`/track/${id}`);
}

export function getAlbum(id: number | string, lang = "en") {
  return dz<DzAlbum & DzError>(`/album/${id}`, {}, lang);
}

export async function getRelatedArtists(artistId: number, limit = 20) {
  const res = await dz<DzList<DzArtist>>(`/artist/${artistId}/related`, { limit });
  return res.data ?? [];
}

export async function getTopTracks(artistId: number, limit = 5) {
  const res = await dz<DzList<DzTrack>>(`/artist/${artistId}/top`, { limit });
  return res.data ?? [];
}

export async function getChartAlbums(limit = 12) {
  const res = await dz<DzList<DzAlbum>>("/chart/0/albums", { limit });
  return res.data ?? [];
}

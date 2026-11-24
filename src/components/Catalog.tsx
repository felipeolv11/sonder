import Link from "next/link";
import { href, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { ArtistCard, ReleaseCard, TrackRow } from "@/lib/music";
import { formatDuration } from "@/lib/text";

/** "Album", "EP" or "Single", in the reader's language. */
export function releaseKind(locale: Locale, recordType: string) {
  const t = getDictionary(locale).song;
  return recordType === "album" ? t.album : recordType === "ep" ? t.ep : recordType === "single" ? t.single : t.release;
}

/**
 * Songs as rows. "top" shows each song's cover and album (an artist's most played);
 * "album" shows track numbers, and the performer only when it differs from the album's.
 */
export function TrackList({
  rows,
  locale,
  variant,
  albumArtist,
}: {
  rows: (TrackRow & { n?: number })[];
  locale: Locale;
  variant: "top" | "album";
  albumArtist?: string;
}) {
  return (
    <ol className={`tracklist ${variant}`}>
      {rows.map((r, i) => {
        const sub = variant === "top" ? r.album : r.artist !== albumArtist ? r.artist : null;
        return (
          <li key={r.id}>
            <Link href={href(locale, `/song/${r.id}`)} className="track">
              {variant === "top" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="track-art" src={r.coverSmall} alt="" width={44} height={44} loading="lazy" />
              ) : (
                <span className="track-n">{r.n ?? i + 1}</span>
              )}
              <span className="track-main">
                <span className="track-title">{r.title}</span>
                {sub && <span className="track-sub">{sub}</span>}
              </span>
              <span className="track-time">{formatDuration(r.duration)}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** Album covers. Under each: the artist when releases come from several, otherwise year and kind. */
export function ReleaseGrid({ releases, locale, showArtist }: { releases: ReleaseCard[]; locale: Locale; showArtist?: boolean }) {
  const t = getDictionary(locale);
  return (
    <ul className="cover-grid">
      {releases.map((r, i) => (
        <li key={r.id}>
          <Link href={href(locale, `/album/${r.id}`)} className="cover-tile">
            <span className="cover-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.cover} alt={t.results.cover(r.title)} loading={i < 6 ? "eager" : "lazy"} />
            </span>
            <span className="tile-title">{r.title}</span>
            {showArtist && <span className="tile-artist">{r.artist}</span>}
            <span className={showArtist ? "tile-album" : "tile-artist"}>
              {[r.year, releaseKind(locale, r.recordType)].filter(Boolean).join(" · ")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ArtistGrid({ artists, locale }: { artists: ArtistCard[]; locale: Locale }) {
  const t = getDictionary(locale).artist;
  return (
    <ul className="artist-grid">
      {artists.map((a) => (
        <li key={a.id}>
          <Link href={href(locale, `/artist/${a.id}`)} className="artist-tile">
            <span className="artist-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.picture} alt={t.picture(a.name)} loading="lazy" />
            </span>
            <span className="tile-title">{a.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

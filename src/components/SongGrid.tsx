import Link from "next/link";
import { href, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { SongCard } from "@/lib/music";

export function SongGrid({ songs, locale }: { songs: SongCard[]; locale: Locale }) {
  const t = getDictionary(locale);
  return (
    <ul className="cover-grid">
      {songs.map((s, i) => (
        <li key={s.id}>
          <Link href={href(locale, `/song/${s.id}`)} className="cover-tile">
            <span className="cover-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.cover} alt={t.results.cover(s.album)} loading={i < 8 ? "eager" : "lazy"} />
            </span>
            <span className="tile-title">{s.title}</span>
            <span className="tile-artist">{s.artist}</span>
            <span className="tile-album">{s.album}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

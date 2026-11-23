import Link from "next/link";
import type { SongCard } from "@/lib/music";

export function SongGrid({ songs }: { songs: SongCard[] }) {
  return (
    <ul className="cover-grid">
      {songs.map((s, i) => (
        <li key={s.id}>
          <Link href={`/song/${s.id}`} className="cover-tile">
            <span className="cover-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.cover} alt={`${s.album} cover`} loading={i < 8 ? "eager" : "lazy"} />
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

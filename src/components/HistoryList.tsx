"use client";

import Link from "next/link";
import { Ambient } from "./Ambient";
import { clearHistory, useHistory } from "./history";

export function HistoryList() {
  const items = useHistory();
  if (!items) return null;

  if (items.length === 0) {
    return (
      <>
        <Ambient images={[]} mode="field" />
        <div className="state">
          <h1>Nothing explored yet</h1>
          <p>Songs you open appear here, so you can retrace a path of discoveries. They’re kept in this browser only.</p>
          <div className="state-actions">
            <Link href="/" className="button">
              Search for a song
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Ambient images={items.slice(0, 5).map((v) => v.cover)} mode="field" />
      <header className="page-head with-action">
        <div>
          <h1>History</h1>
          <p>
            {items.length} {items.length === 1 ? "song" : "songs"} explored in this browser, most recent first.
          </p>
        </div>
        <button type="button" className="button quiet" onClick={clearHistory}>
          Clear history
        </button>
      </header>
      <ul className="cover-grid">
        {items.map((v) => (
          <li key={v.id}>
            <Link href={`/song/${v.id}`} className="cover-tile">
              <span className="cover-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.cover} alt={`${v.album} cover`} loading="lazy" />
              </span>
              <span className="tile-title">{v.title}</span>
              <span className="tile-artist">{v.artist}</span>
              <span className="tile-album">{v.album}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

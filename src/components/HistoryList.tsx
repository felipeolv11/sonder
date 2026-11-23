"use client";

import Link from "next/link";
import { useDictionary, useLocale } from "@/i18n/client";
import { href } from "@/i18n/config";
import { Ambient } from "./Ambient";
import { clearHistory, useHistory } from "./history";

export function HistoryList() {
  const items = useHistory();
  const locale = useLocale();
  const t = useDictionary();
  if (!items) return null;

  if (items.length === 0) {
    return (
      <>
        <Ambient images={[]} mode="field" />
        <div className="state">
          <h1>{t.history.emptyTitle}</h1>
          <p>{t.history.emptyBody}</p>
          <div className="state-actions">
            <Link href={href(locale)} className="button">
              {t.history.searchCta}
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
          <h1>{t.history.title}</h1>
          <p>{t.history.count(items.length)}</p>
        </div>
        <button type="button" className="button quiet" onClick={clearHistory}>
          {t.history.clear}
        </button>
      </header>
      <ul className="cover-grid">
        {items.map((v) => (
          <li key={v.id}>
            <Link href={href(locale, `/song/${v.id}`)} className="cover-tile">
              <span className="cover-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.cover} alt={t.results.cover(v.album)} loading="lazy" />
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

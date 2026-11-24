"use client";

import Link from "next/link";
import { useState } from "react";
import { useDictionary, useLocale } from "@/i18n/client";
import { href } from "@/i18n/config";
import { Ambient } from "./Ambient";
import { useHistory } from "./history";
import { deleteList, removeFavorite, removeFromList, useLibrary, type SongList, type SongRef } from "./library";

/** Song tiles with a remove button under each. */
function SongTiles({ songs, onRemove, removeLabel }: { songs: SongRef[]; onRemove: (id: number) => void; removeLabel: string }) {
  const t = useDictionary();
  const locale = useLocale();
  return (
    <ul className="cover-grid">
      {songs.map((s) => (
        <li key={s.id} className="library-tile">
          <Link href={href(locale, `/song/${s.id}`)} className="cover-tile">
            <span className="cover-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.cover} alt={t.results.cover(s.album)} loading="lazy" />
            </span>
            <span className="tile-title">{s.title}</span>
            <span className="tile-artist">{s.artist}</span>
          </Link>
          <button type="button" className="tile-remove" onClick={() => onRemove(s.id)}>
            {removeLabel}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Up to four covers from a list, as one square. */
function ListArt({ list }: { list: SongList }) {
  const covers = [...new Set(list.songs.map((s) => s.cover))].slice(0, 4);
  return (
    <span className={`cover-frame list-art n${Math.min(covers.length, 4)}`}>
      {covers.map((c) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={c} src={c} alt="" loading="lazy" />
      ))}
    </span>
  );
}

export function LibraryView() {
  const lib = useLibrary();
  const history = useHistory();
  const t = useDictionary();
  const locale = useLocale();
  if (!lib) return null;

  const art = [...lib.favorites, ...lib.lists.flatMap((l) => l.songs)].map((s) => s.cover);

  return (
    <>
      <Ambient images={art.slice(0, 5)} mode="field" />
      <header className="page-head">
        <h1>{t.library.title}</h1>
        <p>{t.library.sub}</p>
      </header>

      <section className="library-section" aria-labelledby="favorites-title">
        <h2 id="favorites-title" className="library-title">
          {t.library.favorites} {lib.favorites.length > 0 && <span className="library-count">{lib.favorites.length}</span>}
        </h2>
        {lib.favorites.length > 0 ? (
          <SongTiles songs={lib.favorites} onRemove={removeFavorite} removeLabel={t.library.removeFavorite} />
        ) : (
          <p className="library-empty">{t.library.noFavorites}</p>
        )}
      </section>

      <section className="library-section" aria-labelledby="lists-title">
        <h2 id="lists-title" className="library-title">
          {t.library.lists} {lib.lists.length > 0 && <span className="library-count">{lib.lists.length}</span>}
        </h2>
        {lib.lists.length > 0 ? (
          <ul className="cover-grid">
            {lib.lists.map((l) => (
              <li key={l.id}>
                <Link href={href(locale, `/library/${l.id}`)} className="cover-tile">
                  <ListArt list={l} />
                  <span className="tile-title">{l.name}</span>
                  <span className="tile-artist">{t.library.songCount(l.songs.length)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="library-empty">{t.library.noLists}</p>
        )}
      </section>

      <section className="library-section" aria-labelledby="recent-library-title">
        <div className="library-head">
          <h2 id="recent-library-title" className="library-title">
            {t.library.recent}
          </h2>
          {history && history.length > 0 && <Link href={href(locale, "/history")}>{t.home.seeAll}</Link>}
        </div>
        {history && history.length > 0 ? (
          <ul className="recent-row">
            {history.slice(0, 6).map((v) => (
              <li key={v.id}>
                <Link href={href(locale, `/song/${v.id}`)} className="recent-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.cover} alt="" width={56} height={56} loading="lazy" />
                  <span>
                    <span className="recent-title">{v.title}</span>
                    <span className="recent-artist">{v.artist}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="library-empty">{t.history.emptyBody}</p>
        )}
      </section>
    </>
  );
}

export function ListView({ id }: { id: string }) {
  const lib = useLibrary();
  const t = useDictionary();
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);
  if (!lib) return null;

  const list = lib.lists.find((l) => l.id === id);
  if (!list) {
    return (
      <>
        <Ambient images={[]} mode="field" />
        <div className="state">
          <h1>{deleted ? t.library.deletedTitle : t.library.missingTitle}</h1>
          <p>{deleted ? t.library.deletedBody : t.library.missingBody}</p>
          <div className="state-actions">
            <Link href={href(locale, "/library")} className="button">
              {t.library.back}
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Ambient images={list.songs.slice(0, 5).map((s) => s.cover)} mode="field" />
      <header className="page-head with-action">
        <div>
          <Link href={href(locale, "/library")} className="page-back">
            {t.library.title}
          </Link>
          <h1>{list.name}</h1>
          <p>{t.library.songCount(list.songs.length)}</p>
        </div>
        {confirming ? (
          <div className="confirm">
            <span>{t.library.confirmDelete}</span>
            <button
              type="button"
              className="button danger"
              onClick={() => {
                setDeleted(true);
                deleteList(list.id);
              }}
            >
              {t.library.deleteList}
            </button>
            <button type="button" className="button quiet" onClick={() => setConfirming(false)}>
              {t.library.cancel}
            </button>
          </div>
        ) : (
          <button type="button" className="button quiet" onClick={() => setConfirming(true)}>
            {t.library.deleteList}
          </button>
        )}
      </header>
      {list.songs.length > 0 ? (
        <SongTiles songs={list.songs} onRemove={(songId) => removeFromList(list.id, songId)} removeLabel={t.library.removeFromList} />
      ) : (
        <p className="library-empty">{t.library.emptyList}</p>
      )}
    </>
  );
}

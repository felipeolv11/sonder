"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useDictionary } from "@/i18n/client";
import { createList, isFavorite, toggleFavorite, toggleInList, useLibrary, type SongRef } from "./library";

/** Favourite and add-to-list buttons under a song's title. */
export function SongActions({ song }: { song: SongRef }) {
  const t = useDictionary().library;
  const lib = useLibrary();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close the list menu on a click outside it or on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Until the browser's storage is read, show the buttons in their resting state.
  const fav = lib ? isFavorite(lib, song.id) : false;
  const lists = lib?.lists ?? [];
  const inLists = lists.filter((l) => l.songs.some((s) => s.id === song.id)).length;

  return (
    <div className="song-actions" ref={wrap}>
      <button type="button" className="button action" aria-pressed={fav} onClick={() => toggleFavorite(song)}>
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 13.6s-5.2-3.1-5.2-7a2.9 2.9 0 0 1 5.2-1.8 2.9 2.9 0 0 1 5.2 1.8c0 3.9-5.2 7-5.2 7Z"
            fill={fav ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
        {fav ? t.favorited : t.favorite}
      </button>

      <div className="list-picker">
        <button
          type="button"
          className="button action"
          aria-expanded={open}
          aria-controls={menuId}
          aria-pressed={inLists > 0}
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.5 4.5h8M2.5 8h8M2.5 11.5h5M12.5 9.5v5M10 12h5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {inLists > 0 ? t.inLists(inLists) : t.addToList}
        </button>

        {open && (
          <div id={menuId} className="list-menu" role="group" aria-label={t.addToList}>
            {lists.length > 0 && (
              <ul>
                {lists.map((l) => {
                  const checked = l.songs.some((s) => s.id === song.id);
                  return (
                    <li key={l.id}>
                      <label className="list-option">
                        <input type="checkbox" checked={checked} onChange={() => toggleInList(l.id, song)} />
                        <span className="list-option-name">{l.name}</span>
                        <span className="list-option-count">{l.songs.length}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <form
              className="list-new"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                createList(name, song);
                setName("");
              }}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.newListPlaceholder}
                aria-label={t.newListPlaceholder}
                maxLength={60}
                autoFocus={lists.length === 0}
              />
              <button type="submit" className="button" disabled={!name.trim()}>
                {t.create}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

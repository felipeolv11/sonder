"use client";

import { useSyncExternalStore } from "react";

/*
 * Favourite songs and named lists, kept in this browser's localStorage like the history.
 * There are no accounts: nothing here leaves the browser.
 */

export type SongRef = { id: number; title: string; artist: string; album: string; cover: string };
export type SongList = { id: string; name: string; songs: SongRef[]; created: number };
export type Library = { favorites: SongRef[]; lists: SongList[] };

const KEY = "sonder.library.v1";
const EVENT = "sonder-library";
const EMPTY: Library = { favorites: [], lists: [] };

function parse(raw: string | null): Library {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return {
      favorites: Array.isArray(value?.favorites) ? value.favorites : [],
      lists: Array.isArray(value?.lists) ? value.lists : [],
    };
  } catch {
    return EMPTY;
  }
}

let cache: { raw: string | null; value: Library } = { raw: null, value: EMPTY };
function snapshot(): Library {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (raw !== cache.raw) cache = { raw, value: parse(raw) };
  return cache.value;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** The library in this browser, or null while rendering on the server. */
export function useLibrary(): Library | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

function update(change: (lib: Library) => Library) {
  try {
    localStorage.setItem(KEY, JSON.stringify(change(snapshot())));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage blocked or full: the library is a convenience */
  }
}

const without = (songs: SongRef[], id: number) => songs.filter((s) => s.id !== id);

export function isFavorite(lib: Library, id: number) {
  return lib.favorites.some((s) => s.id === id);
}

export function toggleFavorite(song: SongRef) {
  update((lib) => ({
    ...lib,
    favorites: isFavorite(lib, song.id) ? without(lib.favorites, song.id) : [song, ...lib.favorites],
  }));
}

export function removeFavorite(id: number) {
  update((lib) => ({ ...lib, favorites: without(lib.favorites, id) }));
}

/** Creates a list, optionally starting with a song. Returns its id. */
export function createList(name: string, song?: SongRef): string {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  update((lib) => ({ ...lib, lists: [{ id, name: name.trim(), songs: song ? [song] : [], created: Date.now() }, ...lib.lists] }));
  return id;
}

export function toggleInList(listId: string, song: SongRef) {
  update((lib) => ({
    ...lib,
    lists: lib.lists.map((l) =>
      l.id !== listId ? l : { ...l, songs: l.songs.some((s) => s.id === song.id) ? without(l.songs, song.id) : [...l.songs, song] },
    ),
  }));
}

export function removeFromList(listId: string, id: number) {
  update((lib) => ({ ...lib, lists: lib.lists.map((l) => (l.id === listId ? { ...l, songs: without(l.songs, id) } : l)) }));
}

export function deleteList(listId: string) {
  update((lib) => ({ ...lib, lists: lib.lists.filter((l) => l.id !== listId) }));
}

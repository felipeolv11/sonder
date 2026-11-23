"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { useDictionary, useLocale } from "@/i18n/client";
import { href } from "@/i18n/config";

export type Visit = { id: number; title: string; artist: string; album: string; cover: string; at: number };

const KEY = "sonder.history.v1";
const EVENT = "sonder-history";

function read(): Visit[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Visit[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let cache: { raw: string | null; value: Visit[] } = { raw: null, value: [] };
function snapshot(): Visit[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (raw !== cache.raw) cache = { raw, value: read() };
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

/** Visits in this browser, or null while rendering on the server. */
export function useHistory(): Visit[] | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function RecordVisit(visit: Omit<Visit, "at">) {
  const { id, title, artist, album, cover } = visit;
  useEffect(() => {
    try {
      const next = [{ id, title, artist, album, cover, at: Date.now() }, ...read().filter((v) => v.id !== id)].slice(0, 60);
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* storage blocked: history is a convenience */
    }
  }, [id, title, artist, album, cover]);
  return null;
}

export function RecentlyExplored() {
  const items = useHistory();
  const locale = useLocale();
  const t = useDictionary();
  if (!items || items.length === 0) return null;

  return (
    <section className="recent" aria-labelledby="recent-title">
      <div className="recent-head">
        <h2 id="recent-title">{t.home.recentTitle}</h2>
        <Link href={href(locale, "/history")}>{t.home.seeAll}</Link>
      </div>
      <ul className="recent-row">
        {items.slice(0, 6).map((v) => (
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
    </section>
  );
}

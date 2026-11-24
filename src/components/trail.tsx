"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { useDictionary, useLocale } from "@/i18n/client";
import { href } from "@/i18n/config";

/*
 * The discovery path: the songs a reader went through to reach the current one, by following
 * links inside Sonder (recommendations, artist and album pages). It lives in sessionStorage, so
 * each browser tab has its own path. A song reached any other way (search, home, history)
 * starts a new path; going back to a song already on it cuts the path there.
 */

export type Step = { id: number; title: string; artist: string; cover: string };

const KEY = "sonder.trail.v1";
const CONTINUE = "sonder.trail.continue";
const EVENT = "sonder-trail";
const MAX = 30;

function read(): Step[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let cache: { raw: string | null; value: Step[] } = { raw: null, value: [] };
function snapshot(): Step[] {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (raw !== cache.raw) cache = { raw, value: read() };
  return cache.value;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

function setContinue(on: boolean) {
  try {
    if (on) sessionStorage.setItem(CONTINUE, "1");
    else sessionStorage.removeItem(CONTINUE);
  } catch {
    /* ignore */
  }
}

/** Called when the reader jumps elsewhere without a link (search suggestions, typed searches). */
export function breakTrail() {
  setContinue(false);
}

/**
 * Watches link clicks across the app. A click inside an element marked `data-trail` continues
 * the path; any other link (toolbar, search results, history) starts a new one.
 */
export function TrailListener() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const link = target?.closest("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      setContinue(!!link.closest("[data-trail]"));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}

/** Adds the current song to the path. */
export function RecordTrail(step: Step) {
  const { id, title, artist, cover } = step;
  useEffect(() => {
    try {
      const trail = read();
      const continuing = sessionStorage.getItem(CONTINUE) === "1";
      const at = trail.findIndex((s) => s.id === id);
      let next: Step[];
      if (at >= 0) next = trail.slice(0, at + 1); // back to a song already on the path
      else if (continuing) next = [...trail, { id, title, artist, cover }].slice(-MAX);
      else next = [{ id, title, artist, cover }];
      sessionStorage.setItem(KEY, JSON.stringify(next));
      sessionStorage.removeItem(CONTINUE);
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* storage blocked: the path is a convenience */
    }
  }, [id, title, artist, cover]);
  return null;
}

const VISIBLE = 5;

/** The path that led to the current song, as a row of links. Hidden until there are two steps. */
export function DiscoveryTrail({ current }: { current: number }) {
  const trail = useSyncExternalStore(subscribe, snapshot, () => null);
  const t = useDictionary().trail;
  const locale = useLocale();
  if (!trail || trail.length < 2 || trail[trail.length - 1].id !== current) return null;

  const hidden = Math.max(0, trail.length - VISIBLE);
  const steps = trail.slice(hidden);

  return (
    <nav className="trail" aria-label={t.label}>
      <span className="trail-label">{t.label}</span>
      <ol>
        {hidden > 0 && (
          <li className="trail-more">
            <Link href={href(locale, `/song/${trail[0].id}`)} title={trail[0].title}>
              {t.earlier(hidden)}
            </Link>
          </li>
        )}
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const body = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.cover} alt="" width={24} height={24} />
              <span>
                <span className="trail-title">{s.title}</span>
                <span className="trail-artist">{s.artist}</span>
              </span>
            </>
          );
          return (
            <li key={s.id}>
              {last ? (
                <span className="trail-step" aria-current="page">
                  {body}
                </span>
              ) : (
                <Link className="trail-step" href={href(locale, `/song/${s.id}`)}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

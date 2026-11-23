"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { SongCard } from "@/lib/music";

type Props = { variant: "hero" | "compact"; autoFocus?: boolean };

export function SearchField({ variant, autoFocus }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = pathname === "/search" ? (params.get("q") ?? "") : "";

  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<SongCard[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const isMac = useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => true,
  );

  // Keep the field in sync when the URL query changes (back/forward).
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setQ(initial);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { results: SongCard[] };
        setItems(data.results);
        setActive(-1);
      } catch {
        if (!ctrl.signal.aborted) setItems([]);
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  function go(item?: SongCard) {
    setOpen(false);
    inputRef.current?.blur();
    if (item) router.push(`/song/${item.id}`);
    else if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const visible = open && items.length > 0;
    if (e.key === "ArrowDown" && visible) {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp" && visible) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(visible && active >= 0 ? items[active] : undefined);
    } else if (e.key === "Escape") {
      if (open) setOpen(false);
      else inputRef.current?.blur();
    }
  }

  const showList = open && q.trim().length >= 2 && (items.length > 0 || !busy);
  const shown = items.slice(0, variant === "hero" ? 6 : 7);

  return (
    <div className={`search search-${variant}`} data-open={showList || undefined}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={q}
          autoFocus={autoFocus}
          placeholder="Search a song, artist or album..."
          aria-label="Search a song, artist or album"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (e.target.value.trim().length >= 2) setBusy(true);
            else {
              setItems([]);
              setBusy(false);
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 140)}
          onKeyDown={onKeyDown}
        />
        {busy ? (
          <span className="search-spinner" aria-hidden="true" />
        ) : (
          <kbd className="search-kbd" aria-hidden="true">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        )}
      </form>

      {showList && (
        <ul id={listId} role="listbox" className="suggestions" aria-label="Suggested songs">
          {shown.length === 0 ? (
            <li className="suggestion-empty">No songs match “{q.trim()}”. Try the artist’s name with the title.</li>
          ) : (
            shown.map((item, i) => (
              <li
                key={item.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className="suggestion"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(item)}
                onMouseEnter={() => setActive(i)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.coverSmall} alt="" width={40} height={40} loading="lazy" />
                <span className="suggestion-text">
                  <span className="suggestion-title">{item.title}</span>
                  <span className="suggestion-sub">
                    {item.artist}
                    <span className="sep" aria-hidden="true" />
                    {item.album}
                  </span>
                </span>
              </li>
            ))
          )}
          {shown.length > 0 && (
            <li className="suggestion-all" onMouseDown={(e) => e.preventDefault()} onClick={() => go()}>
              See all results for “{q.trim()}”
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function noopSubscribe() {
  return () => {};
}

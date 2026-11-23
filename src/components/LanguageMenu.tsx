"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useDictionary, useLocale } from "@/i18n/client";
import { LOCALE_COOKIE, localeNames, localeTags, locales, switchLocalePath, type Locale } from "@/i18n/config";

export function LanguageMenu() {
  const locale = useLocale();
  const t = useDictionary();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function remember(next: Locale) {
    saveLocale(next);
    setOpen(false);
  }

  return (
    <div className="lang" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="lang-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${t.nav.language}: ${localeNames[locale]}`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <ellipse cx="8" cy="8" rx="2.75" ry="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 6h12M2 10h12" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        {locale.toUpperCase()}
      </button>
      {open && (
        <ul id={menuId} role="menu" className="lang-menu" aria-label={t.nav.language}>
          {locales.map((l) => (
            <li key={l} role="none">
              {/* A full page load: every part of the page, including streamed sections, switches language. */}
              <a
                role="menuitemradio"
                aria-checked={l === locale}
                hrefLang={localeTags[l]}
                lang={localeTags[l]}
                href={`${switchLocalePath(pathname, l)}${query ? `?${query}` : ""}`}
                onClick={() => remember(l)}
              >
                <span>{localeNames[l]}</span>
                {l === locale && (
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2.5 6.5l2.25 2.25L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Remembered for a year so bare links (/, /song/123) open in the chosen language. */
function saveLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

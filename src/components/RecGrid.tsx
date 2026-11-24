"use client";

import Link from "next/link";
import { useState } from "react";
import { useDictionary, useLocale } from "@/i18n/client";
import { href } from "@/i18n/config";
import type { Recommendation, RecFilter } from "@/lib/music";

type Item = Recommendation & { reason: string };

const FILTERS: RecFilter[] = ["sameEra", "lesserKnown", "otherGenre"];
/** How many show with no filter; each filter picks from the whole, larger pool. */
const RECS_SHOWN = 10;

/** Recommendation cards with filter chips: the ten best by default, or every match for a filter. */
export function RecGrid({ recs }: { recs: Item[] }) {
  const t = useDictionary();
  const locale = useLocale();
  const [filter, setFilter] = useState<RecFilter | null>(null);

  const counts = Object.fromEntries(FILTERS.map((f) => [f, recs.filter((r) => r.filters.includes(f)).length])) as Record<RecFilter, number>;
  const shown = filter ? recs.filter((r) => r.filters.includes(filter)) : recs.slice(0, RECS_SHOWN);
  const available = FILTERS.filter((f) => counts[f] > 0);

  return (
    <>
      {available.length > 0 && (
        <div className="rec-filters" role="group" aria-label={t.recs.filterLabel}>
          <button type="button" className="chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
            {t.recs.filters.all}
          </button>
          {available.map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)} title={t.recs.filterHelp[f]}>
              {t.recs.filters[f]} <span className="chip-count">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}
      {filter && <p className="rec-filter-note">{t.recs.filterHelp[filter]}</p>}
      <ol className="rec-grid" aria-live="polite">
        {shown.map((r) => (
          <li key={r.id}>
            <Link href={href(locale, `/song/${r.id}`)} className="rec">
              <span className="cover-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.cover} alt={t.results.cover(r.album)} loading="lazy" />
              </span>
              <span className="tile-title">{r.title}</span>
              <span className="tile-artist">{r.artist}</span>
              <span className="tile-album">{r.album}</span>
            </Link>
            <p className="rec-reason">{r.reason}</p>
            {r.signals.length > 0 && (
              <ul className="signals" aria-label={t.recs.details}>
                {r.signals.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

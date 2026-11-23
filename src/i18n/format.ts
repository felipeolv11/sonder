import type { Fact, ReasonPart } from "@/lib/music";
import { localeTags, type Locale } from "./config";
import { getDictionary } from "./dictionaries";

export function formatList(locale: Locale, items: string[]) {
  return new Intl.ListFormat(localeTags[locale], { style: "long", type: "conjunction" }).format(items);
}

/** Formats a Wikidata date at its own precision: day, month or just the year. */
export function formatDate(locale: Locale, iso: string, precision: number) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (precision < 10 || Number.isNaN(d.getTime())) return iso.slice(0, 4);
  const opts: Intl.DateTimeFormatOptions =
    precision >= 11 ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" } : { month: "long", year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat(localeTags[locale], opts).format(d);
}

export function formatFact(locale: Locale, fact: Fact): { label: string; value: string } {
  const t = getDictionary(locale).facts;
  const label = t[fact.key];
  if (fact.date) return { label, value: formatDate(locale, fact.date.iso, fact.date.precision) };
  if (fact.track) return { label, value: t.trackOf(fact.track.n, fact.track.total, fact.track.album) };
  return { label, value: formatList(locale, fact.values ?? []) };
}

/** Genre names read mid-sentence: "Rock" -> "rock", but acronyms like "MPB" or "R&B" keep their case. */
const genreCase = (g: string) => (g === g.toUpperCase() ? g : g.toLowerCase());
/** Avoids a doubled full stop after names like "Universal Music Ltda." */
const noTrailingDot = (s: string) => s.replace(/\.+$/, "");

export function formatReasons(locale: Locale, parts: ReasonPart[]) {
  const r = getDictionary(locale).recs;
  return parts
    .map((p) => {
      switch (p.t) {
        case "related":
          return p.top ? r.relatedTop(p.seed) : r.related(p.seed);
        case "sharesTag":
          return r.sharesTag(genreCase(p.tag), p.title);
        case "leans":
          return r.leans(genreCase(p.genre));
        case "tempo":
          return r.tempo(p.bpm, p.seed);
        case "era":
          return r.era(p.album, p.year, p.diff, p.title);
        case "label":
          return r.label(noTrailingDot(p.label));
      }
    })
    .join(" ");
}

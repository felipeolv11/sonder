import Link from "next/link";
import { href, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatDate } from "@/i18n/format";
import { getArtistTimeline, type TimelineEntry } from "@/lib/music";
import { releaseKind } from "./Catalog";

/** The artist's releases and milestones year by year, as a horizontal strip. Hidden when too thin. */
export async function ArtistTimeline({ id, locale }: { id: number; locale: Locale }) {
  const t = getDictionary(locale);
  let entries: TimelineEntry[];
  try {
    entries = await getArtistTimeline(id, locale);
  } catch (err) {
    console.error("[sonder] timeline failed for artist", id, err);
    return null;
  }
  if (entries.filter((e) => e.t === "release").length < 2) return null;

  const years = new Map<number, TimelineEntry[]>();
  for (const e of entries) years.set(e.year, [...(years.get(e.year) ?? []), e]);

  return (
    <section className="timeline-section" aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="section-title">
        {t.timeline.title}
      </h2>
      <p className="recs-intro">{t.timeline.note}</p>
      <ol className="timeline">
        {[...years].map(([year, items]) => (
          <li key={year} className="tl-year">
            <span className="tl-label">{year}</span>
            <ul>
              {items.map((e) =>
                e.t === "event" ? (
                  <li key={e.kind} className="tl-event" data-kind={e.kind}>
                    <strong>{t.timeline.events[e.kind]}</strong>
                    {e.date.precision >= 10 && <span>{formatDate(locale, e.date.iso, e.date.precision)}</span>}
                    <span className="tl-source">{t.song.sourceTitle("Wikidata")}</span>
                  </li>
                ) : (
                  <li key={e.release.id}>
                    <Link href={href(locale, `/album/${e.release.id}`)} className="tl-release" title={t.song.sourceTitle(e.source)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.release.coverSmall} alt="" width={128} height={128} loading="lazy" />
                      <span className="tl-title">{e.release.title}</span>
                      <span className="tl-kind">{releaseKind(locale, e.release.recordType)}</span>
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

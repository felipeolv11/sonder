import Link from "next/link";
import { href, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatDate } from "@/i18n/format";
import { getArtistTimeline, type TimelineEntry } from "@/lib/music";
import { releaseKind } from "./Catalog";
import { TimelineScroller } from "./TimelineScroller";

/**
 * The artist's releases and milestones in order, as a shelf of covers under a year rule.
 * It reuses the site's cover tiles; the rule carries the chronology: a year is written only
 * when it changes, and a dashed stretch marks years with nothing released.
 */
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

  const first = entries[0].year;
  const last = entries[entries.length - 1].year;

  return (
    <section className="timeline-section" aria-labelledby="timeline-title">
      <TimelineScroller
        header={
          <div className="tl-intro">
            <h2 id="timeline-title" className="section-title">
              {t.timeline.title}
            </h2>
            <p className="recs-intro">{t.timeline.note}</p>
          </div>
        }
        range={`${first} – ${last}`}
        label={t.timeline.title}
      >
        <ol className="tl-track">
          {entries.map((e, i) => {
            const newYear = e.year !== entries[i - 1]?.year;
            const next = entries[i + 1];
            const gapAfter = !!next && next.year - e.year > 1;
            const key = e.t === "event" ? `${e.kind}-${e.year}` : e.release.id;
            return (
              <li key={key} className={`tl-item${e.t === "event" ? " is-event" : ""}${gapAfter ? " gap-after" : ""}`}>
                <span className="tl-year" aria-hidden={!newYear || undefined}>
                  {newYear ? e.year : ""}
                </span>
                <span className="tl-mark" aria-hidden="true" />
                {e.t === "event" ? (
                  <div className="tl-card">
                    {/* The year is already on the rule: the square names the milestone instead. */}
                    <span className="cover-frame tl-event-frame">{t.timeline.events[e.kind]}</span>
                    {e.date.precision >= 10 && <span className="tile-title">{formatDate(locale, e.date.iso, e.date.precision)}</span>}
                    <span className="tile-album">Wikidata</span>
                  </div>
                ) : (
                  <Link href={href(locale, `/album/${e.release.id}`)} className="tl-card" title={t.song.sourceTitle(e.source)}>
                    <span className="cover-frame">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.release.coverSmall} alt={t.results.cover(e.release.title)} width={250} height={250} loading="lazy" />
                    </span>
                    <span className="tile-title">{e.release.title}</span>
                    <span className="tile-album">{releaseKind(locale, e.release.recordType)}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </TimelineScroller>
    </section>
  );
}

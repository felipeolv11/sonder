import Link from "next/link";
import { href, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatReasons } from "@/i18n/format";
import { getRecommendations, type Recommendation } from "@/lib/music";

export async function Recommendations({ id, locale }: { id: number; locale: Locale }) {
  const t = getDictionary(locale);
  let recs: Recommendation[];
  try {
    recs = await getRecommendations(id, locale);
  } catch {
    return (
      <div className="inline-state">
        <p>{t.recs.error}</p>
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <div className="inline-state">
        <p>{t.recs.empty}</p>
      </div>
    );
  }

  return (
    <>
      <p className="recs-intro">{t.recs.intro}</p>
      <ol className="rec-grid">
        {recs.map((r) => (
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
            <p className="rec-reason">{formatReasons(locale, r.reasons)}</p>
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

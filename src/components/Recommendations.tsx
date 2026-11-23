import Link from "next/link";
import { getRecommendations, type Recommendation } from "@/lib/music";

export async function Recommendations({ id }: { id: number }) {
  let recs: Recommendation[];
  try {
    recs = await getRecommendations(id);
  } catch {
    return (
      <div className="inline-state">
        <p>Recommendations couldn’t be loaded because Deezer didn’t respond. Reload the page to try again.</p>
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <div className="inline-state">
        <p>There isn’t enough listening data around this artist to suggest songs yet. Try another song by them, or search for a similar artist.</p>
      </div>
    );
  }

  return (
    <>
      <p className="recs-intro">
        Drawn from the artists Deezer relates most closely to this one, then ranked by shared genre, era and tempo.
      </p>
      <ol className="rec-grid">
        {recs.map((r) => (
          <li key={r.id}>
            <Link href={`/song/${r.id}`} className="rec">
              <span className="cover-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.cover} alt={`${r.album} cover`} loading="lazy" />
              </span>
              <span className="tile-title">{r.title}</span>
              <span className="tile-artist">{r.artist}</span>
              <span className="tile-album">{r.album}</span>
            </Link>
            <p className="rec-reason">{r.reason}</p>
            {r.signals.length > 0 && (
              <ul className="signals" aria-label="Details">
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

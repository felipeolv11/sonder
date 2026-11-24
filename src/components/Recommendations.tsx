import { type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatReasons } from "@/i18n/format";
import { getRecommendations, type Recommendation } from "@/lib/music";
import { RecGrid } from "./RecGrid";

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

  // Reasons are phrased here, on the server, so the client only filters.
  const items = recs.map((r) => ({ ...r, filters: r.filters ?? [], reason: formatReasons(locale, r.reasons) }));
  return (
    <>
      <p className="recs-intro">{t.recs.intro}</p>
      <RecGrid recs={items} />
    </>
  );
}

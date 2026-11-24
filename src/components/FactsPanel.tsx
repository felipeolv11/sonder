import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatFact } from "@/i18n/format";
import type { Fact } from "@/lib/music";

/** The "On record" panel beside a story: credits and release details, each with its source. */
export function FactsPanel({
  facts,
  locale,
  sources,
  links,
}: {
  facts: Fact[];
  locale: Locale;
  /** One line saying where the details come from. */
  sources: string;
  links: { label: string; url: string }[];
}) {
  const t = getDictionary(locale).song;
  return (
    <aside className="facts glass" aria-labelledby="facts-title">
      <h2 id="facts-title">{t.onRecord}</h2>
      {facts.length > 0 ? (
        <dl>
          {facts.map((f) => {
            const { label, value } = formatFact(locale, f);
            return (
              <div key={f.key} className="fact">
                <dt>{label}</dt>
                <dd title={t.sourceTitle(f.source)}>{value}</dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="facts-empty">{t.noCredits}</p>
      )}
      <div className="facts-sources">
        <p>{sources}</p>
        <ul>
          {links.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

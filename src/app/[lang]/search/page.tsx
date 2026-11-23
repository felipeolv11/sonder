import type { Metadata } from "next";
import { Suspense } from "react";
import { Ambient } from "@/components/Ambient";
import { CoverGridSkeleton } from "@/components/Skeletons";
import { SongGrid } from "@/components/SongGrid";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { searchSongs } from "@/lib/music";

type Props = PageProps<"/[lang]/search">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return { title: hasLocale(lang) ? getDictionary(lang).meta.search : "Search" };
}

export default async function SearchPage({ searchParams }: Props) {
  const locale = await getLocale();
  return (
    <div className="page">
      <Suspense fallback={<SearchFallback />}>
        <Results searchParams={searchParams} locale={locale} />
      </Suspense>
    </div>
  );
}

function SearchFallback() {
  return (
    <>
      <Ambient images={[]} mode="field" />
      <div className="page-head">
        <div className="skeleton skeleton-line" style={{ width: 280, height: 34 }} />
      </div>
      <CoverGridSkeleton count={12} />
    </>
  );
}

async function Results({ searchParams, locale }: { searchParams: Props["searchParams"]; locale: Locale }) {
  const t = getDictionary(locale).results;
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim();

  const state = (title: string, body: string) => (
    <>
      <Ambient images={[]} mode="field" />
      <div className="state">
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </>
  );

  if (!q) return state(t.emptyTitle, t.emptyBody);

  let results;
  try {
    results = await searchSongs(q.toLowerCase());
  } catch {
    return state(t.errorTitle, t.errorBody);
  }
  if (results.length === 0) return state(t.noneTitle(q), t.noneBody);

  return (
    <>
      <Ambient images={results.slice(0, 5).map((r) => r.cover)} mode="field" />
      <header className="page-head">
        <h1>{t.title(q)}</h1>
        <p>{t.sub}</p>
      </header>
      <SongGrid songs={results} locale={locale} />
    </>
  );
}

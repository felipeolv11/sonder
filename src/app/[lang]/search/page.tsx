import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Ambient } from "@/components/Ambient";
import { ReleaseGrid } from "@/components/Catalog";
import { CoverGridSkeleton } from "@/components/Skeletons";
import { SongGrid } from "@/components/SongGrid";
import { hasLocale, href, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { searchCatalog, searchSongs } from "@/lib/music";

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
  // Artists and albums are extras on top of the songs: if that lookup fails, songs still show.
  const catalog = searchCatalog(q.toLowerCase()).catch(() => ({ artist: null, albums: [] }));
  try {
    results = await searchSongs(q.toLowerCase());
  } catch (err) {
    console.error("[sonder] search failed for", q, err);
    return state(t.errorTitle, t.errorBody);
  }
  const { artist, albums } = await catalog;
  if (results.length === 0 && !artist && albums.length === 0) return state(t.noneTitle(q), t.noneBody);

  // When the query names an artist, their albums are as likely a target as any one song, so they come first.
  const albumResults = albums.length > 0 && (
    <section className="results-group" aria-labelledby="albums-title">
      <h2 id="albums-title" className="results-title">
        {t.albums}
      </h2>
      <ReleaseGrid releases={albums.slice(0, 5)} locale={locale} showArtist={!artist} />
    </section>
  );

  return (
    <>
      <Ambient images={results.slice(0, 5).map((r) => r.cover)} mode="field" />
      <header className="page-head">
        <h1>{t.title(q)}</h1>
        <p>{t.sub}</p>
      </header>
      {artist && (
        <Link href={href(locale, `/artist/${artist.id}`)} className="artist-result glass">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={artist.picture} alt="" width={64} height={64} />
          <span>
            <span className="artist-result-kind">{t.artist}</span>
            <span className="artist-result-name">{artist.name}</span>
            <span className="artist-result-cta">{t.artistOpen}</span>
          </span>
        </Link>
      )}
      {artist && albumResults}
      {results.length > 0 && (
        <section className="results-group" aria-labelledby={artist || albums.length > 0 ? "songs-title" : undefined}>
          {(artist || albums.length > 0) && (
            <h2 id="songs-title" className="results-title">
              {t.songs}
            </h2>
          )}
          <SongGrid songs={results} locale={locale} />
        </section>
      )}
      {!artist && albumResults}
    </>
  );
}

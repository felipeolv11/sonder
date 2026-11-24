import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Ambient } from "@/components/Ambient";
import { ArtistBio } from "@/components/ArticleView";
import { ArtistGrid, ReleaseGrid, TrackList } from "@/components/Catalog";
import { HeroSkeleton, StorySkeleton } from "@/components/Skeletons";
import { hasLocale, localeTags, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getArtist } from "@/lib/music";

type Props = PageProps<"/[lang]/artist/[id]">;

function parseId(id: string) {
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id: rawId } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang).meta;
  const id = parseId(rawId);
  const artist = id ? await getArtist(id).catch(() => null) : null;
  if (!artist) return { title: t.artist };
  return {
    title: artist.name,
    description: t.artistDescription(artist.name),
    alternates: { languages: Object.fromEntries(locales.map((l) => [localeTags[l], `/${l}/artist/${artist.id}`])) },
  };
}

export default async function ArtistPage({ params }: Props) {
  const locale = await getLocale();
  return (
    <div className="page song-page">
      <Suspense
        fallback={
          <>
            <Ambient images={[]} mode="album" />
            <HeroSkeleton label={getDictionary(locale).artist.loading} round />
          </>
        }
      >
        <ArtistView params={params} locale={locale} />
      </Suspense>
    </div>
  );
}

async function ArtistView({ params, locale }: { params: Props["params"]; locale: Locale }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const artist = await getArtist(id);
  if (!artist) notFound();
  const t = getDictionary(locale);
  const compact = new Intl.NumberFormat(localeTags[locale], { notation: "compact", maximumFractionDigits: 1 });
  const years = artist.albums.map((a) => a.year).filter((y): y is number => !!y);

  return (
    <>
      <Ambient images={[artist.picture, ...artist.albums.slice(0, 4).map((a) => a.cover)].filter(Boolean)} mode="album" />

      <section className="song-hero" aria-labelledby="artist-title">
        <div className="hero-art round">
          {artist.picture && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artist.picture} alt={t.artist.picture(artist.name)} width={1000} height={1000} />
          )}
        </div>
        <div className="hero-meta">
          <p className="hero-eyebrow">{t.artist.label}</p>
          <h1 id="artist-title" className={artist.name.length > 24 ? "long" : undefined}>
            {artist.name}
          </h1>
          <dl className="hero-details">
            {!!artist.fans && (
              <div>
                <dt>{t.artist.fans}</dt>
                <dd>{compact.format(artist.fans)}</dd>
              </div>
            )}
            {artist.albums.length > 0 && (
              <div>
                <dt>{t.artist.releases}</dt>
                <dd>{artist.albums.length}</dd>
              </div>
            )}
            {years.length > 0 && (
              <div>
                <dt>{t.song.year}</dt>
                <dd>{Math.min(...years) === Math.max(...years) ? years[0] : `${Math.min(...years)}–${Math.max(...years)}`}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      <div className="story-layout">
        <article className="story" aria-labelledby="story-title">
          <h2 id="story-title" className="section-title">
            {t.artist.storyTitle(artist.name)}
          </h2>
          <Suspense fallback={<StorySkeleton label={t.artist.storyLoading} />}>
            <ArtistBio id={artist.id} locale={locale} />
          </Suspense>
        </article>

        <aside className="facts glass side-list" aria-labelledby="top-title">
          <h2 id="top-title">{t.artist.topSongs}</h2>
          <p className="side-note">{t.artist.topSongsNote}</p>
          {artist.topTracks.length > 0 ? (
            <TrackList rows={artist.topTracks} locale={locale} variant="top" />
          ) : (
            <p className="facts-empty">{t.artist.noTopSongs}</p>
          )}
          <div className="facts-sources">
            <p>{t.artist.sources}</p>
            <ul>
              <li>
                <a href={artist.deezerUrl} target="_blank" rel="noreferrer">
                  {t.song.viewDeezer}
                </a>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {artist.albums.length > 0 && (
        <section className="shelf" aria-labelledby="albums-title">
          <h2 id="albums-title" className="section-title">
            {t.artist.albums}
          </h2>
          <ReleaseGrid releases={artist.albums} locale={locale} />
        </section>
      )}

      {artist.singles.length > 0 && (
        <section className="shelf" aria-labelledby="singles-title">
          <h2 id="singles-title" className="section-title">
            {t.artist.singles}
          </h2>
          <ReleaseGrid releases={artist.singles.slice(0, 12)} locale={locale} />
        </section>
      )}

      {artist.related.length > 0 && (
        <section className="recs" aria-labelledby="related-title">
          <h2 id="related-title" className="section-title">
            {t.artist.related(artist.name)}
          </h2>
          <p className="recs-intro">{t.artist.relatedNote}</p>
          <ArtistGrid artists={artist.related} locale={locale} />
        </section>
      )}
    </>
  );
}

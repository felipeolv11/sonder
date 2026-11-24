import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Ambient } from "@/components/Ambient";
import { AlbumStory } from "@/components/ArticleView";
import { releaseKind, ReleaseGrid, TrackList } from "@/components/Catalog";
import { FactsPanel } from "@/components/FactsPanel";
import { HeroSkeleton, StorySkeleton } from "@/components/Skeletons";
import { hasLocale, href, localeTags, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getAlbum, getArtist, type Album } from "@/lib/music";

type Props = PageProps<"/[lang]/album/[id]">;

function parseId(id: string) {
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id: rawId } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang).meta;
  const id = parseId(rawId);
  const album = id ? await getAlbum(id, lang).catch(() => null) : null;
  if (!album) return { title: t.album };
  const title = t.albumTitle(album.title, album.artist.name);
  const description = t.albumDescription(album.title, album.artist.name);
  return {
    title,
    description,
    openGraph: { title, description, siteName: "Sonder", type: "music.album" },
    twitter: { card: "summary_large_image", title, description },
    alternates: { languages: Object.fromEntries(locales.map((l) => [localeTags[l], `/${l}/album/${album.id}`])) },
  };
}

export default async function AlbumPage({ params }: Props) {
  const locale = await getLocale();
  return (
    <div className="page song-page" data-trail>
      <Suspense
        fallback={
          <>
            <Ambient images={[]} mode="album" />
            <HeroSkeleton label={getDictionary(locale).album.loading} />
          </>
        }
      >
        <AlbumView params={params} locale={locale} />
      </Suspense>
    </div>
  );
}

async function AlbumView({ params, locale }: { params: Props["params"]; locale: Locale }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const album = await getAlbum(id, locale);
  if (!album) notFound();
  const t = getDictionary(locale);

  return (
    <>
      <Ambient images={[album.cover]} mode="album" />
      <Hero album={album} locale={locale} />

      <div className="story-layout">
        <div className="story">
          {album.tracks.length > 0 && (
            <section className="album-tracks" aria-labelledby="tracks-title">
              <h2 id="tracks-title" className="section-title">
                {t.album.tracks}
              </h2>
              <TrackList rows={album.tracks} locale={locale} variant="album" albumArtist={album.artist.name} />
            </section>
          )}
          <article aria-labelledby="story-title">
            <h2 id="story-title" className="section-title">
              {t.album.storyTitle}
            </h2>
            <Suspense fallback={<StorySkeleton label={t.album.storyLoading} />}>
              <AlbumStory id={album.id} locale={locale} />
            </Suspense>
          </article>
        </div>
        <FactsPanel
          facts={album.facts}
          locale={locale}
          sources={t.album.sources}
          links={[
            ...(album.article ? [{ label: t.song.readWikipedia, url: album.article.url }] : []),
            { label: t.song.viewDeezer, url: album.deezerUrl },
          ]}
        />
      </div>

      <Suspense fallback={null}>
        <MoreBy album={album} locale={locale} />
      </Suspense>
    </>
  );
}

function Hero({ album, locale }: { album: Album; locale: Locale }) {
  const t = getDictionary(locale).song;
  return (
    <section className="song-hero" aria-labelledby="album-title">
      <div className="hero-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={album.cover} alt={t.cover(album.title)} width={1000} height={1000} />
      </div>
      <div className="hero-meta">
        <Link className="hero-artist" href={href(locale, `/artist/${album.artist.id}`)}>
          {album.artist.name}
        </Link>
        <h1 id="album-title" className={album.title.length > 28 ? "long" : undefined}>
          {album.title}
        </h1>
        <dl className="hero-details">
          <div>
            <dt>{t.release}</dt>
            <dd>{releaseKind(locale, album.recordType)}</dd>
          </div>
          {album.year && (
            <div>
              <dt>{t.year}</dt>
              <dd>{album.year}</dd>
            </div>
          )}
          {album.genres.length > 0 && (
            <div>
              <dt>{album.genres.length > 1 ? t.genres : t.genre}</dt>
              <dd>{album.genres.join(", ")}</dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}

/** Other albums by the same artist, from the (cached) artist page data. */
async function MoreBy({ album, locale }: { album: Album; locale: Locale }) {
  const t = getDictionary(locale).album;
  const artist = await getArtist(album.artist.id).catch(() => null);
  const others = (artist?.albums ?? []).filter((a) => a.id !== album.id).slice(0, 6);
  if (!others.length) return null;
  return (
    <section className="recs" aria-labelledby="more-title">
      <h2 id="more-title" className="section-title">
        <Link href={href(locale, `/artist/${album.artist.id}`)}>{t.moreBy(album.artist.name)}</Link>
      </h2>
      <ReleaseGrid releases={others} locale={locale} />
    </section>
  );
}

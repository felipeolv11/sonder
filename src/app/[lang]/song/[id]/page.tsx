import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Ambient } from "@/components/Ambient";
import { RecordVisit } from "@/components/history";
import { Recommendations } from "@/components/Recommendations";
import { HeroSkeleton, RecsSkeleton, StorySkeleton } from "@/components/Skeletons";
import { StoryView } from "@/components/StoryView";
import { hasLocale, href, localeTags, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatFact } from "@/i18n/format";
import { getLocale } from "@/i18n/server";
import { getSong, type Song } from "@/lib/music";

type Props = PageProps<"/[lang]/song/[id]">;

function parseId(id: string) {
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, id: rawId } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang).meta;
  const id = parseId(rawId);
  const song = id ? await getSong(id, lang).catch(() => null) : null;
  if (!song) return { title: t.song };
  return {
    title: t.songTitle(song.title, song.artist.name),
    description: t.songDescription(song.title, song.artist.name),
    alternates: { languages: Object.fromEntries(locales.map((l) => [localeTags[l], `/${l}/song/${song.id}`])) },
  };
}

export default async function SongPage({ params }: Props) {
  const locale = await getLocale();
  return (
    <div className="page song-page">
      <Suspense
        fallback={
          <>
            <Ambient images={[]} mode="album" />
            <HeroSkeleton label={getDictionary(locale).song.loading} />
          </>
        }
      >
        <SongView params={params} locale={locale} />
      </Suspense>
    </div>
  );
}

async function SongView({ params, locale }: { params: Props["params"]; locale: Locale }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const song = await getSong(id, locale);
  if (!song) notFound();
  const t = getDictionary(locale);

  return (
    <>
      <Ambient images={[song.album.cover]} mode="album" />
      <RecordVisit id={song.id} title={song.title} artist={song.artist.name} album={song.album.title} cover={song.album.cover} />

      <Hero song={song} locale={locale} />

      <div className="story-layout">
        <article className="story" aria-labelledby="story-title">
          <h2 id="story-title" className="section-title">
            {t.song.storyTitle}
          </h2>
          <Suspense fallback={<StorySkeleton label={t.story.loading} />}>
            <StoryView id={song.id} locale={locale} />
          </Suspense>
        </article>
        <FactsPanel song={song} locale={locale} />
      </div>

      <section className="recs" aria-labelledby="recs-title">
        <h2 id="recs-title" className="section-title">
          {t.song.recsTitle}
        </h2>
        <Suspense fallback={<RecsSkeleton label={t.recs.loading} />}>
          <Recommendations id={song.id} locale={locale} />
        </Suspense>
      </section>
    </>
  );
}

function Hero({ song, locale }: { song: Song; locale: Locale }) {
  const t = getDictionary(locale).song;
  const kind = song.album.recordType === "album" ? t.album : song.album.recordType === "ep" ? t.ep : t.release;
  return (
    <section className="song-hero" aria-labelledby="song-title">
      <div className="hero-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={song.album.cover} alt={t.cover(song.album.title)} width={1000} height={1000} />
      </div>
      <div className="hero-meta">
        <Link className="hero-artist" href={href(locale, `/search?q=${encodeURIComponent(song.artist.name)}`)}>
          {song.artist.name}
        </Link>
        <h1 id="song-title" className={song.title.length > 28 ? "long" : undefined}>
          {song.title}
        </h1>
        <dl className="hero-details">
          <div>
            <dt>{kind}</dt>
            <dd>{song.album.title}</dd>
          </div>
          {song.year && (
            <div>
              <dt>{t.year}</dt>
              <dd>{song.year}</dd>
            </div>
          )}
          {song.genres.length > 0 && (
            <div>
              <dt>{song.genres.length > 1 ? t.genres : t.genre}</dt>
              <dd>{song.genres.join(", ")}</dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}

function FactsPanel({ song, locale }: { song: Song; locale: Locale }) {
  const t = getDictionary(locale).song;
  return (
    <aside className="facts glass" aria-labelledby="facts-title">
      <h2 id="facts-title">{t.onRecord}</h2>
      {song.facts.length > 0 ? (
        <dl>
          {song.facts.map((f) => {
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
        <p>{t.sources}</p>
        <ul>
          {song.songArticle && (
            <li>
              <a href={song.songArticle.url} target="_blank" rel="noreferrer">
                {t.readWikipedia}
              </a>
            </li>
          )}
          <li>
            <a href={song.deezerUrl} target="_blank" rel="noreferrer">
              {t.viewDeezer}
            </a>
          </li>
        </ul>
      </div>
    </aside>
  );
}

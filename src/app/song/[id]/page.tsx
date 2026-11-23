import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Ambient } from "@/components/Ambient";
import { RecordVisit } from "@/components/history";
import { Recommendations } from "@/components/Recommendations";
import { HeroSkeleton, RecsSkeleton, StorySkeleton } from "@/components/Skeletons";
import { StoryView } from "@/components/StoryView";
import { getSong, type Song } from "@/lib/music";

type Props = { params: Promise<{ id: string }> };

function parseId(id: string) {
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  const song = id ? await getSong(id).catch(() => null) : null;
  if (!song) return { title: "Song" };
  return {
    title: `${song.title} by ${song.artist.name}`,
    description: `The story behind “${song.title}” by ${song.artist.name}, and songs to explore next.`,
  };
}

export default function SongPage({ params }: Props) {
  return (
    <div className="page song-page">
      <Suspense
        fallback={
          <>
            <Ambient images={[]} mode="album" />
            <HeroSkeleton />
          </>
        }
      >
        <SongView params={params} />
      </Suspense>
    </div>
  );
}

async function SongView({ params }: Props) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const song = await getSong(id);
  if (!song) notFound();

  return (
    <>
      <Ambient images={[song.album.cover]} mode="album" />
      <RecordVisit id={song.id} title={song.title} artist={song.artist.name} album={song.album.title} cover={song.album.cover} />

      <Hero song={song} />

      <div className="story-layout">
        <article className="story" aria-labelledby="story-title">
          <h2 id="story-title" className="section-title">
            The story behind the music
          </h2>
          <Suspense fallback={<StorySkeleton />}>
            <StoryView id={song.id} />
          </Suspense>
        </article>
        <FactsPanel song={song} />
      </div>

      <section className="recs" aria-labelledby="recs-title">
        <h2 id="recs-title" className="section-title">
          If you love this, explore these.
        </h2>
        <Suspense fallback={<RecsSkeleton />}>
          <Recommendations id={song.id} />
        </Suspense>
      </section>
    </>
  );
}

function Hero({ song }: { song: Song }) {
  return (
    <section className="song-hero" aria-labelledby="song-title">
      <div className="hero-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={song.album.cover} alt={`${song.album.title} album cover`} width={1000} height={1000} />
      </div>
      <div className="hero-meta">
        <Link className="hero-artist" href={`/search?q=${encodeURIComponent(song.artist.name)}`}>
          {song.artist.name}
        </Link>
        <h1 id="song-title" className={song.title.length > 28 ? "long" : undefined}>
          {song.title}
        </h1>
        <dl className="hero-details">
          <div>
            <dt>{song.album.recordType === "album" ? "Album" : song.album.recordType === "ep" ? "EP" : "Release"}</dt>
            <dd>{song.album.title}</dd>
          </div>
          {song.year && (
            <div>
              <dt>Year</dt>
              <dd>{song.year}</dd>
            </div>
          )}
          {song.genres.length > 0 && (
            <div>
              <dt>{song.genres.length > 1 ? "Genres" : "Genre"}</dt>
              <dd>{song.genres.join(", ")}</dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}

function FactsPanel({ song }: { song: Song }) {
  return (
    <aside className="facts glass" aria-labelledby="facts-title">
      <h2 id="facts-title">On record</h2>
      {song.facts.length > 0 ? (
        <dl>
          {song.facts.map((f) => (
            <div key={f.label} className="fact">
              <dt>{f.label}</dt>
              <dd title={`Source: ${f.source}`}>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="facts-empty">No credits are documented for this recording yet.</p>
      )}
      <div className="facts-sources">
        <p>Credits come from Wikidata, release details from Deezer.</p>
        <ul>
          {song.songArticle && (
            <li>
              <a href={song.songArticle.url} target="_blank" rel="noreferrer">
                Read the Wikipedia article
              </a>
            </li>
          )}
          <li>
            <a href={song.deezerUrl} target="_blank" rel="noreferrer">
              View on Deezer
            </a>
          </li>
        </ul>
      </div>
    </aside>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { Ambient } from "@/components/Ambient";
import { CoverGridSkeleton } from "@/components/Skeletons";
import { SongGrid } from "@/components/SongGrid";
import { searchSongs } from "@/lib/music";

export const metadata: Metadata = { title: "Search" };

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export default function SearchPage({ searchParams }: Props) {
  return (
    <div className="page">
      <Suspense fallback={<SearchFallback />}>
        <Results searchParams={searchParams} />
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

async function Results({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim();

  if (!q) {
    return (
      <>
        <Ambient images={[]} mode="field" />
        <div className="state">
          <h1>Search for a song</h1>
          <p>Type a song, artist or album in the search field above. Adding the artist’s name helps find the original recording.</p>
        </div>
      </>
    );
  }

  let results;
  try {
    results = await searchSongs(q.toLowerCase());
  } catch {
    return (
      <>
        <Ambient images={[]} mode="field" />
        <div className="state">
          <h1>Search couldn’t reach the music catalogue</h1>
          <p>The connection to Deezer failed. Check your internet connection, then search again.</p>
        </div>
      </>
    );
  }

  if (results.length === 0) {
    return (
      <>
        <Ambient images={[]} mode="field" />
        <div className="state">
          <h1>No songs match “{q}”</h1>
          <p>Check the spelling, or search for the artist and title together, for example “Radiohead No Surprises”.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Ambient images={results.slice(0, 5).map((r) => r.cover)} mode="field" />
      <header className="page-head">
        <h1>
          Songs matching “{q}”
        </h1>
        <p>Choose a recording to open its story.</p>
      </header>
      <SongGrid songs={results} />
    </>
  );
}

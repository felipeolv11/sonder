import Link from "next/link";
import { Suspense } from "react";
import { Ambient } from "@/components/Ambient";
import { RecentlyExplored } from "@/components/history";
import { SearchField } from "@/components/SearchField";
import { getAmbientCovers } from "@/lib/music";

const STARTERS = [
  { title: "No Surprises", artist: "Radiohead" },
  { title: "Águas de Março", artist: "Elis Regina" },
  { title: "Dreams", artist: "Fleetwood Mac" },
  { title: "Pink + White", artist: "Frank Ocean" },
];

export default async function Home() {
  const covers = await getAmbientCovers();

  return (
    <>
      <Ambient images={covers} mode="field" />
      <div className="home">
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">Start with a song you love.</h1>
          <p className="hero-sub">Discover the stories behind the music you love, and where it leads next.</p>
          <Suspense fallback={<div className="search search-hero search-placeholder" />}>
            <SearchField variant="hero" />
          </Suspense>
          <div className="starters">
            <span className="starters-label">Or begin with</span>
            <ul>
              {STARTERS.map((s) => (
                <li key={s.title}>
                  <Link href={`/search?q=${encodeURIComponent(`${s.artist} ${s.title}`)}`}>
                    {s.title} <span>{s.artist}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <RecentlyExplored />
      </div>
    </>
  );
}

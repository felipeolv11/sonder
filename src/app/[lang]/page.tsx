import Link from "next/link";
import { Suspense } from "react";
import { Ambient } from "@/components/Ambient";
import { RecentlyExplored } from "@/components/history";
import { SearchField } from "@/components/SearchField";
import { href } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getAmbientCovers } from "@/lib/music";

const STARTERS = [
  { title: "No Surprises", artist: "Radiohead" },
  { title: "Águas de Março", artist: "Elis Regina" },
  { title: "Dreams", artist: "Fleetwood Mac" },
  { title: "Pink + White", artist: "Frank Ocean" },
];

export default async function Home() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const covers = await getAmbientCovers();

  return (
    <>
      <Ambient images={covers} mode="field" />
      <div className="home">
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">{t.home.title}</h1>
          <p className="hero-sub">{t.home.sub}</p>
          <Suspense fallback={<div className="search search-hero search-placeholder" />}>
            <SearchField variant="hero" />
          </Suspense>
          <div className="starters">
            <span className="starters-label">{t.home.beginWith}</span>
            <ul>
              {STARTERS.map((s) => (
                <li key={s.title}>
                  <Link href={href(locale, `/search?q=${encodeURIComponent(`${s.artist} ${s.title}`)}`)}>
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

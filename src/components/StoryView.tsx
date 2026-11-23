import { localeTags, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getStory, type Lang, type Story, type StoryKind, type StorySection } from "@/lib/music";
import { SectionBody } from "./SectionBody";

export async function StoryView({ id, locale }: { id: number; locale: Locale }) {
  const t = getDictionary(locale);
  let story: Story;
  try {
    story = await getStory(id, locale);
  } catch (err) {
    console.error("[sonder] story failed for track", id, err);
    return (
      <div className="inline-state">
        <p>{t.story.error}</p>
      </div>
    );
  }

  if (story.focus === "none") {
    return (
      <div className="inline-state">
        <p>{t.story.none}</p>
      </div>
    );
  }

  const kinds = new Set<StoryKind>([...story.sections, ...(story.album?.sections ?? [])].map((s) => s.kind));
  const legend = (["documented", "interpretation", "opinion"] as StoryKind[]).filter((k) => kinds.has(k));
  // Blocks read from another Wikipedia edition get a note; untranslated ones keep their own lang attribute.
  const foreign = (lang?: Lang, translated?: boolean) => (lang && lang !== locale && !translated ? { lang: localeTags[lang] } : {});
  const sourceNote = (lang?: Lang, translated?: boolean) =>
    lang && lang !== locale ? <p className="story-note">{translated ? t.story.translated : t.story.fallback}</p> : null;
  const anyTranslated = !!(story.songTranslated || story.album?.translated || story.artist?.translated);
  // Without a song article, the album (or artist) block opens the story, so it needs no divider above it.
  const opening = story.focus !== "song" ? " is-first" : "";

  return (
    <div className="story-body">
      {story.focus !== "song" && <p className="story-note">{story.focus === "album" ? t.story.noSongAlbum : t.story.noSongArtist}</p>}

      {legend.length > 1 && (
        <ul className="legend" aria-label={t.story.legend}>
          {legend.map((k) => (
            <li key={k} data-kind={k}>
              <span className="kind-dot" aria-hidden="true" />
              <strong>{t.story.kinds[k]}</strong> {t.story.kindHelp[k]}
            </li>
          ))}
        </ul>
      )}

      {sourceNote(story.songLang, story.songTranslated)}
      <div {...foreign(story.songLang, story.songTranslated)}>
        {story.standfirst && story.standfirst.paragraphs.length > 0 && (
          <div className="standfirst">
            {story.standfirst.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
        {story.sections.map((s) => (
          <Section key={s.heading} section={s} t={t} />
        ))}
      </div>

      {story.album && (story.album.paragraphs.length > 0 || story.album.sections.length > 0) && (
        <section className={`album-story${opening}`} aria-labelledby="album-story-title">
          <h3 id="album-story-title" className="album-story-title">
            {t.story.aboutAlbum} <cite>{story.album.title}</cite>
          </h3>
          {sourceNote(story.album.lang, story.album.translated)}
          <div {...foreign(story.album.lang, story.album.translated)}>
            <SectionBody paragraphs={story.album.paragraphs} subsections={[]} initial={story.focus === "song" ? 2 : 4} />
            {story.album.sections.map((s) => (
              <Section key={`album-${s.heading}`} section={s} t={t} small />
            ))}
          </div>
          <SourceLine t={t} title={story.album.source.title} url={story.album.source.url} />
        </section>
      )}

      {story.artist && story.artist.paragraphs.length > 0 && (
        <section className={`album-story${story.album ? "" : opening}`} aria-labelledby="artist-story-title">
          <h3 id="artist-story-title" className="album-story-title">
            {t.story.aboutArtist(story.artist.name)}
          </h3>
          {sourceNote(story.artist.lang, story.artist.translated)}
          <div {...foreign(story.artist.lang, story.artist.translated)}>
            <SectionBody paragraphs={story.artist.paragraphs} subsections={[]} initial={3} />
          </div>
          <SourceLine t={t} title={story.artist.source.title} url={story.artist.source.url} />
        </section>
      )}

      <footer className="license">
        {t.story.license[0]}{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        {t.story.license[1]}
        {anyTranslated && t.story.licenseTranslated}
      </footer>
    </div>
  );
}

function Section({ section, t, small }: { section: StorySection; t: Dictionary; small?: boolean }) {
  const Heading = small ? "h4" : "h3";
  return (
    <section className={`story-section${small ? " small" : ""}`} data-kind={section.kind}>
      <header>
        <Heading>{section.heading}</Heading>
        <span className="kind" title={t.story.kindHelp[section.kind]}>
          <span className="kind-dot" aria-hidden="true" />
          {t.story.kinds[section.kind]}
        </span>
      </header>
      <SectionBody paragraphs={section.paragraphs} subsections={section.subsections} initial={small ? 1 : 2} />
      {!small && <SourceLine t={t} title={section.source.title} url={section.source.url} section={section.heading} />}
    </section>
  );
}

function SourceLine({ t, title, url, section }: { t: Dictionary; title: string; url: string; section?: string }) {
  return (
    <p className="source">
      <a href={url} target="_blank" rel="noreferrer">
        {t.story.source(title, section)}
      </a>
    </p>
  );
}

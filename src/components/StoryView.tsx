import { getStory, type Story, type StoryKind, type StorySection } from "@/lib/music";
import { SectionBody } from "./SectionBody";

const KIND_LABEL: Record<StoryKind, string> = {
  documented: "Documented history",
  interpretation: "Interpretation",
  opinion: "Critical opinion",
};

const KIND_HELP: Record<StoryKind, string> = {
  documented: "Events and details reported in cited sources.",
  interpretation: "How the artist, writers and critics have read the music and lyrics.",
  opinion: "How the song was received and judged.",
};

export async function StoryView({ id }: { id: number }) {
  let story: Story;
  try {
    story = await getStory(id);
  } catch (err) {
    console.error("[sonder] story failed for track", id, err);
    return (
      <div className="inline-state">
        <p>The story couldn’t be loaded because Wikipedia didn’t respond. Reload the page to try again.</p>
      </div>
    );
  }

  if (story.focus === "none") {
    return (
      <div className="inline-state">
        <p>
          Wikipedia has no documented history for this song, its album or its artist yet, so there’s nothing reliable to tell here.
          The recommendations below still work from listening data.
        </p>
      </div>
    );
  }

  const kinds = new Set<StoryKind>([...story.sections, ...(story.album?.sections ?? [])].map((s) => s.kind));
  const legend = (["documented", "interpretation", "opinion"] as StoryKind[]).filter((k) => kinds.has(k));

  return (
    <div className="story-body">
      {story.focus !== "song" && (
        <p className="story-note">
          Wikipedia doesn’t have an article about this song, so this is the story of the {story.focus === "album" ? "album it belongs to" : "artist"}.
        </p>
      )}

      {legend.length > 1 && (
        <ul className="legend" aria-label="How to read this story">
          {legend.map((k) => (
            <li key={k} data-kind={k}>
              <span className="kind-dot" aria-hidden="true" />
              <strong>{KIND_LABEL[k]}</strong> {KIND_HELP[k]}
            </li>
          ))}
        </ul>
      )}

      {story.standfirst && story.standfirst.paragraphs.length > 0 && (
        <div className="standfirst">
          {story.standfirst.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {story.sections.map((s) => (
        <Section key={s.heading} section={s} />
      ))}

      {story.album && (story.album.paragraphs.length > 0 || story.album.sections.length > 0) && (
        <section className="album-story" aria-labelledby="album-story-title">
          <h3 id="album-story-title" className="album-story-title">
            About the album, <cite>{story.album.title}</cite>
          </h3>
          <SectionBody paragraphs={story.album.paragraphs} subsections={[]} initial={story.focus === "song" ? 2 : 4} />
          {story.album.sections.map((s) => (
            <Section key={`album-${s.heading}`} section={s} small />
          ))}
          <SourceLine title={story.album.source.title} url={story.album.source.url} />
        </section>
      )}

      {story.artist && story.artist.paragraphs.length > 0 && (
        <section className="album-story" aria-labelledby="artist-story-title">
          <h3 id="artist-story-title" className="album-story-title">
            About {story.artist.name}
          </h3>
          <SectionBody paragraphs={story.artist.paragraphs} subsections={[]} initial={3} />
          <SourceLine title={story.artist.source.title} url={story.artist.source.url} />
        </section>
      )}

      <footer className="license">
        Every passage above is quoted from English Wikipedia and shared under{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        . Sonder doesn’t write or rephrase these accounts; follow the source links for the citations behind each claim.
      </footer>
    </div>
  );
}

function Section({ section, small }: { section: StorySection; small?: boolean }) {
  const Heading = small ? "h4" : "h3";
  return (
    <section className={`story-section${small ? " small" : ""}`} data-kind={section.kind}>
      <header>
        <Heading>{section.heading}</Heading>
        <span className="kind" title={KIND_HELP[section.kind]}>
          <span className="kind-dot" aria-hidden="true" />
          {KIND_LABEL[section.kind]}
        </span>
      </header>
      <SectionBody paragraphs={section.paragraphs} subsections={section.subsections} initial={small ? 1 : 2} />
      {!small && <SourceLine title={section.source.title} url={section.source.url} section={section.heading} />}
    </section>
  );
}

function SourceLine({ title, url, section }: { title: string; url: string; section?: string }) {
  return (
    <p className="source">
      <a href={url} target="_blank" rel="noreferrer">
        Wikipedia, “{title}”{section ? `, ${section}` : ""}
      </a>
    </p>
  );
}

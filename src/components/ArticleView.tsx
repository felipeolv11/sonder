import { localeTags, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getAlbumStory, getArtistBio, type ArticleBlock } from "@/lib/music";
import { SectionBody } from "./SectionBody";
import { Legend, License, Section, SourceLine } from "./StoryView";

/** The artist's Wikipedia biography, streamed in after the rest of the artist page. */
export async function ArtistBio({ id, locale }: { id: number; locale: Locale }) {
  const t = getDictionary(locale).artist;
  let block: ArticleBlock | null;
  try {
    block = await getArtistBio(id, locale);
  } catch (err) {
    console.error("[sonder] biography failed for artist", id, err);
    return <InlineState text={t.error} />;
  }
  return block ? <ArticleView block={block} locale={locale} /> : <InlineState text={t.none} />;
}

/** The album's Wikipedia article, streamed in after the track list. */
export async function AlbumStory({ id, locale }: { id: number; locale: Locale }) {
  const t = getDictionary(locale).album;
  let block: ArticleBlock | null;
  try {
    block = await getAlbumStory(id, locale);
  } catch (err) {
    console.error("[sonder] story failed for album", id, err);
    return <InlineState text={t.error} />;
  }
  return block ? <ArticleView block={block} locale={locale} /> : <InlineState text={t.none} />;
}

function InlineState({ text }: { text: string }) {
  return (
    <div className="inline-state">
      <p>{text}</p>
    </div>
  );
}

function ArticleView({ block, locale }: { block: ArticleBlock; locale: Locale }) {
  const t = getDictionary(locale);
  const foreign = block.lang !== locale;
  // Untranslated text from another edition keeps its own lang attribute, for screen readers and hyphenation.
  const langAttr = foreign && !block.translated ? { lang: localeTags[block.lang] } : {};
  const lead = block.paragraphs.slice(0, 2);
  const rest = block.paragraphs.slice(2);

  return (
    <div className="story-body">
      <Legend sections={block.sections} t={t} />
      {foreign && <p className="story-note">{block.translated ? t.story.translated : t.story.fallback}</p>}
      <div {...langAttr}>
        {lead.length > 0 && (
          <div className="standfirst">
            {lead.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
        {rest.length > 0 && <SectionBody paragraphs={rest} subsections={[]} initial={0} />}
        {block.paragraphs.length > 0 && <SourceLine t={t} title={block.source.title} url={block.source.url} />}
        {block.sections.map((s) => (
          <Section key={s.heading} section={s} t={t} />
        ))}
      </div>
      <License t={t} translated={!!block.translated} />
    </div>
  );
}

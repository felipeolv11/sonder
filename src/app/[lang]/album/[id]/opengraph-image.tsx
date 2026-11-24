import { ImageResponse } from "next/og";
import { releaseKind } from "@/components/Catalog";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getAlbum, getAlbumStory } from "@/lib/music";
import { asJpeg, excerpt, OG_SIZE, OgCard, OgFallback, ogFonts, within } from "@/lib/og";

export const alt = "Album cover, title and the opening of its story on Sonder";
export const size = OG_SIZE;
export const contentType = "image/jpeg";

/** A link preview for an album: its cover, title, artist and the start of its story. */
export default async function Image({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: rawLang, id: rawId } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const id = Number(rawId);
  const [album, fonts] = await Promise.all([Number.isSafeInteger(id) && id > 0 ? getAlbum(id, lang).catch(() => null) : null, ogFonts()]);
  if (!album) return asJpeg(new ImageResponse(<OgFallback />, { ...size, fonts }));

  const story = await within(getAlbumStory(album.id, lang), 3500, null);
  const text = story?.paragraphs[0] ? excerpt(story.paragraphs[0]) : getDictionary(lang).meta.albumDescription(album.title, album.artist.name);
  const above = [album.artist.name, releaseKind(lang, album.recordType), album.year].filter(Boolean).join(", ");

  return asJpeg(new ImageResponse(<OgCard image={album.cover} above={above} title={album.title} text={text} />, { ...size, fonts }));
}

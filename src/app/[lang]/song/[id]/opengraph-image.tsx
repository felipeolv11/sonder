import { ImageResponse } from "next/og";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSong, getStory, type Story } from "@/lib/music";
import { asJpeg, excerpt, OG_SIZE, OgCard, OgFallback, ogFonts, within } from "@/lib/og";

export const alt = "Album cover, song title and the opening of its story on Sonder";
export const size = OG_SIZE;
export const contentType = "image/jpeg";

/** The first passage a reader would see: the song's story, else the album's, else the artist's. */
function opening(story: Story | null) {
  const text = story?.standfirst?.paragraphs[0] ?? story?.album?.paragraphs[0] ?? story?.artist?.paragraphs[0];
  return text ? excerpt(text) : null;
}

/** A link preview for a song: its cover, title, artist and the start of its story. */
export default async function Image({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: rawLang, id: rawId } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const id = Number(rawId);
  const [song, fonts] = await Promise.all([Number.isSafeInteger(id) && id > 0 ? getSong(id, lang).catch(() => null) : null, ogFonts()]);
  if (!song) return asJpeg(new ImageResponse(<OgFallback />, { ...size, fonts }));

  // Crawlers give up on slow previews, so the story only makes it in if it's quick (it usually is: it's cached).
  const story = await within(getStory(song.id, lang), 3500, null);
  const text = opening(story) ?? getDictionary(lang).meta.songDescription(song.title, song.artist.name);

  return asJpeg(
    new ImageResponse(<OgCard image={song.album.cover} above={song.artist.name} title={song.title} text={text} />, { ...size, fonts }),
  );
}

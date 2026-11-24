import { ImageResponse } from "next/og";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getArtist, getArtistBio } from "@/lib/music";
import { asJpeg, excerpt, OG_SIZE, OgCard, OgFallback, ogFonts, within } from "@/lib/og";

export const alt = "Artist photo, name and the opening of their story on Sonder";
export const size = OG_SIZE;
export const contentType = "image/jpeg";

/** A link preview for an artist: their photo, name and the start of their biography. */
export default async function Image({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: rawLang, id: rawId } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const t = getDictionary(lang);
  const id = Number(rawId);
  const [artist, fonts] = await Promise.all([Number.isSafeInteger(id) && id > 0 ? getArtist(id).catch(() => null) : null, ogFonts()]);
  if (!artist?.picture) return asJpeg(new ImageResponse(<OgFallback />, { ...size, fonts }));

  const bio = await within(getArtistBio(artist.id, lang), 3500, null);
  const text = bio?.paragraphs[0] ? excerpt(bio.paragraphs[0]) : t.meta.artistDescription(artist.name);

  return asJpeg(new ImageResponse(<OgCard image={artist.picture} round above={t.artist.label} title={artist.name} text={text} />, { ...size, fonts }));
}

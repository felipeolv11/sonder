import { ImageResponse } from "next/og";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getAmbientCovers } from "@/lib/music";
import { asJpeg, OG_SIZE, OgBrand, ogFonts, within } from "@/lib/og";

export const alt = "Sonder: discover the stories behind the music you love";
export const size = OG_SIZE;
export const contentType = "image/jpeg";

/** The default link preview: the home page's promise beside a few of this week's covers. */
export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const t = getDictionary(lang).home;
  const [fonts, covers] = await Promise.all([ogFonts(), within(getAmbientCovers(), 3000, [])]);
  const grid = covers.slice(0, 4);

  return asJpeg(
    new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          backgroundColor: "#15171d",
          backgroundImage: "radial-gradient(circle at 78% 50%, #2c2f3a 0%, #1b1d25 40%, #15171d 72%)",
        }}
      >
        <div style={{ display: "flex", width: "100%", height: "100%", padding: 72, position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
            <OgBrand />
            <div style={{ marginTop: "auto", fontFamily: "Newsreader", fontSize: 72, lineHeight: 1.02, letterSpacing: "-0.03em", color: "rgba(255,255,255,0.96)" }}>
              {t.title}
            </div>
            <div style={{ marginTop: 22, fontFamily: "Inter", fontWeight: 500, fontSize: 26, lineHeight: 1.4, color: "rgba(235,235,245,0.66)" }}>{t.sub}</div>
          </div>
          {grid.length === 4 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, width: 458, marginLeft: "auto", alignSelf: "center" }}>
              {grid.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" width={220} height={220} style={{ borderRadius: 8, boxShadow: "0 24px 50px rgba(0,0,0,0.5)" }} />
              ))}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts },
    ),
  );
}

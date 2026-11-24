/*
 * Shared pieces for the Open Graph images (the previews shown when a link is shared).
 * They're drawn by next/og, which needs TTF/OTF fonts: next/font only ships WOFF2, so the same
 * families are fetched as TTF from Google Fonts, once per server instance.
 */

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600; style: "normal" };

const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Newsreader:wght@400&family=Inter:wght@500;600";

async function fetchFonts(): Promise<Font[]> {
  // A plain request (no browser User-Agent) gets TrueType files rather than WOFF2.
  const css = await (await fetch(FONTS_CSS)).text();
  const faces = [...css.matchAll(/font-family:\s*'([^']+)';[\s\S]*?font-weight:\s*(\d+);[\s\S]*?src:\s*url\(([^)]+)\)/g)];
  return Promise.all(
    faces.map(async ([, name, weight, url]) => ({
      name,
      weight: Number(weight) as Font["weight"],
      style: "normal" as const,
      data: await (await fetch(url)).arrayBuffer(),
    })),
  );
}

let fonts: Promise<Font[]> | null = null;
export function ogFonts(): Promise<Font[]> {
  // If the download fails, forget it so the next image tries again.
  fonts ??= fetchFonts().catch((err) => {
    fonts = null;
    throw err;
  });
  return fonts;
}

export const OG_SIZE = { width: 1200, height: 630 };

/** The first sentences of a passage, cut at a sentence end where possible. */
export function excerpt(text: string, max = 190): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (end > max * 0.5) return cut.slice(0, end + 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/** Resolves to `fallback` if `p` takes longer than `ms`: link previews can't wait on a slow source. */
export function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

/**
 * Re-encodes a generated PNG as JPEG. Cover art makes the PNGs 600–800 KB, and WhatsApp skips
 * previews much over 600 KB; as JPEG the same card is a fraction of that.
 */
export async function asJpeg(image: Response): Promise<Response> {
  const { default: sharp } = await import("sharp");
  const jpeg = await sharp(Buffer.from(await image.arrayBuffer())).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

/**
 * The shared preview layout: artwork on the left (round for an artist), and beside it a small
 * line above the title, the title in the site's serif, a passage, and the Sonder mark.
 */
export function OgCard({ image, round, above, title, text }: { image: string; round?: boolean; above: string; title: string; text: string }) {
  const titleSize = title.length > 34 ? 54 : title.length > 20 ? 66 : 82;
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: 64,
        gap: 60,
        backgroundColor: "#15171d",
        backgroundImage: "radial-gradient(circle at 24% 50%, #2c2f3a 0%, #1b1d25 42%, #15171d 75%)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt=""
        width={502}
        height={502}
        style={{
          borderRadius: round ? 251 : 10,
          boxShadow: "0 40px 80px rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.1)",
          objectFit: "cover",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 28, color: "rgba(235,235,245,0.66)" }}>{above}</div>
        <div style={{ marginTop: 10, fontFamily: "Newsreader", fontSize: titleSize, lineHeight: 1.02, letterSpacing: "-0.03em", color: "rgba(255,255,255,0.96)" }}>
          {title}
        </div>
        <div style={{ marginTop: 26, fontFamily: "Newsreader", fontSize: 27, lineHeight: 1.42, color: "rgba(255,255,255,0.78)" }}>{text}</div>
        <div style={{ display: "flex", marginTop: "auto" }}>
          <OgBrand color="rgba(255,255,255,0.86)" />
        </div>
      </div>
    </div>
  );
}

/** Shown when the song, album or artist can't be found: just the mark. */
export function OgFallback() {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#15171d", padding: 72, alignItems: "flex-end" }}>
      <OgBrand />
    </div>
  );
}

/** The Sonder mark and name, as drawn in the toolbar. */
export function OgBrand({ color = "rgba(255,255,255,0.92)" }: { color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, color, fontFamily: "Inter", fontWeight: 600, fontSize: 28 }}>
      <svg width="30" height="30" viewBox="0 0 20 20">
        <circle cx="8" cy="10" r="6.25" fill="none" stroke={color} strokeWidth="1.5" />
        <circle cx="12.5" cy="10" r="6.25" fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="1.5" />
        <circle cx="8" cy="10" r="1.4" fill={color} />
      </svg>
      Sonder
    </div>
  );
}

"use client";

import { useEffect } from "react";

/**
 * The page's light source. Album artwork, blown up and blurred, tints the whole window,
 * so every song page takes on the colour of its record.
 */
export function Ambient({ images, mode }: { images: string[]; mode: "field" | "album" }) {
  const art = images[0];

  useEffect(() => {
    if (mode !== "album" || !art) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = art;
    img.onload = () => {
      if (cancelled) return;
      const accent = accentFrom(img);
      if (accent) document.documentElement.style.setProperty("--accent", accent);
    };
    return () => {
      cancelled = true;
      document.documentElement.style.removeProperty("--accent");
    };
  }, [art, mode]);

  if (!images.length) return <div className="ambient ambient-empty" aria-hidden="true" />;

  if (mode === "album") {
    return (
      <div className="ambient ambient-album" aria-hidden="true">
        <div className="ambient-layer a" style={{ backgroundImage: `url(${art})` }} />
        <div className="ambient-layer b" style={{ backgroundImage: `url(${art})` }} />
        <div className="ambient-veil" />
      </div>
    );
  }

  return (
    <div className="ambient ambient-field" aria-hidden="true">
      {[...new Set(images)].slice(0, 5).map((src, i) => (
        <div key={`${i}-${src}`} className={`ambient-blob blob-${i}`} style={{ backgroundImage: `url(${src})` }} />
      ))}
      <div className="ambient-veil" />
    </div>
  );
}

/** Picks the most characterful colour in the artwork and lifts it into a readable, quiet accent. */
function accentFrom(img: HTMLImageElement): string | null {
  try {
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]];
      const max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb);
      const sat = max === 0 ? 0 : (max - min) / max;
      const light = (max + min) / 510;
      const weight = sat * sat * (1 - Math.abs(light - 0.5)) + 0.02;
      r += pr * weight; g += pg * weight; b += pb * weight; w += weight;
    }
    const [h, s] = rgbToHsl(r / w, g / w, b / w);
    const sat = Math.min(Math.max(s * 100, 18), 48);
    return `hsl(${Math.round(h)} ${Math.round(sat)}% 74%)`;
  } catch {
    return null; // tainted canvas or decode failure: keep the neutral accent
  }
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDictionary } from "@/i18n/client";

/**
 * A horizontal shelf with previous/next buttons. The strip scrolls natively
 * (trackpad, touch, keyboard once focused); the buttons are there for mouse users.
 */
export function TimelineScroller({ header, range, label, children }: { header: ReactNode; range: string; label: string; children: ReactNode }) {
  const t = useDictionary().timeline;
  const viewport = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft >= max - 4 });
    };
    // Measured after layout, once the covers have their size.
    const frame = requestAnimationFrame(update);
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = viewport.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: "smooth" });
  };

  return (
    <>
      <div className="tl-head">
        {header}
        <div className="tl-controls">
          <span className="tl-range">{range}</span>
          <button type="button" className="tl-nav" onClick={() => scrollBy(-1)} disabled={edges.start} aria-label={t.previous}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M8.5 3 4.5 7l4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="tl-nav" onClick={() => scrollBy(1)} disabled={edges.end} aria-label={t.next}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="m5.5 3 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="tl-shelf" data-start={edges.start || undefined} data-end={edges.end || undefined}>
        <div ref={viewport} className="tl-viewport" role="region" aria-label={label} tabIndex={0}>
          {children}
        </div>
      </div>
    </>
  );
}

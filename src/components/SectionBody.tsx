"use client";

import { useId, useState } from "react";

type Props = {
  paragraphs: string[];
  subsections: { heading: string; paragraphs: string[] }[];
  initial: number;
};

export function SectionBody({ paragraphs, subsections, initial }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const total = paragraphs.length + subsections.reduce((n, s) => n + s.paragraphs.length, 0);
  const collapsible = total > initial + 1;

  const lead = collapsible ? paragraphs.slice(0, initial) : paragraphs;
  const restParagraphs = collapsible ? paragraphs.slice(initial) : [];

  return (
    <div className="prose">
      {lead.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {(!collapsible || open) && (
        <div id={id} className={collapsible ? "prose-more" : undefined}>
          {restParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {subsections.map((s) => (
            <div key={s.heading} className="subsection">
              <h4>{s.heading}</h4>
              {s.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ))}
        </div>
      )}
      {collapsible && (
        <button type="button" className="more" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          {open ? "Show less" : `Continue reading`}
        </button>
      )}
    </div>
  );
}

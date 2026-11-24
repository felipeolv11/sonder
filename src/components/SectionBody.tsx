"use client";

import { useId, useState } from "react";
import { useDictionary } from "@/i18n/client";

type Sub = { heading: string; paragraphs: string[] };

type Props = {
  paragraphs: string[];
  subsections: Sub[];
  initial: number;
};

export function SectionBody({ paragraphs, subsections, initial }: Props) {
  const [open, setOpen] = useState(false);
  const t = useDictionary();
  const id = useId();
  const total = paragraphs.length + subsections.reduce((n, s) => n + s.paragraphs.length, 0);
  const long = total > initial + 1;

  const lead = long ? paragraphs.slice(0, initial) : paragraphs;
  // A section that is all subsections ("History" on an artist page) opens with its first one,
  // rather than a heading followed by nothing but "Continue reading".
  const openSubs = long && paragraphs.length === 0 ? subsections.slice(0, 1) : [];
  const restParagraphs = long ? paragraphs.slice(initial) : [];
  const restSubs = long ? subsections.slice(openSubs.length) : subsections;
  const collapsible = long && (restParagraphs.length > 0 || restSubs.length > 0);

  return (
    <div className="prose">
      {lead.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {openSubs.map((s) => (
        <Subsection key={s.heading} {...s} />
      ))}
      {(!collapsible || open) && (
        <div id={id} className={collapsible ? "prose-more" : undefined}>
          {restParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {restSubs.map((s) => (
            <Subsection key={s.heading} {...s} />
          ))}
        </div>
      )}
      {collapsible && (
        <button type="button" className="more" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          {open ? t.story.showLess : t.story.continueReading}
        </button>
      )}
    </div>
  );
}

function Subsection({ heading, paragraphs }: Sub) {
  return (
    <div className="subsection">
      <h4>{heading}</h4>
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

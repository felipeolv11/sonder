import type { Metadata } from "next";
import { Ambient } from "@/components/Ambient";
import { getAbout, repoUrl } from "@/i18n/about";
import { hasLocale } from "@/i18n/config";
import { getLocale } from "@/i18n/server";

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang } = await params;
  return { title: hasLocale(lang) ? getAbout(lang).title : "About" };
}

export default async function AboutPage() {
  const a = getAbout(await getLocale());
  return (
    <div className="page">
      <Ambient images={[]} mode="field" />
      <article className="about">
        <header className="page-head">
          <h1>{a.title}</h1>
        </header>
        <p className="about-intro">{a.intro}</p>

        {a.sections.map((s) => (
          <section key={s.heading} className="about-section">
            <h2>{s.heading}</h2>
            {s.items &&
              (s.items.some((i) => i.term) ? (
                <dl className="about-sources">
                  {s.items.map((i) => (
                    <div key={i.term}>
                      <dt>{i.term}</dt>
                      <dd>{i.text}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <ol className="about-steps">
                  {s.items.map((i) => (
                    <li key={i.text}>{i.text}</li>
                  ))}
                </ol>
              ))}
            {s.paragraphs?.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}

        <p className="about-code">
          {a.code.text}{" "}
          <a href={repoUrl} target="_blank" rel="noreferrer">
            {a.code.link}
          </a>
        </p>
      </article>
    </div>
  );
}

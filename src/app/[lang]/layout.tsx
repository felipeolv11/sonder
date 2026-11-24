import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { notFound } from "next/navigation";
import { Toolbar } from "@/components/Toolbar";
import { TrailListener } from "@/components/trail";
import { LocaleProvider } from "@/i18n/client";
import { hasLocale, localeTags, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return {
    title: { default: "Sonder", template: "%s · Sonder" },
    description: getDictionary(lang).meta.description,
    alternates: { languages: Object.fromEntries(locales.map((l) => [localeTags[l], `/${l}`])) },
  };
}

export const viewport: Viewport = {
  themeColor: "#14161c",
  colorScheme: "dark",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);

  return (
    <html lang={localeTags[lang]} className={`${inter.variable} ${newsreader.variable}`}>
      <body>
        <LocaleProvider locale={lang}>
          <a className="skip-link" href="#main">
            {t.nav.skip}
          </a>
          <TrailListener />
          <Toolbar locale={lang} />
          <main id="main">{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}

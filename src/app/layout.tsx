import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { Toolbar } from "@/components/Toolbar";
import "./globals.css";

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

export const metadata: Metadata = {
  title: { default: "Sonder", template: "%s · Sonder" },
  description: "Discover the stories behind the music you love, and the songs that might become your next favorites.",
};

export const viewport: Viewport = {
  themeColor: "#14161c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Toolbar />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}

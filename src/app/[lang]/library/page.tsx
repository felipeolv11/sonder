import type { Metadata } from "next";
import { LibraryView } from "@/components/LibraryView";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/library">): Promise<Metadata> {
  const { lang } = await params;
  return { title: hasLocale(lang) ? getDictionary(lang).library.title : "Library" };
}

/** Favourites, lists and recent history, all read from this browser's storage. */
export default function LibraryPage() {
  return (
    <div className="page">
      <LibraryView />
    </div>
  );
}

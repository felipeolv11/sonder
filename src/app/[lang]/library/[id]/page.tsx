import type { Metadata } from "next";
import { Suspense } from "react";
import { ListView } from "@/components/LibraryView";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type Props = PageProps<"/[lang]/library/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return { title: hasLocale(lang) ? getDictionary(lang).library.lists : "Lists" };
}

/** One saved list. Its contents live in this browser, so the page only passes the id along. */
export default function ListPage({ params }: Props) {
  return (
    <div className="page">
      <Suspense fallback={null}>
        <List params={params} />
      </Suspense>
    </div>
  );
}

async function List({ params }: { params: Props["params"] }) {
  const { id } = await params;
  return <ListView id={id} />;
}

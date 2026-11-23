import type { Metadata } from "next";
import { HistoryList } from "@/components/HistoryList";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/history">): Promise<Metadata> {
  const { lang } = await params;
  return { title: hasLocale(lang) ? getDictionary(lang).meta.history : "History" };
}

export default function HistoryPage() {
  return (
    <div className="page">
      <HistoryList />
    </div>
  );
}

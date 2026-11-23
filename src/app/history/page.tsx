import type { Metadata } from "next";
import { HistoryList } from "@/components/HistoryList";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <div className="page">
      <HistoryList />
    </div>
  );
}

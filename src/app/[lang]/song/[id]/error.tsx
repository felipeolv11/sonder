"use client";

import Link from "next/link";
import { useDictionary, useLocale } from "@/i18n/client";
import { href } from "@/i18n/config";

export default function SongError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useDictionary().errors;
  const locale = useLocale();
  return (
    <div className="page">
      <div className="state">
        <h1>{t.songTitle}</h1>
        <p>{t.songBody}</p>
        <div className="state-actions">
          <button type="button" className="button" onClick={() => reset()}>
            {t.tryAgain}
          </button>
          <Link href={href(locale)} className="button quiet">
            {t.backHome}
          </Link>
        </div>
      </div>
    </div>
  );
}

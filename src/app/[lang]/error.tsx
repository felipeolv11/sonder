"use client";

import { useDictionary } from "@/i18n/client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useDictionary().errors;
  return (
    <div className="page">
      <div className="state">
        <h1>{t.appTitle}</h1>
        <p>{t.appBody}</p>
        <div className="state-actions">
          <button type="button" className="button" onClick={() => reset()}>
            {t.tryAgain}
          </button>
        </div>
      </div>
    </div>
  );
}

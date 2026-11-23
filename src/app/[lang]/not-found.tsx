"use client";

import Link from "next/link";
import { useDictionary, useLocale } from "@/i18n/client";
import { href } from "@/i18n/config";

export default function NotFound() {
  const t = useDictionary().errors;
  const locale = useLocale();
  return (
    <div className="page">
      <div className="state">
        <h1>{t.notFoundTitle}</h1>
        <p>{t.notFoundBody}</p>
        <div className="state-actions">
          <Link href={href(locale)} className="button">
            {t.notFoundCta}
          </Link>
        </div>
      </div>
    </div>
  );
}

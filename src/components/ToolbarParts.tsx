"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDictionary, useLocale } from "@/i18n/client";
import { href } from "@/i18n/config";
import { SearchField } from "./SearchField";

export function ToolbarSearch() {
  const locale = useLocale();
  const onHome = usePathname() === href(locale);
  return <div className="toolbar-search">{!onHome && <SearchField variant="compact" />}</div>;
}

export function NavLinks() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useDictionary();
  const home = href(locale);
  const history = href(locale, "/history");
  return (
    <nav className="toolbar-nav" aria-label={t.nav.main}>
      <Link href={home} aria-current={pathname === home ? "page" : undefined}>
        {t.nav.discover}
      </Link>
      <Link href={history} aria-current={pathname === history ? "page" : undefined}>
        {t.nav.history}
      </Link>
    </nav>
  );
}

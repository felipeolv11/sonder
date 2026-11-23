"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchField } from "./SearchField";

export function ToolbarSearch() {
  const onHome = usePathname() === "/";
  return <div className="toolbar-search">{!onHome && <SearchField variant="compact" />}</div>;
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="toolbar-nav" aria-label="Main">
      <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
        Discover
      </Link>
      <Link href="/history" aria-current={pathname === "/history" ? "page" : undefined}>
        History
      </Link>
    </nav>
  );
}

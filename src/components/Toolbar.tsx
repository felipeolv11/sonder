import Link from "next/link";
import { Suspense } from "react";
import { NavLinks, ToolbarSearch } from "./ToolbarParts";

export function Toolbar() {
  return (
    <header className="toolbar">
      <div className="toolbar-inner">
        <Link href="/" className="brand" aria-label="Sonder home">
          <BrandMark />
          <span>Sonder</span>
        </Link>

        <Suspense fallback={<div className="toolbar-search" />}>
          <ToolbarSearch />
        </Suspense>

        <Suspense
          fallback={
            <nav className="toolbar-nav" aria-label="Main">
              <Link href="/">Discover</Link>
              <Link href="/history">History</Link>
            </nav>
          }
        >
          <NavLinks />
        </Suspense>
      </div>
    </header>
  );
}

function BrandMark() {
  // Two offset rings: a record seen from above, and the ripple of one song leading to the next.
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8" cy="10" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12.5" cy="10" r="6.25" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
      <circle cx="8" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
}

"use client";

import Link from "next/link";

export default function SongError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page">
      <div className="state">
        <h1>This song couldn’t be loaded</h1>
        <p>The music catalogue didn’t respond in time. Check your connection and try again.</p>
        <div className="state-actions">
          <button type="button" className="button" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="button quiet">
            Back to Discover
          </Link>
        </div>
      </div>
    </div>
  );
}

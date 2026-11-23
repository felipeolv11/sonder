import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <div className="state">
        <h1>This song isn’t in the catalogue</h1>
        <p>The link may be out of date, or the recording was removed from Deezer. Search for it by name instead.</p>
        <div className="state-actions">
          <Link href="/" className="button">
            Search for a song
          </Link>
        </div>
      </div>
    </div>
  );
}

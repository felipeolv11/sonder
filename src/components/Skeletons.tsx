export function CoverGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <ul className="cover-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <div className="cover-tile">
            <span className="cover-frame skeleton" />
            <span className="skeleton skeleton-line" style={{ width: "70%" }} />
            <span className="skeleton skeleton-line" style={{ width: "45%" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HeroSkeleton({ label }: { label: string }) {
  return (
    <div className="song-hero" aria-busy="true" aria-label={label}>
      <div className="hero-art skeleton" />
      <div className="hero-meta">
        <span className="skeleton skeleton-line" style={{ width: 140 }} />
        <span className="skeleton skeleton-line" style={{ width: "80%", height: 56, marginTop: 14 }} />
        <span className="skeleton skeleton-line" style={{ width: "55%", marginTop: 26 }} />
        <span className="skeleton skeleton-line" style={{ width: "40%" }} />
      </div>
    </div>
  );
}

export function StorySkeleton({ label }: { label: string }) {
  return (
    <div className="story-loading" aria-busy="true">
      <p className="loading-note">{label}</p>
      {[92, 100, 96, 64, 0, 88, 100, 72].map((w, i) =>
        w ? <span key={i} className="skeleton skeleton-line" style={{ width: `${w}%`, height: 15 }} /> : <br key={i} />,
      )}
    </div>
  );
}

export function RecsSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true">
      <p className="loading-note">{label}</p>
      <CoverGridSkeleton count={5} />
    </div>
  );
}

"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page">
      <div className="state">
        <h1>Something went wrong loading this page</h1>
        <p>A music service didn’t respond as expected. Try again in a moment.</p>
        <div className="state-actions">
          <button type="button" className="button" onClick={() => reset()}>
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

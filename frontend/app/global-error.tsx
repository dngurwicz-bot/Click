"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>שגיאה בלתי צפויה</h2>
          <button onClick={reset}>נסה שוב</button>
        </div>
      </body>
    </html>
  );
}

"use client";

/**
 * Root error boundary — the last resort.
 *
 * Catches failures in the root layout itself, where `error.tsx` cannot help
 * because the layout that would wrap it is the thing that failed. It therefore
 * has to render its own <html> and <body>, and cannot use any shared component
 * or design token — those live in files that may be exactly what broke.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "1rem",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#56506b", marginBottom: "1.5rem" }}>
            The site could not be loaded. Please try again shortly.
          </p>
          {/* A plain anchor on purpose, not next/link. The root layout is
              what failed, so a client-side navigation would re-render into the
              same broken tree; only a full document load recovers. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ color: "#6d28d9" }}>
            Reload the site
          </a>
          {error.digest ? (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#56506b" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}

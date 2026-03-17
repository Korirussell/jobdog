'use client';

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
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="font-mono text-2xl font-bold">
              ⚠ CRITICAL_ERROR
            </h1>
            <p className="mt-4 font-mono text-sm">
              Application encountered a critical error
            </p>
            <button
              onClick={reset}
              className="mt-6 border-2 border-black bg-white px-6 py-2 font-mono text-sm font-bold uppercase"
            >
              RELOAD_APP
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

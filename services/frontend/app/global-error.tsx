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
        <div className="flex min-h-screen items-center justify-center bg-[#0b1b3a] px-6">
          <div className="max-w-xl border-2 border-white/40 bg-[#0f2552] p-6 text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,0.35)]">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/70">Blue Screen</p>
            <h1 className="mt-3 font-mono text-2xl font-bold">CRITICAL SYSTEM ERROR</h1>
            <p className="mt-4 font-mono text-sm text-white/80">
              The JobDog runtime encountered a fatal exception and must restart.
            </p>
            <p className="mt-4 font-mono text-xs text-white/60">
              Please refresh. If this persists, report incident ID to support.
            </p>
            <button
              onClick={reset}
              className="mt-6 border-2 border-white/70 bg-white/10 px-5 py-2 font-mono text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/20"
            >
              RELOAD_APP
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

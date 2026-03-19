'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1b3a] px-6">
      <div className="max-w-xl border-2 border-white/40 bg-[#0f2552] p-6 text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,0.35)]">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/70">Kernel Panic</p>
        <h1 className="mt-3 font-mono text-2xl font-bold">PAGE FAULT</h1>
        <p className="mt-4 font-mono text-sm text-white/80">
          {error.message || 'The system encountered an unexpected page fault.'}
        </p>
        <p className="mt-4 font-mono text-xs text-white/60">
          Press RESTART to reload the session. If the issue persists, contact support.
        </p>
        <button
          onClick={reset}
          className="mt-6 border-2 border-white/70 bg-white/10 px-5 py-2 font-mono text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/20"
        >
          RESTART
        </button>
      </div>
    </div>
  );
}

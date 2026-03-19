'use client';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1b3a] px-6">
      <div className="max-w-xl border-2 border-white/40 bg-[#0f2552] p-6 text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,0.35)]">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/70">System Error</p>
        <h1 className="mt-3 font-mono text-2xl font-bold">404 — PAGE NOT FOUND</h1>
        <p className="mt-4 font-mono text-sm text-white/80">
          The requested memory address does not exist in this segment.
        </p>
        <a
          href="/"
          className="mt-6 inline-block border-2 border-white/70 bg-white/10 px-5 py-2 font-mono text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/20"
        >
          RETURN_HOME
        </a>
      </div>
    </div>
  );
}

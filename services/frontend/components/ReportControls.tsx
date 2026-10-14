'use client';

import type { ReportVerdict } from '@/lib/api';

interface ReportControlsProps {
  // The signed-in user's existing verdict on this listing, if any.
  verdict?: ReportVerdict | null;
  // Set right after they opened the listing, when they actually know the answer.
  prompt?: boolean;
  onReport: (verdict: ReportVerdict) => void;
}

// "Did the link work?" — two taps that tell us whether a listing is real, and
// earn the user resume uploads (see JobReportService on the backend).
export default function ReportControls({ verdict, prompt, onReport }: ReportControlsProps) {
  const base = 'border px-2 py-1 font-mono text-[10px] font-bold transition-colors';

  return (
    <div className={`flex items-center gap-1.5 ${prompt ? 'rounded-sm bg-primary/10 px-1.5 py-1' : ''}`}>
      <span className="font-mono text-[10px] text-text-tertiary">
        {prompt && !verdict ? 'Did the link work?' : 'Link:'}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onReport('WORKS'); }}
        aria-pressed={verdict === 'WORKS'}
        title="This listing's apply link goes to a real, open job"
        className={`${base} ${verdict === 'WORKS'
          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
          : 'border-black/20 bg-white text-text-secondary hover:border-emerald-600 hover:text-emerald-700'}`}
      >
        ✓ Works
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onReport('DEAD'); }}
        aria-pressed={verdict === 'DEAD'}
        title="The page is gone, closed, or not an actual listing"
        className={`${base} ${verdict === 'DEAD'
          ? 'border-red-600 bg-red-50 text-red-700'
          : 'border-black/20 bg-white text-text-secondary hover:border-red-600 hover:text-red-700'}`}
      >
        ✗ Dead
      </button>
    </div>
  );
}

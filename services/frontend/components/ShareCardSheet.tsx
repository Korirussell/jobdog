'use client';

import { useMemo, useState } from 'react';

interface ShareCardSheetProps {
  score: number;
  tierLabel: string;
  pros: string[];
  jobFit?: string;
  percentile?: number;
  handle?: string;
  onClose: () => void;
}

export function ShareCardSheet({ score, tierLabel, pros, jobFit, percentile, handle, onClose }: ShareCardSheetProps) {
  const [ratio, setRatio] = useState<'9:16' | '1:1'>('1:1');
  const [showPros, setShowPros] = useState(true);
  const [showJobFit, setShowJobFit] = useState(Boolean(jobFit));
  const [showPercentile, setShowPercentile] = useState(Boolean(percentile));
  const [showHandle, setShowHandle] = useState(Boolean(handle));

  const imageUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('score', String(score));
    params.set('tier', tierLabel);
    params.set('ratio', ratio);
    if (showPros && pros.length > 0) params.set('pros', pros.slice(0, 3).join('|'));
    if (showJobFit && jobFit) params.set('jobFit', jobFit);
    if (showPercentile && percentile != null) params.set('percentile', String(percentile));
    if (showHandle && handle) params.set('handle', handle);
    return `/api/og/resume-card?${params.toString()}`;
  }, [score, tierLabel, ratio, showPros, showJobFit, showPercentile, showHandle, pros, jobFit, percentile, handle]);

  async function handleDownload() {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jobdog-score-${score}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Share your score</h2>
          <button onClick={onClose} className="text-gray-500">Close</button>
        </div>

        <img src={imageUrl} alt="Share card preview" className="mb-4 w-full rounded-lg border" />

        <div className="mb-4 flex gap-2">
          <button
            className={`flex-1 rounded-md border px-3 py-2 text-sm ${ratio === '1:1' ? 'bg-black text-white' : ''}`}
            onClick={() => setRatio('1:1')}
          >
            LinkedIn (1:1)
          </button>
          <button
            className={`flex-1 rounded-md border px-3 py-2 text-sm ${ratio === '9:16' ? 'bg-black text-white' : ''}`}
            onClick={() => setRatio('9:16')}
          >
            Story (9:16)
          </button>
        </div>

        <div className="mb-4 space-y-2 text-sm">
          {pros.length > 0 && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showPros} onChange={(e) => setShowPros(e.target.checked)} />
              Top 3 pros
            </label>
          )}
          {jobFit && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showJobFit} onChange={(e) => setShowJobFit(e.target.checked)} />
              Best job-fit score
            </label>
          )}
          {percentile != null && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showPercentile} onChange={(e) => setShowPercentile(e.target.checked)} />
              Percentile among JobDog users
            </label>
          )}
          {handle && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showHandle} onChange={(e) => setShowHandle(e.target.checked)} />
              Show my handle
            </label>
          )}
        </div>

        <button onClick={handleDownload} className="w-full rounded-md bg-black px-4 py-2 text-white">
          Download image
        </button>
      </div>
    </div>
  );
}

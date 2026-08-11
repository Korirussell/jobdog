'use client';

import { useEffect, useMemo, useState } from 'react';

interface ShareCardSheetProps {
  score: number;
  tierLabel: string;
  pros: string[];
  jobFit?: string;
  percentile?: number;
  handle?: string;
  subScores?: Record<string, number>;
  onClose: () => void;
}

export function ShareCardSheet({ score, tierLabel, pros, jobFit, percentile, handle, subScores, onClose }: ShareCardSheetProps) {
  const hasSubScores = Boolean(subScores && Object.keys(subScores).length > 0);

  const [ratio, setRatio] = useState<'9:16' | '1:1'>('1:1');
  const [showPros, setShowPros] = useState(true);
  const [showJobFit, setShowJobFit] = useState(Boolean(jobFit));
  const [showPercentile, setShowPercentile] = useState(Boolean(percentile));
  const [showHandle, setShowHandle] = useState(Boolean(handle));
  const [showSubScores, setShowSubScores] = useState(hasSubScores);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const imageUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('score', String(score));
    params.set('tier', tierLabel);
    params.set('ratio', ratio);
    if (showPros && pros.length > 0) params.set('pros', pros.slice(0, 3).join('|'));
    if (showJobFit && jobFit) params.set('jobFit', jobFit);
    if (showPercentile && percentile != null) params.set('percentile', String(percentile));
    if (showHandle && handle) params.set('handle', handle);
    if (showSubScores && subScores) {
      // Encoding: "key:value|key:value", value rounded to a 0-100 integer.
      // URLSearchParams percent-encodes the whole thing on toString().
      const encoded = Object.entries(subScores)
        .filter(([, value]) => Number.isFinite(value))
        .map(([key, value]) => `${key}:${Math.round(Math.max(0, Math.min(100, value)))}`)
        .join('|');
      if (encoded) params.set('subScores', encoded);
    }
    return `/og/resume-card?${params.toString()}`;
  }, [score, tierLabel, ratio, showPros, showJobFit, showPercentile, showHandle, showSubScores, pros, jobFit, percentile, handle, subScores]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `jobdog-score-${score}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setDownloading(false);
    }
  }

  const toggles: Array<{ key: string; checked: boolean; set: (v: boolean) => void; label: string }> = [];
  if (pros.length > 0) toggles.push({ key: 'pros', checked: showPros, set: setShowPros, label: 'Top 3 pros' });
  if (hasSubScores) toggles.push({ key: 'subScores', checked: showSubScores, set: setShowSubScores, label: 'Sub-score breakdown' });
  if (jobFit) toggles.push({ key: 'jobFit', checked: showJobFit, set: setShowJobFit, label: 'Best job-fit score' });
  if (percentile != null) toggles.push({ key: 'percentile', checked: showPercentile, set: setShowPercentile, label: 'Percentile among JobDog users' });
  if (handle) toggles.push({ key: 'handle', checked: showHandle, set: setShowHandle, label: 'Show my handle' });

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center overflow-hidden px-4 backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm border-[3px] border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between border-b-[3px] border-black bg-primary px-4 py-2">
          <div>
            <h2 className="font-mono text-sm font-bold uppercase">Share your score</h2>
            <p className="font-mono text-[10px] text-text-secondary">Score {score}/100 — {tierLabel.replace(/_/g, ' ')}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-5 w-5 shrink-0 items-center justify-center border-2 border-black bg-white font-mono text-xs font-bold hover:bg-background"
          >
            ×
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-5">
          <img
            src={imageUrl}
            alt="Share card preview"
            className="mb-4 w-full border-2 border-black"
          />

          <div className="mb-4 flex gap-2">
            <button
              className={`flex-1 border-2 px-3 py-2 font-mono text-xs font-bold uppercase transition-all ${
                ratio === '1:1'
                  ? 'border-black bg-primary text-text-primary shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : 'border-black/20 bg-white text-text-secondary hover:border-black/40'
              }`}
              onClick={() => setRatio('1:1')}
            >
              LinkedIn (1:1)
            </button>
            <button
              className={`flex-1 border-2 px-3 py-2 font-mono text-xs font-bold uppercase transition-all ${
                ratio === '9:16'
                  ? 'border-black bg-primary text-text-primary shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                  : 'border-black/20 bg-white text-text-secondary hover:border-black/40'
              }`}
              onClick={() => setRatio('9:16')}
            >
              Story (9:16)
            </button>
          </div>

          {toggles.length > 0 && (
            <div className="mb-4 space-y-1.5">
              <p className="font-mono text-[10px] font-bold uppercase text-text-tertiary">What to include</p>
              {toggles.map((t) => (
                <label
                  key={t.key}
                  className="flex cursor-pointer items-center gap-2.5 border-2 border-black/15 px-3 py-2 transition-all hover:border-black/30"
                >
                  <input
                    type="checkbox"
                    checked={t.checked}
                    onChange={(e) => t.set(e.target.checked)}
                    className="accent-black shrink-0"
                  />
                  <span className="font-mono text-xs font-bold text-text-primary">{t.label}</span>
                </label>
              ))}
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full border-2 border-black bg-primary px-4 py-2.5 font-mono text-sm font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
          >
            {downloading ? 'Preparing…' : 'Download Image'}
          </button>
        </div>
      </div>
    </div>
  );
}

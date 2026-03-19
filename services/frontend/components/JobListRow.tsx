'use client';

import { memo, useState } from 'react';

interface JobListRowProps {
  jobId: string;
  company: string;
  title: string;
  location: string;
  employmentType: string;
  techStack?: string[];
  postedAt: string | null;
  scrapedAt: string;
  jobStatus?: string;
  matchPercentile?: number;
  applyUrl: string;
  alreadyApplied?: boolean;
  isSaved?: boolean;
  onApply?: (jobId: string) => void;
  onSave?: (jobId: string, saved: boolean) => void;
}

function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0 || diffMs > 365 * 24 * 60 * 60 * 1000) return '';
  const h = Math.floor(diffMs / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

const JobListRow = memo(function JobListRow({
  jobId,
  company,
  title,
  location,
  employmentType,
  techStack = [],
  postedAt,
  scrapedAt,
  jobStatus,
  matchPercentile,
  applyUrl,
  alreadyApplied = false,
  isSaved = false,
  onApply,
  onSave,
}: JobListRowProps) {
  const [saved, setSaved] = useState(isSaved);
  const [savePending, setSavePending] = useState(false);

  const timeLabel = formatTimeAgo(postedAt) || (scrapedAt ? `~${formatTimeAgo(scrapedAt)}` : '');
  const isClosed = jobStatus === 'CLOSED';
  const canApply = !isClosed && !alreadyApplied;

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSave || savePending) return;
    setSavePending(true);
    const next = !saved;
    setSaved(next);
    try {
      await onSave(jobId, next);
    } catch {
      setSaved(!next); // revert on error
    } finally {
      setSavePending(false);
    }
  };

  const isNew = (() => {
    const d = postedAt ? new Date(postedAt) : new Date(scrapedAt);
    return !isNaN(d.getTime()) && Date.now() - d.getTime() < 24 * 60 * 60 * 1000;
  })();

  return (
    <div
      className={`
        group border-b border-black/8 px-4 py-5 transition-colors
        hover:bg-black/[0.018]
        ${isClosed ? 'opacity-50' : ''}
        ${isNew ? 'border-l-2 border-l-primary' : ''}
      `}
    >
      <div className="flex items-start gap-4">
        {/* New pulse */}
        {isNew && (
          <div className="mt-1.5 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Company */}
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-text-tertiary">
            {company}
          </p>
          {/* Title */}
          <h3 className="mt-0.5 text-base font-bold text-text-primary leading-snug">
            {title}
          </h3>
          {/* Meta */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-text-secondary">
            {location && (
              <span className="flex items-center gap-1">
                <svg className="h-3 w-3 shrink-0 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {location}
              </span>
            )}
            {timeLabel && (
              <>
                <span className="text-black/20">·</span>
                <span className="text-text-tertiary">{timeLabel}</span>
              </>
            )}
            {alreadyApplied && (
              <>
                <span className="text-black/20">·</span>
                <span className="font-bold text-emerald-600">✓ Applied</span>
              </>
            )}
            {isClosed && (
              <>
                <span className="text-black/20">·</span>
                <span className="font-bold text-red-500">Closed</span>
              </>
            )}
          </div>

          {/* Tech stack tags */}
          {techStack.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {techStack.slice(0, 5).map((tech) => (
                <span key={tech} className="border border-black/12 bg-black/[0.03] px-2 py-0.5 font-mono text-[10px] font-bold text-text-secondary">
                  {tech}
                </span>
              ))}
              {techStack.length > 5 && (
                <span className="font-mono text-[10px] text-text-tertiary">+{techStack.length - 5}</span>
              )}
            </div>
          )}
        </div>

        {/* Right: match + actions */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {matchPercentile !== undefined && (
            <span className="border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-text-primary">
              {matchPercentile}% match
            </span>
          )}

          <div className="flex items-center gap-2">
            {/* Save / bookmark */}
            {onSave && (
              <button
                onClick={handleSave}
                disabled={savePending}
                title={saved ? 'Unsave job' : 'Save job'}
                className={`flex h-8 w-8 items-center justify-center border transition-all
                  ${saved
                    ? 'border-primary bg-primary/10 text-text-primary hover:bg-primary/20'
                    : 'border-black/20 bg-white text-text-tertiary hover:border-black/40 hover:text-text-primary'
                  }
                  disabled:opacity-40`}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill={saved ? 'currentColor' : 'none'}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
            )}
            {onApply && canApply && (
              <button
                onClick={(e) => { e.stopPropagation(); onApply(jobId); }}
                className="border-2 border-black bg-primary px-3 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              >
                Apply
              </button>
            )}
            <a
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="border border-black/20 bg-white px-3 py-1.5 font-mono text-xs font-bold text-text-secondary transition-all hover:border-black/40 hover:text-text-primary"
            >
              View ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.applyUrl === next.applyUrl &&
  prev.postedAt === next.postedAt &&
  prev.alreadyApplied === next.alreadyApplied &&
  prev.jobStatus === next.jobStatus &&
  prev.isSaved === next.isSaved
);

export default JobListRow;

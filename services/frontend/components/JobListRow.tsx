'use client';

import { memo } from 'react';

interface JobListRowProps {
  company: string;
  title: string;
  location: string;
  employmentType: string;
  techStack?: string[];
  scrapedAt: string;
  matchPercentile?: number;
  applyUrl: string;
}

const JobListRow = memo(function JobListRow({
  company,
  title,
  location,
  employmentType,
  techStack = [],
  scrapedAt,
  matchPercentile,
  applyUrl,
}: JobListRowProps) {
  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return 'UNKNOWN';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'UNKNOWN';
    
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    
    // If date is in the future or too far in the past, show unknown
    if (diffInMs < 0 || diffInMs > 365 * 24 * 60 * 60 * 1000) return 'UNKNOWN';
    
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'JUST_NOW';
    if (diffInHours < 24) return `${diffInHours}H_AGO`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}D_AGO`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}W_AGO`;
    return `${Math.floor(diffInDays / 30)}M_AGO`;
  };

  // Check if job is new (< 24 hours from posting)
  const isNew = () => {
    const date = new Date(scrapedAt); // scrapedAt contains postedAt from backend
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    return diffInHours < 24;
  };

  const jobIsNew = isNew();

  return (
    <a
      href={applyUrl}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.open(applyUrl, '_blank', 'noopener,noreferrer');
        }
      }}
      aria-label={`${title} at ${company} - ${location}`}
      className={`
        group flex cursor-pointer flex-col gap-3 border-b-2 border-black/10
        px-4 py-5 transition-all
        hover:border-black/20 hover:bg-background-secondary
        ${jobIsNew ? 'border-l-4 border-l-primary bg-primary/5' : ''}
      `}
    >
      {/* Top Row: Company (Emphasized) & Metadata */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Company Name - Primary Focus */}
          <h3 className="text-xl font-bold text-text-primary">
            {company}
          </h3>
          {/* Job Title - Secondary */}
          <p className="font-mono text-sm font-medium text-text-secondary">
            {title}
          </p>
        </div>
        
        {/* Right: Time & Match Badge */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            {jobIsNew && (
              <span className="animate-pulse font-mono text-sm font-bold text-primary">
                *
              </span>
            )}
            <span className="font-mono text-xs font-bold uppercase text-text-secondary">
              {formatTimeAgo(scrapedAt)}
            </span>
          </div>
          {matchPercentile !== undefined && (
            <div className="flex items-center gap-1 rounded border-2 border-primary bg-primary-light px-2 py-0.5">
              <span className="font-mono text-sm font-bold text-text-primary">
                {matchPercentile}%
              </span>
              <span className="font-mono text-[10px] font-bold uppercase text-text-secondary">
                MATCH
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Location & Type */}
      <div className="flex items-center gap-3 font-mono text-xs uppercase text-text-secondary">
        <span className="flex items-center gap-1">
          <span>📍</span>
          <span>{location}</span>
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <span>💼</span>
          <span>{employmentType}</span>
        </span>
      </div>

      {/* Tech Stack Tags (if available) */}
      {techStack.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {techStack.slice(0, 5).map((tech) => (
            <span
              key={tech}
              className="
                border-2 border-black/20 bg-white px-2 py-1
                font-mono text-xs font-bold uppercase text-text-primary
                shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)]
              "
            >
              {tech}
            </span>
          ))}
          {techStack.length > 5 && (
            <span className="font-mono text-xs font-bold text-text-tertiary">
              +{techStack.length - 5}
            </span>
          )}
        </div>
      )}
    </a>
  );
}, (prevProps, nextProps) => {
  // Only re-render if job data actually changed
  return prevProps.applyUrl === nextProps.applyUrl &&
         prevProps.scrapedAt === nextProps.scrapedAt &&
         prevProps.matchPercentile === nextProps.matchPercentile;
});

export default JobListRow;

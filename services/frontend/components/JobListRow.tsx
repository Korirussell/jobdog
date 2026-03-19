'use client';

import { memo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// Map company names to known domains for logo lookup
const COMPANY_DOMAINS: Record<string, string> = {
  'google': 'google.com', 'meta': 'meta.com', 'facebook': 'facebook.com',
  'amazon': 'amazon.com', 'apple': 'apple.com', 'microsoft': 'microsoft.com',
  'netflix': 'netflix.com', 'stripe': 'stripe.com', 'airbnb': 'airbnb.com',
  'uber': 'uber.com', 'lyft': 'lyft.com', 'twitter': 'twitter.com', 'x': 'x.com',
  'linkedin': 'linkedin.com', 'salesforce': 'salesforce.com', 'adobe': 'adobe.com',
  'nvidia': 'nvidia.com', 'intel': 'intel.com', 'amd': 'amd.com',
  'shopify': 'shopify.com', 'coinbase': 'coinbase.com', 'doordash': 'doordash.com',
  'robinhood': 'robinhood.com', 'plaid': 'plaid.com', 'databricks': 'databricks.com',
  'figma': 'figma.com', 'notion': 'notion.so', 'discord': 'discord.com',
  'duolingo': 'duolingo.com', 'instacart': 'instacart.com', 'snowflake': 'snowflake.com',
  'twilio': 'twilio.com', 'zendesk': 'zendesk.com', 'zoom': 'zoom.us',
  'cloudflare': 'cloudflare.com', 'okta': 'okta.com', 'mongodb': 'mongodb.com',
  'palantir': 'palantir.com', 'reddit': 'reddit.com', 'ramp': 'ramp.com',
  'anduril': 'anduril.com', 'scale ai': 'scale.com', 'brex': 'brex.com',
  'rippling': 'rippling.com', 'gusto': 'gusto.com', 'retool': 'retool.com',
  'airtable': 'airtable.com', 'confluent': 'confluent.io', 'samsara': 'samsara.com',
  'pagerduty': 'pagerduty.com', 'hashicorp': 'hashicorp.com', 'mixpanel': 'mixpanel.com',
  'coursera': 'coursera.org', 'benchling': 'benchling.com', 'chime': 'chime.com',
  'lattice': 'lattice.com', 'checkr': 'checkr.com', 'navan': 'navan.com',
  'roku': 'roku.com', 'spotify': 'spotify.com', 'slack': 'slack.com',
  'dropbox': 'dropbox.com', 'box': 'box.com', 'atlassian': 'atlassian.com',
  'github': 'github.com', 'gitlab': 'gitlab.com', 'datadog': 'datadoghq.com',
  'splunk': 'splunk.com', 'elastic': 'elastic.co', 'twitch': 'twitch.tv',
  'bytedance': 'bytedance.com', 'tiktok': 'tiktok.com', 'openai': 'openai.com',
  'anthropic': 'anthropic.com', 'cohere': 'cohere.com', 'hugging face': 'huggingface.co',
  'vercel': 'vercel.com', 'netlify': 'netlify.com', 'heroku': 'heroku.com',
  'digitalocean': 'digitalocean.com', 'linode': 'linode.com', 'fastly': 'fastly.com',
  'cloudinary': 'cloudinary.com', 'segment': 'segment.com', 'amplitude': 'amplitude.com',
  'cockroach labs': 'cockroachlabs.com', 'dbt labs': 'getdbt.com',
};

function getCompanyDomain(company: string): string | null {
  const key = company.toLowerCase().trim();
  if (COMPANY_DOMAINS[key]) return COMPANY_DOMAINS[key];
  // Try partial match
  for (const [k, v] of Object.entries(COMPANY_DOMAINS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  // Fallback: guess domain from company name
  const slug = key.replace(/[^a-z0-9]/g, '');
  return slug.length > 2 ? `${slug}.com` : null;
}

function CompanyLogo({ company }: { company: string }) {
  const [failed, setFailed] = useState(false);
  const domain = getCompanyDomain(company);
  if (!domain || failed) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-black/5 font-mono text-[10px] font-bold text-text-tertiary">
        {company.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden bg-white border border-black/8">
      <Image
        src={`https://logo.clearbit.com/${domain}`}
        alt={`${company} logo`}
        width={28}
        height={28}
        className="h-7 w-7 object-contain"
        onError={() => setFailed(true)}
        unoptimized
      />
    </div>
  );
}

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
  detailHref?: string;
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
  detailHref,
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
      {/* Main row — content left, actions right on desktop; stacked on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        {/* New pulse + content */}
        <div className="flex min-w-0 flex-1 gap-3">
          {isNew && (
            <div className="mt-1.5 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            </div>
          )}

          {/* Company logo */}
          <div className="mt-0.5 shrink-0">
            <CompanyLogo company={company} />
          </div>

          <div className="min-w-0 flex-1">
            {/* Company */}
            <p className="font-mono text-xs font-bold uppercase tracking-wide text-text-tertiary">
              {company}
            </p>
            {detailHref ? (
              <Link href={detailHref} className="mt-0.5 block text-base font-bold leading-snug text-text-primary hover:underline">
                {title}
              </Link>
            ) : (
              <h3 className="mt-0.5 text-base font-bold text-text-primary leading-snug">
                {title}
              </h3>
            )}
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
        </div>

        {/* Actions — right side on desktop, bottom row on mobile */}
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          {matchPercentile !== undefined && (
            <span className="border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-text-primary">
              {matchPercentile}% match
            </span>
          )}

          <div className="flex items-center gap-2">
            {/* Save / bookmark — 44px touch target */}
            {onSave && (
              <button
                onClick={handleSave}
                disabled={savePending}
                title={saved ? 'Unsave job' : 'Save job'}
                className={`flex h-11 w-11 items-center justify-center border transition-all sm:h-9 sm:w-9
                  ${saved
                    ? 'border-primary bg-primary/10 text-text-primary hover:bg-primary/20'
                    : 'border-black/20 bg-white text-text-tertiary hover:border-black/40 hover:text-text-primary'
                  }
                  disabled:opacity-40`}
              >
                <svg
                  className="h-4 w-4"
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
                className="border-2 border-black bg-primary px-4 py-2.5 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none sm:py-1.5"
              >
                Apply
              </button>
            )}
            {detailHref ? (
              <Link
                href={detailHref}
                onClick={(e) => e.stopPropagation()}
                className="border border-black/20 bg-white px-4 py-2.5 font-mono text-xs font-bold text-text-secondary transition-all hover:border-black/40 hover:text-text-primary sm:py-1.5"
              >
                View
              </Link>
            ) : (
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="border border-black/20 bg-white px-4 py-2.5 font-mono text-xs font-bold text-text-secondary transition-all hover:border-black/40 hover:text-text-primary sm:py-1.5"
              >
                View ↗
              </a>
            )}
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

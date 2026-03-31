import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { createJobMetadataDescription, fetchJob, getSiteUrl } from '@/lib/public-jobs';

export const revalidate = 300;

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

/**
 * Generates dynamic metadata for job detail pages.
 * Creates SEO-optimized title, description, and Open Graph tags.
 * Used by Next.js for server-side meta tag generation.
 * 
 * @param params Dynamic route parameters containing jobId
 * @returns Metadata object with title, description, canonical URL, and social tags
 */
export async function generateMetadata({ params }: { params: Promise<{ jobId: string }> }): Promise<Metadata> {
  const { jobId } = await params;

  try {
    const job = await fetchJob(jobId, { next: { revalidate } });
    const title = `${job.title} at ${job.company} | JobDog`;
    const description = createJobMetadataDescription(job);
    const canonical = getSiteUrl(`/jobs/${job.jobId}`);

    return {
      title,
      description,
      alternates: {
        canonical,
      },
      openGraph: {
        title,
        description,
        url: canonical,
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    };
  } catch {
    return {
      title: 'Job Not Found | JobDog',
      description: 'This job listing is no longer available.',
    };
  }
}

/**
 * Server-rendered job detail page with full description.
 * Implements ISR with 5-minute revalidation for fresh content.
 * Triggers Next.js notFound() if job doesn't exist.
 * 
 * @param params Dynamic route parameters containing jobId
 * @returns Server component with complete job details
 */
export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  let job;
  try {
    job = await fetchJob(jobId, { next: { revalidate } });
  } catch {
    notFound();
  }

  const postedLabel = formatDate(job.postedAt);
  const scrapedLabel = formatDate(job.scrapedAt);

  return (
    <div className="min-h-screen bg-white">
      <TopBar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <Link href="/" className="font-mono text-xs font-bold text-text-secondary hover:text-text-primary">
            ← Back to jobs
          </Link>
        </div>

        <article className="border border-black/10 bg-white p-6 shadow-sm">
          <header className="border-b border-black/8 pb-6">
            <p className="font-mono text-xs font-bold uppercase tracking-wide text-text-tertiary">{job.company}</p>
            <h1 className="mt-2 text-3xl font-bold text-text-primary">{job.title}</h1>
            <div className="mt-4 flex flex-wrap gap-3 font-mono text-sm text-text-secondary">
              {job.location && <span>{job.location}</span>}
              {job.employmentType && <span>{job.employmentType}</span>}
              {postedLabel && <span>Posted {postedLabel}</span>}
              {scrapedLabel && <span>Synced {scrapedLabel}</span>}
            </div>
            <div className="mt-6">
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex border-2 border-black bg-primary px-4 py-2 font-mono text-xs font-bold text-text-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              >
                Apply ↗
              </a>
            </div>
          </header>

          <section className="prose prose-sm max-w-none pt-6 text-text-primary">
            <div className="whitespace-pre-wrap leading-7">{job.description}</div>
          </section>
        </article>
      </main>
    </div>
  );
}

import type { Metadata } from 'next';
import HomePageClient from '@/components/HomePageClient';
import { buildJobsSearchParams, fetchJobs } from '@/lib/public-jobs';

const PAGE_SIZE = 100;
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Intern & New Grad Jobs | JobDog',
  description: 'Browse active internship and new grad software roles with crawlable job pages and fresh listings from JobDog.',
};

type HomeSearchParams = {
  page?: string;
  location?: string;
  remote?: string;
  company?: string;
  search?: string;
  tab?: string;
  companyTier?: string;
  gradYear?: string;
  hasSalary?: string;
  sweOnly?: string;
};

// entry_type values a posting can carry — see scraper.EntryType. The "New Grad"
// tab means "cohort-gated or open entry-level", not one single type, which is
// why this is a list rather than an equality check.
const INTERN_ENTRY_TYPES = 'INTERN';
const NEW_GRAD_ENTRY_TYPES = 'NEW_GRAD_COHORT,ENTRY_LEVEL_OPEN';

/**
 * Maps the UI's Intern/New Grad tab onto the backend's entryTypes filter.
 *
 * This filtering has to happen server-side, not client-side over whatever page
 * happens to be loaded: with 1,000+ active postings and only ~100 fetched per
 * page, a client-side filter can easily find zero matches for a real, existing
 * combination (e.g. New Grad + Class of 2027) simply because none of them landed
 * on the current page — while the backend, querying the full table, finds them
 * immediately. See JobFilterRequest/JobRepository for the equivalent server logic.
 */
function entryTypesForTab(tab: string | undefined): string | undefined {
  if (tab === 'newgrad') return NEW_GRAD_ENTRY_TYPES;
  // Default (including 'intern' or anything unrecognized) is the Internships tab.
  return INTERN_ENTRY_TYPES;
}

/**
 * Server-rendered home page displaying paginated job listings.
 * Implements Next.js 15 async searchParams pattern with ISR (revalidate: 300s).
 * Fetches initial data server-side for SEO and fast initial page load.
 *
 * All filtering (tab, location, remote, company, search, grad year, company
 * tier, compensation) is expressed as URL search params and applied server-side
 * against the full dataset — see entryTypesForTab above for why that matters.
 *
 * @param searchParams Async search parameters from URL
 * @returns Server component with pre-fetched job data passed to client component
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const resolved = await searchParams;
  const page = Number.parseInt(resolved.page ?? '0', 10);
  const safePage = Number.isNaN(page) || page < 0 ? 0 : page;
  const params = buildJobsSearchParams({
    page: String(safePage),
    size: String(PAGE_SIZE),
    location: resolved.location,
    remote: resolved.remote,
    company: resolved.company,
    search: resolved.search,
    entryTypes: entryTypesForTab(resolved.tab),
    gradYear: resolved.tab === 'newgrad' ? resolved.gradYear : undefined,
    companyTier: resolved.companyTier,
    hasSalary: resolved.hasSalary,
    sweOnly: resolved.sweOnly,
  });
  const data = await fetchJobs(params, { next: { revalidate } });

  return (
    <HomePageClient
      initialJobs={data.items}
      initialTotal={data.total}
      initialLastSync={data.lastSync ?? null}
      initialPage={safePage}
      pageSize={PAGE_SIZE}
    />
  );
}

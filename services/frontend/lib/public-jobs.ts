export interface JobSummary {
  jobId: string;
  title: string;
  company: string;
  location: string;
  employmentType: string;
  postedAt: string | null;
  scrapedAt: string;
  jobStatus: string;
  applyUrl: string;
  matchPercentage?: number | null;
  companyTier: string | null;
  ghostScore: number | null;
  experienceLevel: string | null;
  // "NEW_GRAD_COHORT" | "ENTRY_LEVEL_OPEN" | "INTERN" | "EXPERIENCED" | null.
  // NEW_GRAD_COHORT is a role gated on a graduation window (gradYearMin/Max);
  // ENTRY_LEVEL_OPEN is a junior role anyone can apply to, no cohort gate.
  entryType: string | null;
  gradYearMin: number | null;
  gradYearMax: number | null;
  salaryRaw: string | null;
}

export interface JobsResponse {
  items: JobSummary[];
  page: number;
  size: number;
  total: number;
  lastSync?: string;
}

export interface JobDetail extends JobSummary {
  description: string;
  // The sentence the classifier based entryType on, when the model pass ran.
  // Null for deterministic-only verdicts and for jobs still unclassified.
  gradEvidence: string | null;
}

function getApiOrigin() {
  const origin = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!origin) {
    throw new Error('BACKEND_URL or NEXT_PUBLIC_API_URL is required');
  }
  return origin;
}

function getSiteOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://jobdog.dev';
}

export function getSiteUrl(path = '') {
  const origin = getSiteOrigin().replace(/\/$/, '');
  return path ? `${origin}${path.startsWith('/') ? path : `/${path}`}` : origin;
}

/**
 * Fetches paginated job listings from the backend API.
 * Used by Server Components for SSR with automatic revalidation.
 * Gracefully handles backend failures by returning empty results.
 * 
 * @param params URL search parameters for filtering (page, size, location, remote, company, search)
 * @param init Optional fetch configuration (headers, cache, revalidation)
 * @returns Paginated job response with items, total count, and last sync timestamp
 */
export async function fetchJobs(params: URLSearchParams, init?: RequestInit): Promise<JobsResponse> {
  const qs = params.toString();
  try {
    const response = await fetch(`${getApiOrigin()}/api/v1/jobs${qs ? `?${qs}` : ''}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch jobs: ${response.status}`);
    }

    return response.json();
  } catch (e) {
    // Important: this function is used by Server Components (Home + sitemap).
    // If the backend is down/unreachable, don't crash the whole app—return an empty list.
    const pageRaw = params.get('page');
    const sizeRaw = params.get('size');
    const page = pageRaw ? Number(pageRaw) : 0;
    const size = sizeRaw ? Number(sizeRaw) : 100;
    return {
      items: [],
      page: Number.isNaN(page) ? 0 : page,
      size: Number.isNaN(size) ? 100 : size,
      total: 0,
      lastSync: undefined,
    };
  }
}

/**
 * Fetches full details for a specific job by ID.
 * Used by dynamic job detail pages for SEO-friendly content.
 * Throws on 404 to trigger Next.js notFound() handler.
 * 
 * @param jobId Unique job identifier (UUID)
 * @param init Optional fetch configuration (headers, cache, revalidation)
 * @returns Complete job details including full description text
 * @throws Error with 'NOT_FOUND' message if job doesn't exist
 */
export async function fetchJob(jobId: string, init?: RequestInit): Promise<JobDetail> {
  const response = await fetch(`${getApiOrigin()}/api/v1/jobs/${jobId}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 404) {
    throw new Error('NOT_FOUND');
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch job: ${response.status}`);
  }

  return response.json();
}

/**
 * Builds URLSearchParams from filter input object.
 * Only includes parameters with truthy values to keep URLs clean.
 * 
 * @param input Filter criteria object
 * @returns URLSearchParams ready for API request
 */
export function buildJobsSearchParams(input: {
  page?: string;
  size?: string;
  location?: string;
  remote?: string;
  company?: string;
  search?: string;
  // Comma-separated, e.g. "NEW_GRAD_COHORT,ENTRY_LEVEL_OPEN" — a job matches if
  // its entryType is any of these.
  entryTypes?: string;
  gradYear?: string;
  companyTier?: string;
  hasSalary?: string;
}) {
  const params = new URLSearchParams();

  if (input.page) params.set('page', input.page);
  if (input.size) params.set('size', input.size);
  if (input.location) params.set('location', input.location);
  if (input.remote === 'true') params.set('remote', 'true');
  if (input.company) params.set('company', input.company);
  if (input.search) params.set('search', input.search);
  if (input.entryTypes) params.set('entryTypes', input.entryTypes);
  if (input.gradYear) params.set('gradYear', input.gradYear);
  if (input.companyTier) params.set('companyTier', input.companyTier);
  if (input.hasSalary === 'true') params.set('hasSalary', 'true');

  return params;
}

export function createJobMetadataDescription(job: JobDetail) {
  const parts = [job.company, job.location, job.employmentType].filter(Boolean);
  const summary = job.description.replace(/\s+/g, ' ').trim().slice(0, 140);
  return [parts.join(' · '), summary].filter(Boolean).join(' — ');
}

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
}

function getApiOrigin() {
  return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
}

function getSiteOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://jobdog.dev';
}

export function getSiteUrl(path = '') {
  const origin = getSiteOrigin().replace(/\/$/, '');
  return path ? `${origin}${path.startsWith('/') ? path : `/${path}`}` : origin;
}

export async function fetchJobs(params: URLSearchParams, init?: RequestInit): Promise<JobsResponse> {
  const qs = params.toString();
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
}

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

export function buildJobsSearchParams(input: {
  page?: string;
  size?: string;
  location?: string;
  remote?: string;
  company?: string;
  search?: string;
}) {
  const params = new URLSearchParams();

  if (input.page) params.set('page', input.page);
  if (input.size) params.set('size', input.size);
  if (input.location) params.set('location', input.location);
  if (input.remote === 'true') params.set('remote', 'true');
  if (input.company) params.set('company', input.company);
  if (input.search) params.set('search', input.search);

  return params;
}

export function createJobMetadataDescription(job: JobDetail) {
  const parts = [job.company, job.location, job.employmentType].filter(Boolean);
  const summary = job.description.replace(/\s+/g, ' ').trim().slice(0, 140);
  return [parts.join(' · '), summary].filter(Boolean).join(' — ');
}

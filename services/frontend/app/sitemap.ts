import type { MetadataRoute } from 'next';
import { fetchJobs, getSiteUrl } from '@/lib/public-jobs';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Basic sitemap entries that don't require API calls
  const entries: MetadataRoute.Sitemap = [
    {
      url: getSiteUrl('/'),
      changeFrequency: 'hourly',
      priority: 1,
      lastModified: new Date(),
    },
    {
      url: getSiteUrl('/login'),
      changeFrequency: 'monthly',
      priority: 0.5,
      lastModified: new Date(),
    },
  ];

  // Try to fetch job data, but don't fail the build if backend is unavailable
  try {
    const pageSize = 500;
    const firstPage = await fetchJobs(new URLSearchParams({ page: '0', size: String(pageSize) }), {
      next: { revalidate },
    });

    // Update homepage lastModified with actual data
    entries[0].lastModified = firstPage.lastSync ? new Date(firstPage.lastSync) : new Date();

    const totalPages = Math.max(1, Math.ceil(firstPage.total / pageSize));
    const pages = [firstPage];

    for (let page = 1; page < totalPages && page < 10; page++) { // Limit to 10 pages to avoid build timeouts
      try {
        pages.push(await fetchJobs(new URLSearchParams({ page: String(page), size: String(pageSize) }), {
          next: { revalidate },
        }));
      } catch {
        break; // Stop trying if a page fails
      }
    }

    for (const page of pages) {
      for (const job of page.items) {
        entries.push({
          url: getSiteUrl(`/jobs/${job.jobId}`),
          changeFrequency: 'hourly',
          priority: 0.8,
          lastModified: new Date(job.postedAt ?? job.scrapedAt),
        });
      }
    }
  } catch {
    // Return basic sitemap without job data
    return entries;
  }

  return entries;
}

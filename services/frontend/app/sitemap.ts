import type { MetadataRoute } from 'next';
import { fetchJobs, getSiteUrl } from '@/lib/public-jobs';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pageSize = 500;
  const firstPage = await fetchJobs(new URLSearchParams({ page: '0', size: String(pageSize) }), {
    next: { revalidate },
  });

  const entries: MetadataRoute.Sitemap = [
    {
      url: getSiteUrl('/'),
      changeFrequency: 'hourly',
      priority: 1,
      lastModified: firstPage.lastSync ? new Date(firstPage.lastSync) : new Date(),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(firstPage.total / pageSize));
  const pages = [firstPage];

  for (let page = 1; page < totalPages; page++) {
    pages.push(await fetchJobs(new URLSearchParams({ page: String(page), size: String(pageSize) }), {
      next: { revalidate },
    }));
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

  return entries;
}

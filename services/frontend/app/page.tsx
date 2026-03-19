import type { Metadata } from 'next';
import HomePageClient from '@/components/HomePageClient';
import { buildJobsSearchParams, fetchJobs } from '@/lib/public-jobs';

const PAGE_SIZE = 100;
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Intern & New Grad Jobs | JobDog',
  description: 'Browse active internship and new grad software roles with crawlable job pages and fresh listings from JobDog.',
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; location?: string; remote?: string; company?: string; search?: string }>;
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

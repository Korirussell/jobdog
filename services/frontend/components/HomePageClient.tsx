'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import FilterBar, { FilterState } from '@/components/FolderTabs';
import JobListRow from '@/components/JobListRow';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/contexts/AuthContext';
import { api, type ReportVerdict } from '@/lib/api';
import type { JobSummary } from '@/lib/public-jobs';

interface HomePageClientProps {
  initialJobs: JobSummary[];
  initialTotal: number;
  initialLastSync: string | null;
  initialPage: number;
  pageSize: number;
}

function formatSyncTime(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'recently';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// Reads the current filter state out of the URL. The URL is the single source
// of truth — see the comment on FilterBarProps in FolderTabs.tsx for why: a
// client-only `useState` here previously filtered only the ~100 jobs fetched
// for the current page, so a real, existing combination (e.g. New Grad + Class
// of 2027, which matches roughly 14 of 1,000+ active postings) would routinely
// show zero results just because none of the 14 landed on that page. Deriving
// filters from the URL keeps this component and app/page.tsx (which does the
// actual server-side filtering) reading the same values.
function filtersFromSearchParams(params: URLSearchParams): FilterState {
  const tab = params.get('tab') === 'newgrad' ? 'newgrad' : 'intern';
  const companyTierRaw = params.get('companyTier');
  const gradYearRaw = params.get('gradYear');
  return {
    tab,
    remote: params.get('remote') === 'true',
    location: params.get('location') ?? '',
    hideApplied: params.get('hideApplied') === 'true',
    companyTier: companyTierRaw === 'ANY' || companyTierRaw === 'FAANG' || companyTierRaw === 'UNICORN' || companyTierRaw === 'NOTABLE' ? companyTierRaw : '',
    gradYear: tab === 'newgrad' && (gradYearRaw === '2026' || gradYearRaw === '2027') ? gradYearRaw : '',
    hasSalary: params.get('hasSalary') === 'true',
    // Absent means on — matches the backend default, so a shared/bookmarked
    // URL from before this toggle existed still shows the SWE-only view.
    sweOnly: params.get('sweOnly') !== 'false',
  };
}

export default function HomePageClient({ initialJobs, initialTotal, initialLastSync, initialPage, pageSize }: HomePageClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, applyCredits } = useAuth();
  // Server-filtered by app/page.tsx according to the current URL — this is
  // already the correct result set, not a superset that needs re-filtering.
  const allJobs = initialJobs;
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  const totalFromApi = initialTotal;
  const page = initialPage;
  const lastSync = initialLastSync;
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [resumes, setResumes] = useState<Array<{ resumeId: string; status: string }>>([]);
  // Listing feedback: this user's verdicts, the listing they just opened (when they
  // can actually answer "did the link work?"), listings that got closed by reports
  // this session, and a short confirmation message.
  const [myReports, setMyReports] = useState<Record<string, ReportVerdict>>({});
  const [lastOpenedJobId, setLastOpenedJobId] = useState<string | null>(null);
  const [closedJobIds, setClosedJobIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const searchQuery = searchParams.get('search') ?? '';

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  // Navigates to the current path with `changes` merged into the existing query
  // string. Page resets to 0 on any filter/search change — staying on page 4 of
  // the old result set makes no sense once the set itself has changed. `search`
  // is handled separately (debounced) rather than through this path.
  const navigateWithFilters = useCallback((changes: Partial<Record<string, string | null>>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === '') next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    // A hard navigation, not router.push. The App Router's client-side Router
    // Cache can reuse the previous render of this same route/segment when only
    // searchParams change — confirmed by observing window.location.href update
    // correctly via router.push (even combined with router.refresh()) while the
    // DOM kept showing the previous filter's results. A full navigation forces
    // app/page.tsx to genuinely re-run server-side with the new searchParams,
    // at the cost of a full page load instead of a client transition.
    window.location.href = `${pathname}?${next.toString()}`;
  }, [pathname, searchParams]);

  const handleFilterChange = useCallback((next: FilterState) => {
    navigateWithFilters({
      tab: next.tab === 'newgrad' ? 'newgrad' : null,
      remote: next.remote ? 'true' : null,
      location: next.location || null,
      companyTier: next.companyTier || null,
      gradYear: next.gradYear || null,
      hasSalary: next.hasSalary ? 'true' : null,
      sweOnly: next.sweOnly ? null : 'false',
      // hideApplied is intentionally excluded — see the render-time filter below.
    });
  }, [navigateWithFilters]);

  // hideApplied depends on which jobs *this browser* has applied to, which the
  // backend has no way to filter by for anonymous users — it stays client-side,
  // applied over the page the server already returned.
  const [hideApplied, setHideApplied] = useState(false);

  const handleSearchChange = useCallback((value: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      navigateWithFilters({ search: value || null });
    }, 400);
  }, [navigateWithFilters]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.getSavedJobs()
      .then((res) => setSavedJobIds(new Set(res.items.map((j) => j.jobId))))
      .catch(() => {});
    // Fetched so Apply can silently record an application in the background
    // — see handleApply — without ever blocking the click-through to the
    // real posting on a resume-picker step.
    api.getResumes()
      .then((res) => setResumes(res.items.map((r) => ({ resumeId: r.resumeId, status: r.status }))))
      .catch(() => {});
    api.getMyJobReports()
      .then(setMyReports)
      .catch(() => {});
  }, [isAuthenticated]);

  const handleSaveJob = useCallback(async (jobId: string, save: boolean) => {
    if (!isAuthenticated) return;
    if (save) {
      setSavedJobIds((prev) => new Set(prev).add(jobId));
      try {
        await api.saveJob(jobId);
      } catch {
        setSavedJobIds((prev) => {
          const s = new Set(prev);
          s.delete(jobId);
          return s;
        });
      }
    } else {
      setSavedJobIds((prev) => {
        const s = new Set(prev);
        s.delete(jobId);
        return s;
      });
      try {
        await api.unsaveJob(jobId);
      } catch {
        setSavedJobIds((prev) => new Set(prev).add(jobId));
      }
    }
  }, [isAuthenticated]);

  // Apply means "take me to the real job" — full stop. It used to open a
  // modal requiring a resume pick and a match-score computation before
  // reaching the actual posting, which added friction most people didn't
  // want for something as simple as clicking Apply. Now it opens the real
  // applyUrl immediately, and — only when there's exactly one parsed resume,
  // so there's no ambiguity about which one to use — silently records the
  // application in the background so it still shows up on the Applications
  // page. Anything less certain (zero or multiple resumes) just skips
  // tracking rather than interrupting the click with a picker.
  const handleApply = useCallback((jobId: string) => {
    const job = allJobs.find((j) => j.jobId === jobId);
    if (!job) return;
    window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
    setLastOpenedJobId(jobId);

    if (!isAuthenticated) return;
    const parsedResumes = resumes.filter((r) => r.status === 'PARSED');
    if (parsedResumes.length !== 1) return;
    api.createApplication(jobId, parsedResumes[0].resumeId)
      .then(() => setAppliedJobIds((prev) => new Set(prev).add(jobId)))
      .catch(() => {});
  }, [allJobs, isAuthenticated, resumes]);

  const handleReport = useCallback(async (jobId: string, verdict: ReportVerdict) => {
    const previous = myReports[jobId];
    setMyReports((prev) => ({ ...prev, [jobId]: verdict }));
    if (lastOpenedJobId === jobId) setLastOpenedJobId(null);
    try {
      const result = await api.reportJob(jobId, verdict);
      applyCredits(result.resumeCredits, result.reportsToNextCredit);
      if (result.jobClosed) {
        setClosedJobIds((prev) => new Set(prev).add(jobId));
        setNotice('Thanks. Enough people reported that one, so it has been removed.');
      } else if (result.earnedCredit) {
        setNotice('Thanks. You earned a resume upload.');
      } else {
        setNotice('Thanks. ' + result.reportsToNextCredit + ' more to earn a resume upload.');
      }
    } catch {
      // Put it back: the report didn't land.
      setMyReports((prev) => {
        const next = { ...prev };
        if (previous) next[jobId] = previous; else delete next[jobId];
        return next;
      });
      setNotice('Could not send that. Try again.');
    }
  }, [myReports, lastOpenedJobId, applyCredits]);

  // The "did the link work?" popup. The person is on the other tab right after clicking Apply,
  // so wait until they come back (tab visible/focused again), with a timer as the fallback for
  // browsers that never blur this tab.
  const [feedbackJobId, setFeedbackJobId] = useState<string | null>(null);
  useEffect(() => {
    if (!lastOpenedJobId || !isAuthenticated || myReports[lastOpenedJobId]) {
      setFeedbackJobId(null);
      return;
    }
    const jobId = lastOpenedJobId;
    const show = () => setFeedbackJobId(jobId);
    const onVisible = () => { if (document.visibilityState === 'visible') show(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', show);
    const timer = setTimeout(show, 8000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', show);
      clearTimeout(timer);
    };
  }, [lastOpenedJobId, isAuthenticated, myReports]);
  const feedbackJob = feedbackJobId ? allJobs.find((j) => j.jobId === feedbackJobId) ?? null : null;

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // The only filtering left on the client: hideApplied, which can't be done
  // server-side (see above). Everything else — tab, remote, location, search,
  // companyTier, gradYear, hasSalary — was already applied server-side by
  // app/page.tsx against the full dataset, so allJobs is already correct.
  const visibleJobs = allJobs.filter((job) =>
    !closedJobIds.has(job.jobId) && !(hideApplied && appliedJobIds.has(job.jobId)));

  const hasActiveFilters = filters.remote || !!filters.location || hideApplied ||
    !!filters.companyTier || !!filters.gradYear || filters.hasSalary || !!searchQuery;

  const totalPages = Math.ceil(totalFromApi / pageSize);
  const rangeFrom = totalFromApi === 0 ? 0 : page * pageSize + 1;
  const rangeTo = Math.min(totalFromApi, page * pageSize + allJobs.length);

  const hrefForPage = useCallback((targetPage: number) => {
    const next = new URLSearchParams(searchParams.toString());
    if (targetPage <= 0) next.delete('page'); else next.set('page', String(targetPage));
    const query = next.toString();
    return query ? pathname + '?' + query : pathname;
  }, [pathname, searchParams]);

  const goToPage = useCallback((targetPage: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(targetPage));
    // Hard navigation — see the comment in navigateWithFilters for why
    // router.push (even combined with router.refresh()) isn't reliable here.
    window.location.href = `${pathname}?${next.toString()}`;
  }, [pathname, searchParams]);

  return (
    <div className="min-h-screen bg-white">
      <TopBar onSearchFocus={focusSearch} />

      {feedbackJob && (
        <div
          role="dialog"
          aria-label="Did the link work?"
          className="fixed bottom-6 right-4 z-[310] w-[calc(100vw-2rem)] max-w-sm border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          <p className="font-mono text-sm font-bold text-text-primary">Did the link work?</p>
          <p className="mt-0.5 truncate font-mono text-xs text-text-secondary">
            {feedbackJob.title} @ {feedbackJob.company}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setFeedbackJobId(null); handleReport(feedbackJob.jobId, 'WORKS'); }}
              className="border-2 border-emerald-600 bg-emerald-50 px-3 py-1.5 font-mono text-xs font-bold text-emerald-700 hover:bg-emerald-100"
            >
              ✓ Yes, it works
            </button>
            <button
              type="button"
              onClick={() => { setFeedbackJobId(null); handleReport(feedbackJob.jobId, 'DEAD'); }}
              className="border-2 border-red-600 bg-red-50 px-3 py-1.5 font-mono text-xs font-bold text-red-700 hover:bg-red-100"
            >
              ✗ Dead link
            </button>
            <button
              type="button"
              onClick={() => { setFeedbackJobId(null); setLastOpenedJobId(null); }}
              className="ml-auto font-mono text-[10px] text-text-tertiary underline hover:text-text-primary"
            >
              Skip
            </button>
          </div>
          <p className="mt-2 font-mono text-[10px] text-text-tertiary">Every 3 answers earns a resume upload.</p>
        </div>
      )}

      {notice && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 border-2 border-black bg-primary px-4 py-2 font-mono text-xs font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          {notice}
        </div>
      )}

      <div className="border-b border-black/8 bg-background px-6 py-6 text-center">
        <h1 className="font-mono text-2xl font-bold text-text-primary sm:text-3xl">
          Intern &amp; New Grad Jobs
        </h1>
        <p className="mt-1 font-mono text-sm text-text-secondary">
          {totalFromApi > 0 ? `${totalFromApi.toLocaleString()} active positions` : 'No jobs found'}
          {lastSync && ` · synced ${formatSyncTime(lastSync)}`}
        </p>
      </div>

      <main className="mx-auto max-w-5xl px-3 sm:px-6">
        {/* Keep the filter/search bar in normal flow (no floating/sticky behavior). */}
        <div className="bg-white">
          <FilterBar
            searchInputRef={searchInputRef}
            filters={{ ...filters, hideApplied }}
            onFilterChange={(f) => {
              setHideApplied(f.hideApplied);
              handleFilterChange(f);
            }}
            initialSearch={searchQuery}
            onSearchChange={handleSearchChange}
          />
        </div>

        <div className="flex items-center justify-between border-b border-black/8 py-2">
          {loading ? (
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              <span className="font-mono text-xs text-text-tertiary">Loading...</span>
            </div>
          ) : error ? (
            <p className="font-mono text-xs font-bold text-red-600">⚠ {error}</p>
          ) : (
            <p className="font-mono text-xs text-text-secondary">
              {searchQuery ? (
                <><span className="font-bold text-text-primary">{totalFromApi.toLocaleString()}</span> results for "<span className="text-primary">{searchQuery}</span>"</>
              ) : (
                <><span className="font-bold text-text-primary">{totalFromApi.toLocaleString()}</span> {filters.tab === 'intern' ? 'internships' : 'new grad roles'}{hasActiveFilters && !searchQuery ? ' matching filters' : ''}{totalPages > 1 && <span className="text-text-tertiary"> · showing {rangeFrom.toLocaleString()}–{rangeTo.toLocaleString()}</span>}</>
              )}
            </p>
          )}
          {lastSync && !loading && (
            <span className="font-mono text-[10px] text-text-tertiary">
              synced {formatSyncTime(lastSync)}
            </span>
          )}
        </div>

        {visibleJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 text-5xl">{searchQuery ? '🔍' : '📭'}</div>
            <p className="font-mono text-base font-bold text-text-secondary">
              {searchQuery ? `No ${filters.tab === 'intern' ? 'internships' : 'new grad roles'} matching "${searchQuery}"` : `No ${filters.tab === 'intern' ? 'internships' : 'new grad roles'} found`}
            </p>
            <p className="mt-2 font-mono text-sm text-text-tertiary">
              {searchQuery ? 'Try a different search or clear filters' : 'Try switching tabs or removing filters'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  if (searchInputRef.current) searchInputRef.current.value = '';
                  setHideApplied(false);
                  navigateWithFilters({ remote: null, location: null, companyTier: null, gradYear: null, hasSalary: null, search: null });
                }}
                className="mt-5 border-2 border-black bg-primary px-5 py-2 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {visibleJobs.map((job) => (
              <JobListRow
                key={job.jobId}
                jobId={job.jobId}
                company={job.company}
                title={job.title}
                location={job.location}
                employmentType={job.employmentType}
                postedAt={job.postedAt}
                addedAt={job.addedAt}
                jobStatus={job.jobStatus}
                applyUrl={job.applyUrl}
                matchPercentage={job.matchPercentage}
                companyTier={job.companyTier}
                experienceLevel={job.experienceLevel}
                entryType={job.entryType}
                gradYearMin={job.gradYearMin}
                gradYearMax={job.gradYearMax}
                salaryRaw={job.salaryRaw}
                alreadyApplied={appliedJobIds.has(job.jobId)}
                isSaved={savedJobIds.has(job.jobId)}
                onApply={handleApply}
                onSave={isAuthenticated ? handleSaveJob : undefined}
                detailHref={`/jobs/${job.jobId}`}
              />
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} hrefFor={hrefForPage} />
      </main>

    </div>
  );
}

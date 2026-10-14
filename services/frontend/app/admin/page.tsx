'use client';

import { useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import AuthGuard from '@/components/AuthGuard';
import { api, type AdminOverview } from '@/lib/api';

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="border-2 border-black/15 bg-white p-3">
      <p className="font-mono text-[10px] font-bold uppercase text-text-tertiary">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="mt-0.5 font-mono text-[10px] text-text-tertiary">{sub}</p>}
    </div>
  );
}

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAdminOverview()
      .then(setData)
      .catch((e: Error) => setError(e.message || 'Could not load'));
  }, []);

  // One bar per day for the last 30 days, zero-filled so a quiet day shows as a gap.
  const days = useMemo(() => {
    if (!data) return [];
    const counts = new Map(data.signupsByDay.map((d) => [String(d.day).slice(0, 10), d.signups]));
    const out: Array<{ day: string; signups: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      out.push({ day, signups: counts.get(day) ?? 0 });
    }
    return out;
  }, [data]);
  const peak = Math.max(1, ...days.map((d) => d.signups));

  return (
    <AuthGuard>
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="font-mono text-2xl font-bold text-text-primary">Users</h1>
        <p className="mb-6 mt-1 font-mono text-xs text-text-tertiary">Who is signing up, and who is actually coming back.</p>

        {error ? (
          <p className="border-2 border-black/15 bg-white p-4 font-mono text-sm text-text-secondary">
            {error.toLowerCase().includes('admin') || error.includes('403') ? 'This page is for the site admin.' : `⚠ ${error}`}
          </p>
        ) : !data ? (
          <p className="animate-pulse font-mono text-sm text-text-secondary">Loading...</p>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="mb-2 font-mono text-[11px] font-bold uppercase text-text-tertiary">People</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total users" value={data.users.total} sub={`${data.users.viaSocialLogin} via Google/GitHub`} />
                <Stat label="New · 7 days" value={data.users.new7d} sub={`${data.users.new30d} in 30 days`} />
                <Stat label="Active · 24h" value={data.users.active24h} />
                <Stat label="Active · 7 days" value={data.users.active7d} sub={`${data.users.active30d} in 30 days`} />
              </div>
            </section>

            <section>
              <h2 className="mb-2 font-mono text-[11px] font-bold uppercase text-text-tertiary">Sign-ups, last 30 days</h2>
              <div className="flex h-24 items-end gap-0.5 border-2 border-black/15 bg-white p-2">
                {days.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.day}: ${d.signups}`}
                    className={d.signups > 0 ? 'flex-1 bg-primary' : 'flex-1 bg-black/10'}
                    style={{ height: `${Math.max(4, (d.signups / peak) * 100)}%` }}
                  />
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 font-mono text-[11px] font-bold uppercase text-text-tertiary">What they do</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Resumes uploaded" value={data.engagement.resumes} />
                <Stat label="Applications tracked" value={data.engagement.applications} />
                <Stat label="Saved jobs" value={data.engagement.savedJobs} />
                <Stat
                  label="Link reports"
                  value={data.engagement.jobReports}
                  sub={`${data.engagement.deadReports} dead · ${data.engagement.usersWhoReported} users · ${data.jobs.closedAsDead} listings closed`}
                />
              </div>
            </section>

            <section>
              <h2 className="mb-2 font-mono text-[11px] font-bold uppercase text-text-tertiary">Newest users</h2>
              <div className="overflow-x-auto border-2 border-black/15 bg-white">
                <table className="w-full min-w-[760px] text-left font-mono text-xs">
                  <thead className="border-b-2 border-black/15 bg-black/[0.03] text-[10px] uppercase text-text-tertiary">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Joined</th>
                      <th className="px-3 py-2">Last seen</th>
                      <th className="px-3 py-2 text-right">Resumes</th>
                      <th className="px-3 py-2 text-right">Applied</th>
                      <th className="px-3 py-2 text-right">Saved</th>
                      <th className="px-3 py-2 text-right">Reports</th>
                      <th className="px-3 py-2 text-right">Uploads left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentUsers.map((u) => (
                      <tr key={u.email} className="border-b border-black/8 last:border-0">
                        <td className="px-3 py-2 font-bold text-text-primary">
                          {u.name}
                          {u.role === 'ADMIN' && <span className="ml-1.5 border border-black/30 px-1 text-[9px]">ADMIN</span>}
                        </td>
                        <td className="px-3 py-2 text-text-secondary">{u.email}{u.socialLogin ? ' ·oauth' : ''}</td>
                        <td className="px-3 py-2 text-text-secondary">{ago(u.joined)}</td>
                        <td className="px-3 py-2 text-text-secondary">{ago(u.lastSeen)}</td>
                        <td className="px-3 py-2 text-right">{u.resumes}</td>
                        <td className="px-3 py-2 text-right">{u.applications}</td>
                        <td className="px-3 py-2 text-right">{u.saved}</td>
                        <td className="px-3 py-2 text-right">{u.reports}</td>
                        <td className="px-3 py-2 text-right">{u.uploadsLeft}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 font-mono text-[10px] text-text-tertiary">
                "Last seen" starts counting from this release, so existing users show as never until they next visit.
              </p>
            </section>
          </div>
        )}
      </main>
    </AuthGuard>
  );
}

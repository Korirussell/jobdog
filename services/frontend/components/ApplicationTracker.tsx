'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

export interface ApplicationRow {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  status: string;
  matchScore: number;
  percentile: number | null;
  applicantCount: number;
  appliedAt: string;
}

interface AppMeta {
  notes: string;
  deadline: string; // ISO date string or empty
}

type SortKey = 'company' | 'jobTitle' | 'status' | 'matchScore' | 'appliedAt' | 'deadline';
type SortDir = 'asc' | 'desc';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  APPLIED:      { label: 'Applied',      bg: 'bg-yellow-50',  text: 'text-yellow-800', border: 'border-yellow-300' },
  SCORED:       { label: 'Applied',      bg: 'bg-yellow-50',  text: 'text-yellow-800', border: 'border-yellow-300' },
  INTERVIEWING: { label: 'Interviewing', bg: 'bg-blue-50',    text: 'text-blue-800',   border: 'border-blue-300' },
  OFFER:        { label: '🎉 Offer',     bg: 'bg-green-50',   text: 'text-green-800',  border: 'border-green-300' },
  REJECTED:     { label: 'Rejected',     bg: 'bg-red-50',     text: 'text-red-800',    border: 'border-red-300' },
  WITHDRAWN:    { label: 'Withdrawn',    bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-300' },
  FAILED:       { label: 'Failed',       bg: 'bg-red-50',     text: 'text-red-800',    border: 'border-red-300' },
};

const EDITABLE_STATUSES = ['APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN'];

function formatDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusPill({
  status,
  applicationId,
  onStatusChange,
}: {
  status: string;
  applicationId: string;
  onStatusChange: (id: string, newStatus: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };

  const handleSelect = async (newStatus: string) => {
    setOpen(false);
    if (newStatus === status) return;
    setSaving(true);
    try {
      await api.updateApplicationStatus(applicationId, newStatus);
      onStatusChange(applicationId, newStatus);
    } catch {
      // revert handled by parent via re-fetch or optimistic
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className={`inline-flex items-center gap-1 border px-2.5 py-1 font-mono text-[11px] font-bold transition-all
          ${cfg.bg} ${cfg.text} ${cfg.border}
          hover:opacity-80 disabled:opacity-50`}
      >
        {saving ? '...' : cfg.label}
        <svg className="h-2.5 w-2.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {EDITABLE_STATUSES.map((s) => {
              const c = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => handleSelect(s)}
                  className={`flex w-full items-center gap-2 px-3 py-2 font-mono text-[11px] font-bold transition-colors hover:bg-black/5
                    ${s === status ? 'bg-black/5' : ''}`}
                >
                  <span className={`inline-block h-2 w-2 rounded-full border ${c.border} ${c.bg}`} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const STORAGE_KEY = 'jobdog_app_meta';

function loadMeta(): Record<string, AppMeta> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveMeta(meta: Record<string, AppMeta>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(meta)); } catch {}
}

function InlineNote({ appId, value, onChange }: { appId: string; value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="max-w-[140px] truncate text-left font-mono text-[10px] text-text-tertiary hover:text-text-primary"
        title={value || 'Add note...'}
      >
        {value || <span className="opacity-40">+ note</span>}
      </button>
    );
  }
  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onChange(draft); setEditing(false); } }}
        rows={2}
        className="w-40 resize-none border border-black/20 bg-white p-1 font-mono text-[10px] text-text-primary focus:border-black focus:outline-none"
        placeholder="Add a note..."
      />
    </div>
  );
}

export default function ApplicationTracker({ applications: initialApps }: { applications: ApplicationRow[] }) {
  const [apps, setApps] = useState<ApplicationRow[]>(initialApps);
  const [sortKey, setSortKey] = useState<SortKey>('appliedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [meta, setMeta] = useState<Record<string, AppMeta>>({});

  useEffect(() => { setMeta(loadMeta()); }, []);

  const updateMeta = (appId: string, patch: Partial<AppMeta>) => {
    setMeta((prev) => {
      const next = { ...prev, [appId]: { notes: '', deadline: '', ...prev[appId], ...patch } };
      saveMeta(next);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    setApps((prev) => prev.map((a) => a.applicationId === id ? { ...a, status: newStatus } : a));
  };

  const filtered = useMemo(() => {
    let list = statusFilter === 'ALL' ? apps : apps.filter((a) => {
      if (statusFilter === 'APPLIED') return a.status === 'APPLIED' || a.status === 'SCORED';
      return a.status === statusFilter;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'company') cmp = a.company.localeCompare(b.company);
      else if (sortKey === 'jobTitle') cmp = a.jobTitle.localeCompare(b.jobTitle);
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortKey === 'matchScore') cmp = a.matchScore - b.matchScore;
      else if (sortKey === 'appliedAt') cmp = new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime();
      else if (sortKey === 'deadline') {
        const da = meta[a.applicationId]?.deadline || '';
        const db = meta[b.applicationId]?.deadline || '';
        cmp = da.localeCompare(db);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [apps, sortKey, sortDir, statusFilter, meta]);

  // Stats
  const total = apps.length;
  const interviewing = apps.filter((a) => a.status === 'INTERVIEWING').length;
  const offers = apps.filter((a) => a.status === 'OFFER').length;
  const rejected = apps.filter((a) => a.status === 'REJECTED').length;
  const interviewRate = total > 0 ? Math.round((interviewing / total) * 100) : 0;

  const exportCSV = () => {
    const headers = ['Company', 'Role', 'Status', 'Match Score', 'Applied Date', 'Deadline', 'Notes'];
    const rows = apps.map((a) => [
      a.company,
      a.jobTitle,
      STATUS_CONFIG[a.status]?.label ?? a.status,
      a.matchScore > 0 ? `${a.matchScore}/100` : '—',
      formatDate(a.appliedAt),
      meta[a.applicationId]?.deadline || '',
      meta[a.applicationId]?.notes || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'applications.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-block opacity-40">
      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  const ColHeader = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="cursor-pointer select-none border-b-2 border-black/10 px-4 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-wider text-text-tertiary hover:text-text-primary"
      onClick={() => handleSort(col)}
    >
      {label}<SortIcon col={col} />
    </th>
  );

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 text-5xl">📋</div>
        <h3 className="font-mono text-lg font-bold text-text-primary">No applications yet</h3>
        <p className="mt-2 max-w-sm font-mono text-sm text-text-secondary">
          Start applying to jobs and they&apos;ll appear here. Track your progress like a pro.
        </p>
        <a
          href="/"
          className="mt-6 border-2 border-black bg-primary px-6 py-2 font-mono text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        >
          Browse Jobs →
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Applied', value: total, color: 'border-yellow-300 bg-yellow-50' },
          { label: 'Interviewing', value: interviewing, color: 'border-blue-300 bg-blue-50' },
          { label: 'Offers', value: offers, color: 'border-green-300 bg-green-50' },
          { label: 'Interview Rate', value: `${interviewRate}%`, color: 'border-black/15 bg-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`border-2 p-4 ${color}`}>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-text-primary">{value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-1">
          {['ALL', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`border px-3 py-1 font-mono text-[10px] font-bold transition-colors
                ${statusFilter === s
                  ? 'border-black bg-primary text-text-primary'
                  : 'border-black/15 bg-white text-text-secondary hover:border-black/30'
                }`}
            >
              {s === 'ALL' ? 'All' : (STATUS_CONFIG[s]?.label ?? s)}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {rejected > 0 && (
            <span className="font-mono text-[10px] text-text-tertiary">{rejected} rejected</span>
          )}
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 border border-black/20 bg-white px-3 py-1.5 font-mono text-[10px] font-bold text-text-secondary transition-colors hover:border-black/40 hover:text-text-primary"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border-2 border-black/10">
        <table className="w-full min-w-[800px] border-collapse">
          <thead className="bg-black/[0.02]">
            <tr>
              <ColHeader col="company" label="Company" />
              <ColHeader col="jobTitle" label="Role" />
              <ColHeader col="status" label="Status" />
              <ColHeader col="matchScore" label="Match" />
              <ColHeader col="appliedAt" label="Applied" />
              <ColHeader col="deadline" label="Deadline" />
              <th className="border-b-2 border-black/10 px-4 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                Notes
              </th>
              <th className="border-b-2 border-black/10 px-4 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((app, i) => (
              <tr
                key={app.applicationId}
                className={`border-b border-black/6 transition-colors hover:bg-black/[0.015] ${i % 2 === 0 ? '' : 'bg-black/[0.01]'}`}
              >
                <td className="px-4 py-3">
                  <p className="font-mono text-xs font-bold text-text-primary">{app.company}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="max-w-[200px] truncate font-mono text-xs text-text-secondary" title={app.jobTitle}>
                    {app.jobTitle}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <StatusPill
                    status={app.status}
                    applicationId={app.applicationId}
                    onStatusChange={handleStatusChange}
                  />
                </td>
                <td className="px-4 py-3">
                  {app.matchScore > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/10">
                        <div
                          className={`h-full rounded-full ${app.matchScore >= 70 ? 'bg-green-500' : app.matchScore >= 40 ? 'bg-yellow-500' : 'bg-red-400'}`}
                          style={{ width: `${app.matchScore}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-bold text-text-secondary">{app.matchScore}</span>
                    </div>
                  ) : (
                    <span className="font-mono text-xs text-text-tertiary">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-text-tertiary">{formatDate(app.appliedAt)}</span>
                </td>
                <td className="px-4 py-3">
                  {/* Deadline — inline date input */}
                  {(() => {
                    const dl = meta[app.applicationId]?.deadline || '';
                    const isUrgent = dl && new Date(dl).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 && new Date(dl).getTime() > Date.now();
                    const isPast = dl && new Date(dl).getTime() < Date.now();
                    return (
                      <input
                        type="date"
                        value={dl}
                        onChange={(e) => updateMeta(app.applicationId, { deadline: e.target.value })}
                        className={`border px-1.5 py-0.5 font-mono text-[10px] focus:outline-none
                          ${isPast ? 'border-red-300 bg-red-50 text-red-700' : isUrgent ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-black/15 bg-white text-text-tertiary'}`}
                        title="Application deadline"
                      />
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  <InlineNote
                    appId={app.applicationId}
                    value={meta[app.applicationId]?.notes || ''}
                    onChange={(v) => updateMeta(app.applicationId, { notes: v })}
                  />
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/?jobId=${app.jobId}`}
                    className="font-mono text-[10px] font-bold text-text-tertiary underline hover:text-text-primary"
                  >
                    View ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="font-mono text-sm text-text-tertiary">No applications match this filter.</p>
          </div>
        )}
      </div>

      <p className="mt-3 font-mono text-[10px] text-text-tertiary">
        {filtered.length} of {total} applications shown
      </p>
    </div>
  );
}

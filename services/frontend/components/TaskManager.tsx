'use client';

import { useState, useCallback, useEffect } from 'react';

interface Application {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  status: string;
  matchScore: number;
  percentile: number | null;
  appliedAt: string;
}

interface TaskManagerProps {
  applications: Application[];
  onKill: (applicationId: string) => void;
}

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string; animate?: string }> = {
  RUNNING:  { icon: '●', color: 'text-green-400',  label: 'RUNNING',  animate: 'animate-spin' },
  SCORED:   { icon: '✓', color: 'text-blue-400',   label: 'SCORED' },
  ORPHANED: { icon: '☠', color: 'text-red-400',    label: 'ORPHANED' },
  KILLED:   { icon: '✕', color: 'text-gray-400',   label: 'KILLED' },
  APPLIED:  { icon: '◷', color: 'text-yellow-400', label: 'APPLIED',  animate: 'animate-pulse' },
};

function shortHash(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return `0x${(hash >>> 0).toString(16).slice(0, 6).toUpperCase().padStart(6, '0')}`;
}

function formatUptime(dateString: string): string {
  const applied = new Date(dateString);
  if (isNaN(applied.getTime())) return '??:??:??';
  const diff = Math.max(0, Date.now() - applied.getTime());
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${(hours % 24).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export default function TaskManager({ applications, onKill }: TaskManagerProps) {
  const [activeTab, setActiveTab] = useState<'processes' | 'performance' | 'history'>('processes');
  const [killingIds, setKillingIds] = useState<Set<string>>(new Set());
  const [deadIds, setDeadIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleKill = useCallback((applicationId: string) => {
    setKillingIds((prev) => new Set(prev).add(applicationId));
    setTimeout(() => {
      onKill(applicationId);
      setKillingIds((prev) => {
        const next = new Set(prev);
        next.delete(applicationId);
        return next;
      });
      setDeadIds((prev) => new Set(prev).add(applicationId));
      setTimeout(() => {
        setDeadIds((prev) => {
          const next = new Set(prev);
          next.delete(applicationId);
          return next;
        });
      }, 600);
    }, 800);
  }, [onKill]);

  const visibleApps = applications.filter((a) => !deadIds.has(a.applicationId));
  const avgScore = visibleApps.length > 0
    ? Math.round(visibleApps.reduce((sum, a) => sum + a.matchScore, 0) / visibleApps.length)
    : 0;

  const tabs = [
    { id: 'processes' as const, label: 'Processes' },
    { id: 'performance' as const, label: 'Performance' },
    { id: 'history' as const, label: 'History' },
  ];

  return (
    <div className="border-[3px] border-black font-mono shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      {/* Title Bar */}
      <div className="flex items-center justify-between border-b-[3px] border-black bg-primary px-3 py-1.5">
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-px">
            <div className="h-1.5 w-1.5 bg-black" />
            <div className="h-1.5 w-1.5 bg-black" />
            <div className="h-1.5 w-1.5 bg-black" />
            <div className="h-1.5 w-1.5 bg-black" />
          </div>
          <span className="text-xs font-bold tracking-wider text-text-primary">
            TASK_MANAGER.EXE
          </span>
        </div>
        <div className="flex gap-1">
          <button className="flex h-5 w-5 items-center justify-center border-2 border-black bg-gray-200 text-[10px] font-bold leading-none hover:bg-gray-300">
            _
          </button>
          <button className="flex h-5 w-5 items-center justify-center border-2 border-black bg-gray-200 text-[10px] font-bold leading-none hover:bg-gray-300">
            □
          </button>
          <button className="flex h-5 w-5 items-center justify-center border-2 border-black bg-danger text-[10px] font-bold leading-none text-white hover:bg-red-600">
            ×
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b-[3px] border-black bg-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              border-r-2 border-black px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide
              transition-colors
              ${activeTab === tab.id
                ? 'bg-white text-text-primary'
                : 'bg-gray-200 text-text-tertiary hover:bg-gray-100'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white">
        {activeTab === 'processes' ? (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-[60px_1fr_120px_70px_70px_90px_100px] gap-0 border-b-2 border-black bg-gray-100 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              <div>STATUS</div>
              <div>PROCESS</div>
              <div>COMPANY</div>
              <div className="text-right">CPU%</div>
              <div className="text-right">MEM</div>
              <div className="text-right">PID</div>
              <div className="text-right">UPTIME</div>
            </div>

            {/* Table Body */}
            <div className="max-h-[400px] overflow-y-auto">
              {visibleApps.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-text-tertiary">
                  NO ACTIVE PROCESSES
                </div>
              ) : (
                visibleApps.map((app) => {
                  const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.APPLIED;
                  const isKilling = killingIds.has(app.applicationId);
                  const isSelected = selectedId === app.applicationId;

                  return (
                    <div
                      key={app.applicationId}
                      onClick={() => setSelectedId(app.applicationId)}
                      className={`
                        grid cursor-pointer grid-cols-[60px_1fr_120px_70px_70px_90px_100px] gap-0
                        border-b border-black/10 px-2 py-1.5 text-[11px] transition-all
                        ${isKilling ? 'animate-task-kill bg-red-500/30' : ''}
                        ${isSelected && !isKilling ? 'bg-info/10' : ''}
                        ${!isSelected && !isKilling ? 'hover:bg-gray-50' : ''}
                      `}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`${cfg.color} ${cfg.animate ?? ''} text-sm leading-none`}>
                          {cfg.icon}
                        </span>
                      </div>
                      <div className="truncate font-bold text-text-primary" title={app.jobTitle}>
                        {app.jobTitle}
                      </div>
                      <div className="truncate text-text-secondary" title={app.company}>
                        {app.company}
                      </div>
                      <div className="text-right tabular-nums text-text-primary">
                        {app.matchScore}%
                      </div>
                      <div className="text-right tabular-nums text-text-secondary">
                        {app.percentile !== null ? `${app.percentile}%` : '—'}
                      </div>
                      <div className="text-right tabular-nums text-text-tertiary">
                        {shortHash(app.applicationId)}
                      </div>
                      <div className="text-right tabular-nums text-text-tertiary">
                        {formatUptime(app.appliedAt)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* End Process Button */}
            <div className="flex justify-end border-t-2 border-black bg-gray-50 px-3 py-2">
              <button
                disabled={!selectedId || killingIds.has(selectedId)}
                onClick={() => selectedId && handleKill(selectedId)}
                className={`
                  border-2 border-black bg-danger px-3 py-1 text-[11px] font-bold
                  uppercase tracking-wider text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                  transition-all hover:translate-x-[1px] hover:translate-y-[1px]
                  hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]
                  active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
                  disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none
                `}
              >
                END PROCESS
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <span className="text-2xl">🚧</span>
            <span className="mt-2 text-xs font-bold uppercase tracking-wider">
              {activeTab === 'performance' ? 'PERFORMANCE MONITOR' : 'PROCESS HISTORY'}
            </span>
            <span className="mt-1 text-[10px]">NOT IMPLEMENTED</span>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t-[3px] border-black bg-gray-100 px-3 py-1">
        <span className="text-[10px] font-bold text-text-secondary">
          PROCESSES: {visibleApps.length}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-text-tertiary">
            CPU USAGE: {avgScore}%
          </span>
          <div className="h-2.5 w-20 border border-black bg-gray-200">
            <div
              className="h-full bg-success transition-all duration-500"
              style={{ width: `${Math.min(100, avgScore)}%` }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes task-kill {
          0%   { opacity: 1; }
          20%  { background: rgba(239, 68, 68, 0.5); }
          40%  { background: transparent; }
          60%  { background: rgba(239, 68, 68, 0.3); }
          80%  { opacity: 0.5; }
          100% { opacity: 0; transform: scaleY(0); height: 0; padding: 0; }
        }
        .animate-task-kill {
          animation: task-kill 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

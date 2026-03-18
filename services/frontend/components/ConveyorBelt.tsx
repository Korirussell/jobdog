'use client';

import { useState, useCallback, useRef } from 'react';

export interface ConveyorJob {
  jobId: string;
  title: string;
  company: string;
}

interface ConveyorBeltProps {
  jobs: ConveyorJob[];
  onSaveJob: (jobId: string) => void;
  visible: boolean;
}

const SCROLL_SECONDS = 20;

export default function ConveyorBelt({ jobs, onSaveJob, visible }: ConveyorBeltProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [goneIds, setGoneIds] = useState<Set<string>>(new Set());

  // Ref keeps savedIds in sync for the animation-end callback,
  // which fires asynchronously and would otherwise close over stale state.
  const savedRef = useRef(savedIds);
  savedRef.current = savedIds;

  const handleSave = useCallback(
    (jobId: string) => {
      setSavedIds((prev) => new Set(prev).add(jobId));
      onSaveJob(jobId);
    },
    [onSaveJob],
  );

  const handleAnimationEnd = useCallback((jobId: string) => {
    if (savedRef.current.has(jobId)) return;
    setGoneIds((prev) => new Set(prev).add(jobId));
  }, []);

  const activeJobs = jobs.filter((j) => !goneIds.has(j.jobId));
  const unsavedCount = activeJobs.filter((j) => !savedIds.has(j.jobId)).length;

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes conveyor-stripe {
          from { background-position: 0 0; }
          to { background-position: 28px 28px; }
        }

        @keyframes belt-travel {
          0% {
            transform: translateX(-140px) translateY(0) rotate(0deg);
            opacity: 1;
          }
          85% {
            transform: translateX(calc(100vw - 200px)) translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateX(calc(100vw - 200px)) translateY(70px) rotate(12deg);
            opacity: 0;
          }
        }

        @keyframes incinerator-pulse {
          0%, 100% {
            box-shadow: inset 0 0 15px rgba(239,68,68,0.3),
                        0 0 8px rgba(239,68,68,0.2);
          }
          50% {
            box-shadow: inset 0 0 25px rgba(239,68,68,0.5),
                        0 0 15px rgba(239,68,68,0.4);
          }
        }

        @keyframes flame-flicker {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.4); }
        }
      `}</style>

      <div
        className={`fixed bottom-0 left-0 right-0 z-50 font-mono transition-transform duration-300 ease-in-out ${
          collapsed ? 'translate-y-[60px]' : 'translate-y-0'
        }`}
      >
        {/* Title Bar — doubles as the collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-between border-t-[3px] border-black bg-[#3E2723] px-4 py-1 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="inline-block text-[10px] text-[#FFD166]">
              {collapsed ? '▶' : '■'}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FFD166]">
              ZERO-DAY CONVEYOR
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-[#B86A24]">
              {unsavedCount} new job{unsavedCount !== 1 ? 's' : ''} on belt
            </span>
            <span className="text-[10px] text-[#FFD166]">
              {collapsed ? '▲' : '▼'}
            </span>
          </div>
        </button>

        {/* Belt Surface */}
        <div
          className="relative h-[60px] overflow-hidden"
          style={{
            backgroundColor: '#5D4037',
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 6px,
              rgba(0,0,0,0.15) 6px,
              rgba(0,0,0,0.15) 12px
            )`,
            animation: 'conveyor-stripe 0.6s linear infinite',
          }}
        >
          {/* Metallic belt edges */}
          <div className="absolute inset-x-0 top-0 z-10 h-[4px] bg-gradient-to-b from-[#8D6E63] to-[#5D4037]" />
          <div className="absolute inset-x-0 bottom-0 z-10 h-[4px] bg-gradient-to-t from-[#3E2723] to-[#5D4037]" />

          {/* Roller dots along top edge */}
          <div className="absolute inset-x-0 top-0 z-20 flex h-[4px] items-center justify-around px-16">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-[3px] w-[3px] rounded-full bg-[#A1887F]" />
            ))}
          </div>

          {/* Job Folders */}
          {activeJobs.map((job) => {
            const saved = savedIds.has(job.jobId);

            return (
              <button
                key={job.jobId}
                onClick={() => !saved && handleSave(job.jobId)}
                onAnimationEnd={() => handleAnimationEnd(job.jobId)}
                className={`absolute left-0 top-[10px] z-30 ${
                  saved
                    ? 'cursor-default'
                    : 'cursor-pointer transition-[filter] duration-100 hover:brightness-110'
                }`}
                style={{
                  animation: `belt-travel ${SCROLL_SECONDS}s linear forwards`,
                  animationPlayState: saved ? 'paused' : 'running',
                  willChange: 'transform, opacity',
                }}
                title={saved ? `Saved: ${job.company}` : `Click to save: ${job.company} — ${job.title}`}
              >
                <div className="relative">
                  {/* Folder tab */}
                  <div
                    className="absolute -top-[6px] left-[3px] h-[7px] w-[26px] border-[2px] border-b-0 border-black"
                    style={{ backgroundColor: saved ? '#10B981' : '#FFD166' }}
                  />
                  {/* Folder body */}
                  <div
                    className="border-[2px] border-black px-2 py-[3px]"
                    style={{
                      backgroundColor: saved ? '#D1FAE5' : '#FFF4D6',
                      boxShadow: '3px 3px 0 0 rgba(0,0,0,0.7)',
                      width: '130px',
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[9px] font-bold leading-tight text-[#3E2723]">
                          {job.company}
                        </p>
                        <p className="truncate text-[8px] leading-tight text-[#6D4C41]">
                          {job.title}
                        </p>
                      </div>
                      {saved && (
                        <span className="flex-shrink-0 text-[12px] font-bold leading-none text-[#10B981]">
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Incinerator Zone */}
          <div
            className="absolute bottom-0 right-0 top-0 z-40 flex w-[60px] flex-col items-center justify-center border-l-[3px] border-black bg-[#1C0A00]"
            style={{ animation: 'incinerator-pulse 2s ease-in-out infinite' }}
          >
            <div className="mb-1 flex items-end gap-[2px]">
              {[
                { h: 8, color: '#EF4444', dur: 0.4, delay: 0 },
                { h: 12, color: '#F97316', dur: 0.6, delay: 0.1 },
                { h: 10, color: '#FBBF24', dur: 0.5, delay: 0.2 },
                { h: 12, color: '#F97316', dur: 0.6, delay: 0.3 },
                { h: 8, color: '#EF4444', dur: 0.4, delay: 0.15 },
              ].map((f, i) => (
                <div
                  key={i}
                  style={{
                    height: `${f.h}px`,
                    width: '4px',
                    backgroundColor: f.color,
                    animation: `flame-flicker ${f.dur}s ease-in-out infinite ${f.delay}s`,
                    transformOrigin: 'bottom',
                  }}
                />
              ))}
            </div>
            <span className="text-[7px] font-bold uppercase tracking-widest text-[#EF4444]">
              VOID
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

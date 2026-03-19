'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface BenchmarkJob {
  benchmarkId: string;
  title: string;
  company: string;
  category: string;
  description: string;
  difficultyLevel: number;
}

interface SavedJob {
  jobId: string;
  title: string;
  company: string;
}

export default function BenchmarkArena() {
  const [mode, setMode] = useState<'gauntlet' | 'custom'>('gauntlet');
  const [benchmarks, setBenchmarks] = useState<BenchmarkJob[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState<string>('');
  const [selectedSavedJob, setSelectedSavedJob] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [roasting, setRoasting] = useState(false);
  const [roastResult, setRoastResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [benchmarksRes, savedRes] = await Promise.all([
        api.getBenchmarks(),
        api.getSavedJobs(),
      ]);
      setBenchmarks(benchmarksRes.items || []);
      setSavedJobs(savedRes.items || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function executeRoast() {
    setRoasting(true);
    setRoastResult(null);
    
    try {
      // Get user's most recent resume
      const resumesRes = await api.getResumes();
      if (!resumesRes.items || resumesRes.items.length === 0) {
        alert('Please upload a resume first!');
        return;
      }
      
      const resumeId = resumesRes.items[0].resumeId;
      const jobId = mode === 'custom' ? selectedSavedJob : null;
      
      const result = await api.roastJob(resumeId, jobId);
      setRoastResult(result);
    } catch (error: any) {
      alert(error.message || 'Failed to execute roast');
    } finally {
      setRoasting(false);
    }
  }

  const canExecute = mode === 'gauntlet' ? selectedBenchmark : selectedSavedJob;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 border-2 border-black bg-primary p-6">
        <h1 className="font-mono text-2xl font-bold text-text-primary">
          🥊 BENCHMARK ARENA
        </h1>
        <p className="mt-2 font-mono text-sm text-text-secondary">
          Test your resume against FAANG benchmarks or your saved jobs. Get brutally honest AI feedback.
        </p>
      </div>

      {/* Mode Selection */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setMode('gauntlet')}
          className={`flex-1 border-2 px-6 py-4 font-mono text-sm font-bold transition-all ${
            mode === 'gauntlet'
              ? 'border-black bg-primary text-text-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
              : 'border-black/20 bg-white text-text-secondary hover:border-black/40'
          }`}
        >
          <div className="text-lg">⚔️ THE GAUNTLET</div>
          <div className="mt-1 text-xs opacity-70">Face FAANG-level benchmarks</div>
        </button>
        
        <button
          onClick={() => setMode('custom')}
          className={`flex-1 border-2 px-6 py-4 font-mono text-sm font-bold transition-all ${
            mode === 'custom'
              ? 'border-black bg-primary text-text-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
              : 'border-black/20 bg-white text-text-secondary hover:border-black/40'
          }`}
        >
          <div className="text-lg">🎯 CUSTOM TARGET</div>
          <div className="mt-1 text-xs opacity-70">Test against your saved jobs</div>
        </button>
      </div>

      {/* Selection Area */}
      <div className="mb-6 border-2 border-black bg-white p-6">
        {loading ? (
          <div className="py-8 text-center font-mono text-sm text-text-tertiary">
            Loading...
          </div>
        ) : mode === 'gauntlet' ? (
          <div>
            <label className="mb-3 block font-mono text-xs font-bold uppercase text-text-tertiary">
              Select Your Opponent
            </label>
            <select
              value={selectedBenchmark}
              onChange={(e) => setSelectedBenchmark(e.target.value)}
              className="w-full border-2 border-black/20 bg-white px-4 py-3 font-mono text-sm font-bold text-text-primary focus:border-black focus:outline-none"
            >
              <option value="">— Choose a benchmark —</option>
              {benchmarks.map((b) => (
                <option key={b.benchmarkId} value={b.benchmarkId}>
                  {b.company} - {b.title} (Difficulty: {b.difficultyLevel}/10)
                </option>
              ))}
            </select>
            
            {selectedBenchmark && (
              <div className="mt-4 border-l-4 border-primary bg-primary/5 p-4">
                {benchmarks.find(b => b.benchmarkId === selectedBenchmark)?.description.split('\n').slice(0, 3).map((line, i) => (
                  <p key={i} className="font-mono text-xs text-text-secondary">{line}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="mb-3 block font-mono text-xs font-bold uppercase text-text-tertiary">
              Select From Your Saved Jobs
            </label>
            {savedJobs.length === 0 ? (
              <div className="py-8 text-center">
                <p className="font-mono text-sm text-text-secondary">
                  You haven't saved any jobs yet. Go save some jobs first!
                </p>
                <a
                  href="/"
                  className="mt-4 inline-block border-2 border-black bg-primary px-4 py-2 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                >
                  Browse Jobs →
                </a>
              </div>
            ) : (
              <select
                value={selectedSavedJob}
                onChange={(e) => setSelectedSavedJob(e.target.value)}
                className="w-full border-2 border-black/20 bg-white px-4 py-3 font-mono text-sm font-bold text-text-primary focus:border-black focus:outline-none"
              >
                <option value="">— Choose a saved job —</option>
                {savedJobs.map((job) => (
                  <option key={job.jobId} value={job.jobId}>
                    {job.company} - {job.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Execute Button */}
      <button
        onClick={executeRoast}
        disabled={!canExecute || roasting}
        className="w-full border-2 border-black bg-primary px-6 py-4 font-mono text-base font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      >
        {roasting ? '🔥 ROASTING...' : '🔥 EXECUTE AI ROAST'}
      </button>

      {/* Results */}
      {roastResult && (
        <div className="mt-8 border-2 border-black bg-white p-6">
          <div className="mb-4 flex items-center justify-between border-b-2 border-black/10 pb-4">
            <h2 className="font-mono text-lg font-bold text-text-primary">
              ROAST RESULTS
            </h2>
            <div className="text-right">
              <div className="font-mono text-2xl font-bold text-text-primary">
                {roastResult.topDogRank}/100
              </div>
              <div className="font-mono text-xs text-text-tertiary">
                {roastResult.tierName.replace(/_/g, ' ')}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="mb-2 font-mono text-xs font-bold uppercase text-text-tertiary">
                The Brutal Truth
              </h3>
              <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-text-secondary">
                {roastResult.brutalRoastText}
              </p>
            </div>

            {roastResult.missingDependencies && roastResult.missingDependencies.length > 0 && (
              <div>
                <h3 className="mb-2 font-mono text-xs font-bold uppercase text-text-tertiary">
                  Missing Dependencies
                </h3>
                <div className="flex flex-wrap gap-2">
                  {roastResult.missingDependencies.map((dep: string, i: number) => (
                    <span
                      key={i}
                      className="border border-red-300 bg-red-50 px-2 py-1 font-mono text-xs font-bold text-red-700"
                    >
                      {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

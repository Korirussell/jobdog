'use client';

import { useState } from 'react';
import MorphingHeader from '@/components/MorphingHeader';
import TerminalDecryptor from '@/components/TerminalDecryptor';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const { user, isAuthenticated, logout } = useAuth();
  const [visibility, setVisibility] = useState('PRIVATE');

  const handleTerminalCommand = async (command: string): Promise<string> => {
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0];

    if (cmd === 'decrypt_comp') {
      const companyMatch = command.match(/--company\s+"([^"]+)"/);
      if (!companyMatch) return 'ERROR: Usage: decrypt_comp --company "CompanyName"';
      const company = companyMatch[1];
      try {
        const result = await api.getGhostScore(company);
        return [
          `COMPANY: ${result.company}`,
          `TOTAL JOBS: ${result.totalJobs}`,
          `AVG DAYS OPEN: ${result.avgDaysOpen}`,
          `GHOST REPORTS: ${result.ghostReports}`,
          '',
          'Salary data requires Lever integration for this company.',
          'Try: ghost_scan --company "' + company + '"',
        ].join('\n');
      } catch {
        return `ERROR: Failed to fetch data for "${company}"`;
      }
    }

    if (cmd === 'ghost_scan') {
      const companyMatch = command.match(/--company\s+"([^"]+)"/);
      if (!companyMatch) return 'ERROR: Usage: ghost_scan --company "CompanyName"';
      const company = companyMatch[1];
      try {
        const result = await api.getGhostScore(company);
        const bar = '█'.repeat(Math.floor(result.ghostScore / 5)) + '░'.repeat(20 - Math.floor(result.ghostScore / 5));
        return [
          `GHOST SCAN: ${result.company}`,
          `────────────────────────────`,
          `GHOST SCORE: ${result.ghostScore}/100 [${bar}]`,
          `GHOST REPORTS: ${result.ghostReports}`,
          `AVG DAYS OPEN: ${result.avgDaysOpen}`,
          `TOTAL LISTINGS: ${result.totalJobs}`,
          '',
          result.ghostScore > 70 ? '⚠ WARNING: HIGH GHOST PROBABILITY' :
          result.ghostScore > 40 ? '⚡ MODERATE: Proceed with caution' :
          '✓ LOW RISK: Company appears responsive',
        ].join('\n');
      } catch {
        return `ERROR: Scan failed for "${company}"`;
      }
    }

    return `UNKNOWN COMMAND: ${cmd}\nType "help" for available commands.`;
  };

  return (
    <div className="min-h-screen">
      <MorphingHeader />
      
      <main className="mx-auto min-h-screen max-w-6xl px-6 pt-8">
        <div className="space-y-6">
          {/* Account Section */}
          <div className="border-[3px] border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-[3px] border-black bg-primary px-4 py-2">
              <h2 className="font-mono text-sm font-bold uppercase">SETTINGS.CFG</h2>
            </div>
            <div className="p-6">
              {isAuthenticated ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block font-mono text-xs font-bold uppercase text-text-secondary">EMAIL</label>
                    <div className="w-full border-2 border-black/10 bg-background px-3 py-2 font-mono text-sm">{user?.email}</div>
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-xs font-bold uppercase text-text-secondary">DISPLAY_NAME</label>
                    <div className="w-full border-2 border-black/10 bg-background px-3 py-2 font-mono text-sm">{user?.displayName}</div>
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-xs font-bold uppercase text-text-secondary">PROFILE_VISIBILITY</label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                      className="w-full border-2 border-black/10 bg-white px-3 py-2 font-mono text-sm"
                    >
                      <option value="PRIVATE">PRIVATE — Only you can see scores</option>
                      <option value="FRIENDS">FRIENDS — Visible to connections</option>
                      <option value="PUBLIC">PUBLIC — Visible to everyone</option>
                    </select>
                  </div>
                  <button
                    onClick={logout}
                    className="border-2 border-danger bg-white px-6 py-2 font-mono text-sm font-bold text-danger transition-all hover:bg-danger hover:text-white"
                  >
                    LOGOUT.EXE
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="font-mono text-sm text-text-secondary">LOGIN_REQUIRED.ERR</p>
                  <a href="/login" className="mt-4 inline-block border-2 border-black bg-primary px-6 py-3 font-mono text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    LOGIN.EXE
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Terminal Decryptor */}
          <TerminalDecryptor onCommand={handleTerminalCommand} />
        </div>
      </main>
    </div>
  );
}

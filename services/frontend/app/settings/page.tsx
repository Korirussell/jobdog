'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import AuthGuard from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const { user, logout, updateProfileVisibility } = useAuth();
  const router = useRouter();
  const [visibility, setVisibility] = useState('PRIVATE');
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [visibilityError, setVisibilityError] = useState('');

  useEffect(() => {
    if (user?.profileVisibility) {
      setVisibility(user.profileVisibility);
    }
  }, [user?.profileVisibility]);

  const handleVisibilityChange = async (next: string) => {
    setVisibility(next);
    setVisibilityError('');
    setSavingVisibility(true);
    try {
      await updateProfileVisibility(next);
    } catch {
      setVisibilityError('Failed to save. Please try again.');
      setVisibility(user?.profileVisibility ?? 'PRIVATE');
    } finally {
      setSavingVisibility(false);
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar />
      <AuthGuard>
      <main className="mx-auto min-h-screen max-w-6xl px-6 pt-8">
        <div className="space-y-6">
          {/* Account Section */}
          <div className="border-[3px] border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-[3px] border-black bg-primary px-4 py-2">
              <h2 className="font-mono text-sm font-bold uppercase">SETTINGS.CFG</h2>
            </div>
            <div className="p-6">
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
                    onChange={(e) => handleVisibilityChange(e.target.value)}
                    disabled={savingVisibility}
                    className="w-full border-2 border-black/10 bg-white px-3 py-2 font-mono text-sm disabled:opacity-50"
                  >
                    <option value="PRIVATE">PRIVATE — Only you can see scores</option>
                    <option value="FRIENDS">FRIENDS — Visible to connections</option>
                    <option value="PUBLIC">PUBLIC — Visible to everyone</option>
                  </select>
                  {savingVisibility && <p className="mt-1 font-mono text-xs text-text-tertiary">Saving...</p>}
                  {visibilityError && <p className="mt-1 font-mono text-xs text-red-600">{visibilityError}</p>}
                </div>
                <button
                  onClick={() => { logout(); router.replace('/'); }}
                  className="border-2 border-red-500 bg-white px-6 py-2 font-mono text-sm font-bold text-red-600 transition-all hover:bg-red-500 hover:text-white"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>
      </AuthGuard>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import AuthGuard from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const { user, logout, updateShareName } = useAuth();
  const router = useRouter();
  const [shareName, setShareName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    setShareName(user?.shareName ?? '');
  }, [user?.shareName]);

  const dirty = shareName.trim() !== (user?.shareName ?? '');

  const handleSaveShareName = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      await updateShareName(shareName);
      setSaveMessage('Saved.');
    } catch {
      setSaveMessage('Failed to save. Please try again.');
    } finally {
      setSaving(false);
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
                  <label className="mb-1 block font-mono text-xs font-bold uppercase text-text-secondary">SHARE_NAME</label>
                  <div className="flex gap-2">
                    <input
                      value={shareName}
                      onChange={(e) => setShareName(e.target.value)}
                      maxLength={40}
                      placeholder={user?.displayName}
                      className="min-w-0 flex-1 border-2 border-black/10 bg-white px-3 py-2 font-mono text-sm"
                    />
                    <button
                      onClick={handleSaveShareName}
                      disabled={!dirty || saving}
                      className="border-2 border-black bg-primary px-4 py-2 font-mono text-xs font-bold disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-text-tertiary">
                    The name shown on your shared score link. Anyone with the link can view it, no account needed. Leave blank to use your display name.
                  </p>
                  {saveMessage && <p className="mt-1 font-mono text-xs text-text-secondary">{saveMessage}</p>}
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

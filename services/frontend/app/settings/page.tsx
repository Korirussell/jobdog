'use client';

import MorphingHeader from '@/components/MorphingHeader';

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <MorphingHeader />
      
      <main className="mx-auto min-h-screen max-w-6xl px-6 pt-8">
        <div className="mb-6">
          <h1 className="mb-2 font-mono text-2xl font-bold text-text-primary">
            ⚙️ SETTINGS.CFG
          </h1>
          <p className="font-mono text-sm text-text-secondary">
            Configure your preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Account Section */}
          <div className="border-2 border-black/10 bg-white p-6">
            <h2 className="mb-4 font-mono text-lg font-bold text-text-primary">
              ACCOUNT_INFO
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block font-mono text-xs font-bold uppercase text-text-secondary">
                  EMAIL
                </label>
                <input
                  type="email"
                  className="w-full border-2 border-black/10 bg-background px-3 py-2 font-mono text-sm"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs font-bold uppercase text-text-secondary">
                  DISPLAY_NAME
                </label>
                <input
                  type="text"
                  className="w-full border-2 border-black/10 bg-background px-3 py-2 font-mono text-sm"
                  placeholder="Your Name"
                />
              </div>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="border-2 border-black/10 bg-white p-6">
            <h2 className="mb-4 font-mono text-lg font-bold text-text-primary">
              PREFERENCES
            </h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" className="h-4 w-4" />
                <span className="font-mono text-sm text-text-primary">
                  Email notifications for new matches
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" className="h-4 w-4" />
                <span className="font-mono text-sm text-text-primary">
                  Daily job digest
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" className="h-4 w-4" />
                <span className="font-mono text-sm text-text-primary">
                  Remote-only positions
                </span>
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button className="border-2 border-black/20 bg-primary px-8 py-3 font-mono text-sm font-bold uppercase text-text-primary transition-all hover:bg-primary-dark">
              SAVE_CONFIG
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import MorphingHeader from '@/components/MorphingHeader';
import { api } from '@/lib/api';

interface Resume {
  resumeId: string;
  label: string;
  originalFilename: string;
  status: string;
  uploadedAt: string;
}

export default function VaultPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchResumes();
  }, []);

  async function fetchResumes() {
    try {
      const response = await api.getResumes();
      setResumes(response.items);
    } catch (err) {
      console.error('Failed to fetch resumes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await api.uploadResume(file);
      await fetchResumes();
    } catch (err) {
      console.error('Failed to upload resume:', err);
      alert('Failed to upload resume');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <MorphingHeader />
      
      <main className="mx-auto min-h-screen max-w-6xl px-6 pt-8">
        <div className="mb-6">
          <h1 className="mb-2 font-mono text-2xl font-bold text-text-primary">
            📁 RESUME_VAULT/
          </h1>
          <p className="font-mono text-sm text-text-secondary">
            Manage your resume collection
          </p>
        </div>

        {/* Upload Section */}
        <div className="mb-6 border-2 border-black/10 bg-white p-6">
          <h2 className="mb-4 font-mono text-lg font-bold text-text-primary">
            UPLOAD_NEW.EXE
          </h2>
          <label className="flex cursor-pointer items-center justify-center border-2 border-dashed border-black/20 bg-background p-8 transition-all hover:border-primary hover:bg-primary/5">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
            <div className="text-center">
              <div className="mb-2 text-4xl">📄</div>
              <p className="font-mono text-sm font-bold text-text-primary">
                {uploading ? 'UPLOADING...' : 'CLICK_TO_UPLOAD'}
              </p>
              <p className="mt-1 font-mono text-xs text-text-tertiary">
                PDF, DOC, DOCX
              </p>
            </div>
          </label>
        </div>

        {/* Resume List */}
        <div className="border-b-2 border-black/10 py-2">
          <p className="font-mono text-xs font-bold uppercase text-text-secondary">
            SHOWING <span className="text-text-primary">{resumes.length}</span> RESUMES
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="font-mono text-sm text-text-secondary">
              <span className="animate-pulse">█</span> LOADING_VAULT.EXE
            </div>
          </div>
        ) : resumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 text-6xl">📂</div>
            <p className="font-mono text-sm text-text-secondary">
              VAULT_EMPTY.TXT
            </p>
            <p className="mt-2 text-sm text-text-tertiary">
              Upload your first resume to get started
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {resumes.map((resume) => (
              <div
                key={resume.resumeId}
                className="flex items-center justify-between border-2 border-black/10 bg-white p-4 transition-all hover:border-black/20"
              >
                <div className="flex items-center gap-4">
                  <div className="text-2xl">📄</div>
                  <div>
                    <h3 className="font-mono text-sm font-bold text-text-primary">
                      {resume.label || resume.originalFilename}
                    </h3>
                    <p className="font-mono text-xs text-text-tertiary">
                      Uploaded: {new Date(resume.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="font-mono text-xs font-bold uppercase text-text-secondary">
                  {resume.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

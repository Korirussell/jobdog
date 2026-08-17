'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ApplyModal from '@/components/ApplyModal';

interface JobDetailApplyButtonProps {
  jobId: string;
  jobTitle: string;
  company: string;
  applyUrl: string;
  postedAt: string | null;
  scrapedAt: string;
}

export default function JobDetailApplyButton({ jobId, jobTitle, company, applyUrl, postedAt, scrapedAt }: JobDetailApplyButtonProps) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <a
        href={applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full border-2 border-black bg-primary px-4 py-2.5 font-mono text-sm font-bold uppercase text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      >
        Apply ↗
      </a>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="block w-full border-2 border-black bg-primary px-4 py-2.5 font-mono text-sm font-bold uppercase text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      >
        Apply ↗
      </button>
      {open && (
        <ApplyModal
          jobId={jobId}
          jobTitle={jobTitle}
          company={company}
          applyUrl={applyUrl}
          postedAt={postedAt}
          scrapedAt={scrapedAt}
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      )}
    </>
  );
}

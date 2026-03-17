'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="font-mono text-2xl font-bold text-text-primary">
          ⚠ PAGE_ERROR
        </h1>
        <p className="mt-4 font-mono text-sm text-text-secondary">
          {error.message || 'Failed to load this page'}
        </p>
        <button
          onClick={reset}
          className="mt-6 border-2 border-black bg-primary px-6 py-2 font-mono text-sm font-bold uppercase hover:bg-primary-dark"
        >
          TRY_AGAIN
        </button>
      </div>
    </div>
  );
}

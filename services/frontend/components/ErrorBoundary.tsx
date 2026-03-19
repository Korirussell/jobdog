'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // TODO: Send to monitoring service (Sentry, DataDog, etc.)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="font-mono text-2xl font-bold text-text-primary">
              ⚠ SYSTEM_ERROR
            </h1>
            <p className="mt-4 font-mono text-sm text-text-secondary">
              {this.state.error?.message || 'Something went wrong'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 border-2 border-black bg-primary px-6 py-2 font-mono text-sm font-bold uppercase hover:bg-primary-dark"
            >
              RELOAD_PAGE
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

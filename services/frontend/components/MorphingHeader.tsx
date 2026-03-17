'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function MorphingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = window.innerHeight * 0.7;
      setScrolled(window.scrollY > heroHeight);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Large Hero - Initial State */}
      <section
        className={`
          relative flex min-h-[85vh] flex-col items-center justify-center px-6 py-20
          transition-opacity duration-500
          ${scrolled ? 'pointer-events-none opacity-0' : 'opacity-100'}
        `}
      >
        {/* Top-Right Utility Nav */}
        <div className="absolute right-3 top-3 flex items-center gap-2 sm:right-6 sm:top-6 sm:gap-4">
          <a
            href="/login"
            className="
              px-2 py-1 font-mono text-xs font-bold text-text-secondary
              transition-colors hover:text-text-primary
              sm:px-0 sm:text-sm
            "
          >
            LOGIN
          </a>
          <a
            href="/vault"
            className="
              flex items-center gap-1 border-2 border-black/20 bg-white px-2 py-1
              font-mono text-xs font-bold text-text-primary
              transition-all hover:border-black hover:bg-background-secondary
              sm:gap-2 sm:px-3 sm:py-1.5
            "
          >
            <span>📁</span>
            <span className="hidden sm:inline">VAULT</span>
          </a>
        </div>

        <div className="mb-8">
          <Image
            src="/assets/jobdog.png"
            alt="JobDog Logo"
            width={200}
            height={200}
            className="pixelated"
            priority
          />
        </div>

        <h1 className="mb-4 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl md:text-6xl lg:text-7xl">
          jobdog.dev
        </h1>

        <p className="mb-8 max-w-2xl text-center text-base text-text-secondary sm:text-lg md:text-xl">
          The high-speed SWE internship aggregator.
        </p>

        {/* Primary CTA */}
        <button
          onClick={() => {
            const jobList = document.querySelector('main');
            jobList?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="
            group relative border-2 border-black bg-primary px-6 py-3
            font-mono text-sm font-bold uppercase text-text-primary
            shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
            transition-all
            hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
            hover:translate-x-[2px] hover:translate-y-[2px]
            active:shadow-none
            active:translate-x-[4px] active:translate-y-[4px]
            sm:px-8 sm:py-4 sm:text-base
          "
        >
          <span className="mr-2">&gt;</span>
          INITIALIZE_SCAN
        </button>

        <div className="mt-16 animate-bounce">
          <svg
            className="h-6 w-6 text-text-tertiary"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
          </svg>
        </div>
      </section>

      {/* Morphed Sticky Header - Scrolled State */}
      <div
        className={`
          fixed left-0 right-0 top-0 z-50 
          border-b-2 border-black/10 backdrop-blur-md
          transition-all duration-500
          ${
            scrolled
              ? 'translate-y-0 bg-background/90 opacity-100'
              : 'pointer-events-none -translate-y-full opacity-0'
          }
        `}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2">
          {/* Left Side - Current Location Indicator */}
          <a 
            href="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-70"
          >
            <Image
              src="/assets/jobdog.png"
              alt="JobDog"
              width={32}
              height={32}
              className="pixelated"
            />
            <div className="flex items-center gap-1.5 font-mono text-sm">
              <span className="font-bold text-text-primary">jobdog.dev</span>
              <span className="text-text-tertiary">~/</span>
              <span className="text-text-secondary">root</span>
              <span className="text-text-tertiary">/</span>
              <span className="font-bold text-text-primary">all_jobs.exe</span>
            </div>
          </a>

          {/* Right Side - Action Buttons */}
          <nav className="flex items-center gap-2">
            <a
              href="/saved"
              className="
                border-2 border-transparent px-4 py-2
                font-mono text-sm font-bold uppercase text-text-secondary
                transition-all
                hover:border-black hover:bg-white hover:text-text-primary
              "
            >
              SAVED
            </a>
            <a
              href="/applications"
              className="
                border-2 border-transparent px-4 py-2
                font-mono text-sm font-bold uppercase text-text-secondary
                transition-all
                hover:border-black hover:bg-white hover:text-text-primary
              "
            >
              APPLIED
            </a>
            <a
              href="/settings"
              className="
                border-2 border-transparent px-4 py-2
                font-mono text-sm font-bold uppercase text-text-secondary
                transition-all
                hover:border-black hover:bg-white hover:text-text-primary
              "
            >
              SETTINGS
            </a>
          </nav>
        </div>
      </div>
    </>
  );
}

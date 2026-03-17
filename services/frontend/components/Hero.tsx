'use client';

import Image from 'next/image';

export default function Hero() {
  return (
    <section className="flex min-h-[85vh] flex-col items-center justify-center px-6 py-20">
      {/* 8-bit Logo */}
      <div className="mb-8">
        <Image
          src="/assets/jobdog.png"
          alt="JobDog 8-bit Logo"
          width={200}
          height={200}
          className="pixelated"
          priority
        />
      </div>

      {/* Main Heading */}
      <h1 className="mb-4 text-6xl font-bold tracking-tight text-text-primary md:text-7xl">
        jobdog.dev
      </h1>

      {/* Subtitle */}
      <p className="max-w-2xl text-center text-lg text-text-secondary md:text-xl">
        The high-speed SWE internship aggregator.
      </p>

      {/* Scroll indicator */}
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
  );
}

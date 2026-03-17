'use client';

import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block font-mono text-sm font-bold uppercase text-gray-900">
          {label}
        </label>
      )}
      <input
        className={`
          w-full border-thick border-black bg-white px-4 py-3
          font-mono text-sm shadow-brutal-sm
          transition-all
          focus:shadow-brutal focus:outline-none
          disabled:cursor-not-allowed disabled:opacity-50
          ${error ? 'border-danger' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 font-mono text-xs text-danger">{error}</p>
      )}
    </div>
  );
}

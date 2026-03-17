'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}

export default function Card({
  children,
  className = '',
  hoverable = false,
}: CardProps) {
  return (
    <div
      className={`
        border-thick border-black bg-white p-6 shadow-brutal
        ${hoverable ? 'brutal-hover cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

'use client';

import { ReactNode, useState } from 'react';

interface WindowFrameProps {
  title: string;
  children: ReactNode;
  className?: string;
  defaultMinimized?: boolean;
  closeable?: boolean;
  onClose?: () => void;
}

export default function WindowFrame({
  title,
  children,
  className = '',
  defaultMinimized = false,
  closeable = false,
  onClose,
}: WindowFrameProps) {
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);
  const [isClosed, setIsClosed] = useState(false);

  const handleClose = () => {
    setIsClosed(true);
    onClose?.();
  };

  if (isClosed) return null;

  return (
    <div
      className={`
        border-thick border-black bg-white shadow-brutal
        ${className}
      `}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between border-b-[3px] border-black bg-primary px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 border-2 border-black bg-white" />
          <h3 className="font-mono text-sm font-bold uppercase tracking-wide text-white">
            {title}
          </h3>
        </div>

        {/* Window Controls */}
        <div className="flex gap-2">
          {/* Minimize Button */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="
              flex h-6 w-6 items-center justify-center
              border-2 border-black bg-accent
              brutal-hover
              hover:bg-yellow-300
            "
            aria-label={isMinimized ? 'Maximize' : 'Minimize'}
          >
            <span className="font-mono text-xs font-bold">
              {isMinimized ? '□' : '_'}
            </span>
          </button>

          {/* Close Button */}
          {closeable && (
            <button
              onClick={handleClose}
              className="
                flex h-6 w-6 items-center justify-center
                border-2 border-black bg-danger
                brutal-hover
                hover:bg-red-600
              "
              aria-label="Close"
            >
              <span className="font-mono text-xs font-bold text-white">×</span>
            </button>
          )}
        </div>
      </div>

      {/* Window Content */}
      {!isMinimized && (
        <div className="p-6">
          {children}
        </div>
      )}
    </div>
  );
}

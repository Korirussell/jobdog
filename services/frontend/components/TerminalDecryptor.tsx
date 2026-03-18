'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';

interface TerminalDecryptorProps {
  onCommand: (command: string) => Promise<string>;
}

interface HistoryLine {
  id: number;
  type: 'input' | 'output';
  text: string;
}

const MAX_HISTORY = 50;

const HELP_TEXT = `
╔══════════════════════════════════════════════╗
║          SALARY_DECRYPTOR v2.4.1             ║
║          AVAILABLE COMMANDS                  ║
╠══════════════════════════════════════════════╣
║                                              ║
║  help                                        ║
║    Show this message                         ║
║                                              ║
║  decrypt_comp --company "COMPANY"            ║
║    Decrypt compensation data for a company   ║
║                                              ║
║  ghost_scan --company "COMPANY"              ║
║    Scan ghosting probability for a company   ║
║                                              ║
║  clear                                       ║
║    Clear terminal output                     ║
║                                              ║
╚══════════════════════════════════════════════╝`.trim();

export default function TerminalDecryptor({ onCommand }: TerminalDecryptorProps) {
  const [history, setHistory] = useState<HistoryLine[]>([
    { id: 0, type: 'output', text: 'SALARY_DECRYPTOR v2.4.1 — Type "help" for commands.' },
    { id: 1, type: 'output', text: 'Ready.' },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [displayedOutput, setDisplayedOutput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdIndex, setCmdIndex] = useState(-1);
  const lineIdRef = useRef(2);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(scrollToBottom, [history, displayedOutput, scrollToBottom]);

  const typeOut = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      setIsTyping(true);
      setDisplayedOutput('');
      let i = 0;
      const step = () => {
        const chunkSize = Math.min(3, text.length - i);
        i += chunkSize;
        setDisplayedOutput(text.slice(0, i));
        if (i < text.length) {
          requestAnimationFrame(step);
        } else {
          setIsTyping(false);
          setDisplayedOutput('');
          resolve();
        }
      };
      if (text.length === 0) {
        setIsTyping(false);
        resolve();
        return;
      }
      requestAnimationFrame(step);
    });
  }, []);

  const pushLines = useCallback((text: string, type: 'input' | 'output') => {
    setHistory((prev) => {
      const newLines = text.split('\n').map((line) => ({
        id: lineIdRef.current++,
        type,
        text: line,
      }));
      const merged = [...prev, ...newLines];
      return merged.length > MAX_HISTORY ? merged.slice(merged.length - MAX_HISTORY) : merged;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    pushLines(`> ${trimmed}`, 'input');
    setInput('');
    setCmdHistory((prev) => [trimmed, ...prev].slice(0, 50));
    setCmdIndex(-1);

    if (trimmed === 'clear') {
      setHistory([]);
      return;
    }

    if (trimmed === 'help') {
      await typeOut(HELP_TEXT);
      pushLines(HELP_TEXT, 'output');
      return;
    }

    try {
      const result = await onCommand(trimmed);
      await typeOut(result);
      pushLines(result, 'output');
    } catch {
      const err = 'ERR: Command execution failed. Try "help".';
      await typeOut(err);
      pushLines(err, 'output');
    }
  }, [input, isTyping, onCommand, pushLines, typeOut]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCmdIndex((prev) => {
        const next = Math.min(prev + 1, cmdHistory.length - 1);
        if (cmdHistory[next]) setInput(cmdHistory[next]);
        return next;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCmdIndex((prev) => {
        const next = prev - 1;
        if (next < 0) {
          setInput('');
          return -1;
        }
        if (cmdHistory[next]) setInput(cmdHistory[next]);
        return next;
      });
    }
  }, [handleSubmit, cmdHistory]);

  return (
    <div
      className="relative border-[3px] border-black font-mono shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between border-b-[3px] border-black bg-primary px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-primary">▸▸</span>
          <span className="text-xs font-bold tracking-wider text-text-primary">
            SALARY_DECRYPTOR.EXE
          </span>
        </div>
        <div className="flex gap-1">
          <button className="flex h-5 w-5 items-center justify-center border-2 border-black bg-gray-200 text-[10px] font-bold leading-none hover:bg-gray-300">
            _
          </button>
          <button className="flex h-5 w-5 items-center justify-center border-2 border-black bg-gray-200 text-[10px] font-bold leading-none hover:bg-gray-300">
            □
          </button>
          <button className="flex h-5 w-5 items-center justify-center border-2 border-black bg-danger text-[10px] font-bold leading-none text-white hover:bg-red-600">
            ×
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="relative overflow-hidden bg-[#0a0a0a]">
        {/* CRT scanline overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background: 'repeating-linear-gradient(0deg, rgba(0,255,0,0.03) 0px, rgba(0,255,0,0.03) 1px, transparent 1px, transparent 3px)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)',
          }}
        />

        {/* Scrollable output */}
        <div ref={scrollRef} className="h-[350px] overflow-y-auto p-3">
          {history.map((line) => (
            <div
              key={line.id}
              className={`whitespace-pre-wrap text-[12px] leading-5 ${
                line.type === 'input'
                  ? 'text-[#4ade80] brightness-125'
                  : 'text-[#22c55e]'
              }`}
            >
              {line.text}
            </div>
          ))}

          {/* Typing animation line */}
          {isTyping && (
            <div className="whitespace-pre-wrap text-[12px] leading-5 text-[#22c55e]">
              {displayedOutput}
              <span className="animate-pulse">▊</span>
            </div>
          )}
        </div>

        {/* Input Line */}
        <div className="flex items-center border-t border-[#22c55e]/20 px-3 py-2">
          <span className="mr-2 text-[12px] text-[#4ade80]">&gt;</span>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
              spellCheck={false}
              autoComplete="off"
              className="
                w-full bg-transparent text-[12px] text-[#4ade80] caret-transparent
                outline-none placeholder:text-[#22c55e]/30
                disabled:opacity-50
              "
              placeholder={isTyping ? '' : 'type a command...'}
            />
            {/* Fake blinking block cursor */}
            {!isTyping && (
              <span
                className="pointer-events-none absolute top-0 text-[12px] leading-none text-[#4ade80]"
                style={{ left: `${input.length * 7.22}px` }}
              >
                <span className="animate-blink">▊</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
      `}</style>
    </div>
  );
}

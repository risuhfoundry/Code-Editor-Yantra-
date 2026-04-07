'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="m-0 bg-[#05050b] font-sans text-white">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/34">Yantra recovery</div>
            <h1 className="mt-4 font-display text-[2.7rem] leading-[0.94] tracking-[-0.05em] text-white">
              The outer shell needs a reset.
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/64">
              A top-level error interrupted the app. Resetting should reload the current shell and bring the session back.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 inline-flex items-center rounded-full bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-black transition hover:scale-[0.99]"
            >
              Reset app
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

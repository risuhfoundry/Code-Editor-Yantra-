import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-[24px]">
        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/70">
          Local Preview
        </div>
        <h1 className="mt-5 font-display text-5xl leading-[0.95] tracking-tight text-white">
          Yantra Editor
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">
          This workspace is running as a local development shell around the editor slice in this repository.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/editor"
            className="inline-flex items-center rounded-full bg-white px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-black"
          >
            Open Editor
          </Link>
          <Link
            href="/editor/projects"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white"
          >
            Dev Notes
          </Link>
        </div>
      </div>
    </main>
  );
}

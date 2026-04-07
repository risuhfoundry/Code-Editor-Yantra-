import Link from 'next/link';
import { ArrowRight, FileCode2, FolderTree, PlayCircle, Share2, Sparkles, type LucideIcon } from 'lucide-react';
import SiteShell from '@/components/site/SiteShell';

const GUIDE_STEPS: ReadonlyArray<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: 'Open the editor',
    description: 'Launch Yantra at `/editor` and drop into the live workspace instead of preparing a local toolchain first.',
    icon: FileCode2,
  },
  {
    title: 'Choose the draft mode',
    description: 'Start with Python for quick logic or the web template when HTML, CSS, and JavaScript need to move together.',
    icon: FolderTree,
  },
  {
    title: 'Run and inspect',
    description: 'Edit files, click Run, and use the output or preview panel to tighten the loop while the context is still fresh.',
    icon: PlayCircle,
  },
  {
    title: 'Share or remix',
    description: 'Generate a public link when you want feedback, or remix a shared project into your own workspace in one step.',
    icon: Share2,
  },
] as const;

const NOTES = [
  'Python projects run in-browser through Pyodide, so the first experiment does not depend on local runtime setup.',
  'Web playgrounds give you HTML, CSS, and JavaScript starter files plus an instant iframe preview on Run.',
  'Autosave keeps the workspace updated every two seconds, and public editor access no longer requires sign-in.',
  'Shared project views remain available through their existing share routes, so remix flows stay lightweight.',
] as const;

export default function GuidePage() {
  return (
    <SiteShell>
      <main className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <section className="max-w-5xl py-10 sm:py-16">
          <div className="site-kicker">
            <Sparkles className="h-3.5 w-3.5" />
            Getting started / First session
          </div>
          <h1 className="mt-8 font-display text-[4rem] leading-[0.88] tracking-[-0.07em] text-white sm:text-[5.2rem] lg:text-[5.9rem]">
            From blank screen to shareable draft in a few deliberate moves.
          </h1>
          <p className="site-copy mt-6 max-w-3xl text-base leading-8 sm:text-lg">
            Yantra is intentionally simple to enter. Open the workspace, choose a project shape, run code, inspect the result, and share the exact session when you are ready for another pair of eyes.
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {GUIDE_STEPS.map((step, index) => {
            const Icon = step.icon;

            return (
              <section key={step.title} className="site-panel site-glass-hover rounded-[2rem] p-6 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.04] text-white/74">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/24">0{index + 1}</div>
                </div>
                <h2 className="mt-6 font-display text-[2.3rem] leading-[0.96] tracking-[-0.05em] text-white">{step.title}</h2>
                <p className="site-copy mt-3 text-sm leading-7">{step.description}</p>
              </section>
            );
          })}
        </div>

        <section className="pt-20">
          <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="site-panel-strong rounded-[2.15rem] p-6 sm:p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/34">Quick first run</div>
              <div className="mt-5 overflow-hidden rounded-[1.85rem] border border-white/10 bg-[#080808]">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-white/58">
                    main.py
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/34">first pass</div>
                </div>

                <div className="space-y-2 px-5 py-6 font-mono text-[13px] leading-7 text-white/78">
                  <div>
                    <span className="mr-4 text-white/18">1</span>
                    <span className="text-white/46">print</span>(<span className="text-white/64">&quot;Hello, Yantra!&quot;</span>)
                  </div>
                  <div>
                    <span className="mr-4 text-white/18">2</span>
                    <span className="text-white/46">print</span>(<span className="text-white/64">&quot;The workspace is live.&quot;</span>)
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[1.8rem] bg-[linear-gradient(180deg,#f4efe7,#d8d2c7)] p-5 text-[#090909] shadow-[0_28px_48px_rgba(0,0,0,0.32)]">
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/46">Output</div>
                <div className="mt-4 font-mono text-sm text-black/76">&gt; Hello, Yantra!</div>
                <div className="mt-1 font-mono text-sm text-black/76">&gt; The workspace is live.</div>
              </div>
            </div>

            <div className="site-panel rounded-[2.15rem] p-6 sm:p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/34">Helpful notes</div>
              <div className="mt-5 space-y-4">
                {NOTES.map((note) => (
                  <div key={note} className="rounded-[1.55rem] border border-white/8 bg-black/20 px-4 py-4 text-sm leading-7 text-white/64">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="pt-24 pb-8">
          <div className="site-panel-strong rounded-[2.45rem] px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
            <div className="max-w-4xl">
              <div className="site-kicker">Ready / Enter the workspace</div>
              <h2 className="mt-6 font-display text-[3rem] leading-[0.92] tracking-[-0.06em] text-white sm:text-[4.4rem]">
                Open the workspace and let the first runnable idea set the tone.
              </h2>
              <p className="site-copy mt-5 max-w-2xl text-base leading-8 sm:text-lg">
                The shortest path is still simple: launch the editor, make a change, run it, and share the result when you want feedback or a remix.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/editor" className="site-button-primary">
                  Open Editor
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link href="/features" className="site-button-secondary">
                  Explore Features
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}

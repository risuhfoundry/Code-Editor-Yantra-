const VISUALS = [
  {
    title: 'Monaco Editor',
    tone: 'from-cyan-400/18 via-sky-400/8 to-transparent',
    labels: ['Tabs', 'Selection', 'Inline markers'],
  },
  {
    title: 'Run and Inspect',
    tone: 'from-emerald-400/18 via-emerald-400/8 to-transparent',
    labels: ['Pyodide', 'Terminal', 'Execution time'],
  },
  {
    title: 'AI Assist',
    tone: 'from-violet-400/18 via-violet-400/8 to-transparent',
    labels: ['Quick prompts', 'Context', 'Insert result'],
  },
  {
    title: 'Workspace',
    tone: 'from-amber-300/18 via-amber-200/8 to-transparent',
    labels: ['Explorer', 'Search', 'Diff view'],
  },
  {
    title: 'Share and Embed',
    tone: 'from-rose-300/18 via-rose-300/8 to-transparent',
    labels: ['Share link', 'Read-only view', 'Embed URL'],
  },
  {
    title: 'Reliability',
    tone: 'from-cyan-300/14 via-violet-300/10 to-transparent',
    labels: ['Loading skeleton', 'Progress', 'Recovery'],
  },
] as const;

export default function FeatureVisualGallery() {
  return (
    <section className="pt-24">
      <div className="site-panel-strong rounded-[2.3rem] p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/34">Feature visuals</div>
          <h2 className="mt-4 font-display text-[2.8rem] leading-[0.94] tracking-[-0.05em] text-white sm:text-[4rem]">
            A quick visual read before opening the full workspace.
          </h2>
          <p className="site-copy mt-5 text-base leading-8">
            Each card mirrors a real surface in Yantra so the features page shows what the product feels like, not just what it claims.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {VISUALS.map((visual) => (
            <div key={visual.title} className="overflow-hidden rounded-[1.9rem] border border-white/8 bg-black/20">
              <div className={`h-40 bg-gradient-to-br ${visual.tone} p-4`}>
                <div className="h-full rounded-[1.4rem] border border-white/10 bg-[#090b15] p-4 shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-300/80" />
                      <span className="h-2 w-2 rounded-full bg-amber-300/80" />
                      <span className="h-2 w-2 rounded-full bg-cyan-300/80" />
                    </div>
                    <div className="h-2 w-16 rounded-full bg-white/10" />
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-24 rounded-full bg-white/12" />
                    <div className="h-3 w-full rounded-full bg-white/6" />
                    <div className="h-3 w-3/4 rounded-full bg-white/6" />
                    <div className="mt-6 grid grid-cols-3 gap-2">
                      {visual.labels.map((label) => (
                        <div key={label} className="rounded-xl border border-white/8 bg-white/[0.04] px-2 py-2 text-center text-[10px] uppercase tracking-[0.12em] text-white/58">
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="font-display text-[1.55rem] leading-[0.98] tracking-[-0.04em] text-white">{visual.title}</div>
                <div className="mt-2 text-sm leading-7 text-white/62">A product-surface preview drawn from the same layout language as the editor.</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

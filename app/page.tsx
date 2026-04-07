import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Clock3,
  FileCode2,
  FolderTree,
  Globe,
  PlayCircle,
  Share2,
  Sparkles,
  Star,
  TerminalSquare,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';
import SiteShell from '@/components/site/SiteShell';
import HomeLiveDemo from '@/components/site/HomeLiveDemo';

const FEATURE_SET: ReadonlyArray<{
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    eyebrow: 'Editing Engine',
    title: 'Studio-grade editor',
    body: 'Monaco gives the workspace real structure, so the browser feels closer to a black-room control desk than a disposable snippet box.',
    icon: FileCode2,
    tone: 'site-icon-frame--cyan',
  },
  {
    eyebrow: 'Execution',
    title: 'Run without setup',
    body: 'Python executes through Pyodide and browser projects preview instantly, which keeps the loop immediate and alive.',
    icon: PlayCircle,
    tone: 'site-icon-frame--emerald',
  },
  {
    eyebrow: 'AI Guidance',
    title: 'AI in the same frame',
    body: 'Ask for explanation, debugging, or a better next move without leaving the active project or breaking focus.',
    icon: Bot,
    tone: 'site-icon-frame--violet',
  },
  {
    eyebrow: 'Workspace',
    title: 'Multi-file clarity',
    body: 'Explorer, tabs, and file awareness give small experiments the composure of a real working project from the first minute.',
    icon: FolderTree,
    tone: 'site-icon-frame--gold',
  },
  {
    eyebrow: 'Handoff',
    title: 'Share the exact state',
    body: 'Turn the current project into a public link so feedback, demos, and remixes start from the same source of truth.',
    icon: Share2,
    tone: 'site-icon-frame--rose',
  },
  {
    eyebrow: 'Memory',
    title: 'Local-first calm',
    body: 'Background saving keeps momentum intact, which makes the entire experience feel safer, quieter, and more premium.',
    icon: Clock3,
    tone: 'site-icon-frame--emerald',
  },
] as const;

const RITUALS: ReadonlyArray<{
  title: string;
  body: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    title: 'Write in atmosphere',
    body: 'The visual system stays dark, restrained, and cinematic so ideas feel framed instead of rushed.',
    icon: Sparkles,
    tone: 'site-icon-frame--violet',
  },
  {
    title: 'Review in context',
    body: 'Code, output, preview, and AI notes stay visible in one composition, which makes decisions easier to trust.',
    icon: TerminalSquare,
    tone: 'site-icon-frame--cyan',
  },
  {
    title: 'Present the draft',
    body: 'The same session that produced the idea can become the handoff, without screenshots, exports, or translation work.',
    icon: Globe,
    tone: 'site-icon-frame--gold',
  },
  {
    title: 'Move at browser speed',
    body: 'Open the tab, shape the draft, run it, and send the link before the energy drops.',
    icon: ArrowRight,
    tone: 'site-icon-frame--emerald',
  },
] as const;

const USE_CASES = [
  {
    text: 'Product demos that need polish before engineering catches up',
    tone: 'site-chip site-chip--gold',
  },
  {
    text: 'Teaching sessions where code, output, and explanation should stay in one room',
    tone: 'site-chip site-chip--cyan',
  },
  {
    text: 'Prototype reviews where remixing the exact project state matters more than slideware',
    tone: 'site-chip site-chip--violet',
  },
] as const;

const LANGUAGES = [
  { label: 'Python', tone: 'site-chip site-chip--gold' },
  { label: 'TypeScript', tone: 'site-chip site-chip--cyan' },
  { label: 'JavaScript', tone: 'site-chip site-chip--gold' },
  { label: 'HTML', tone: 'site-chip site-chip--rose' },
  { label: 'CSS', tone: 'site-chip site-chip--cyan' },
  { label: 'JSON', tone: 'site-chip site-chip--violet' },
  { label: 'Markdown', tone: 'site-chip site-chip--emerald' },
] as const;

const HERO_PILLARS = [
  {
    label: 'Momentum',
    text: 'From blank tab to a runnable project before the room cools off.',
    icon: Clock3,
    tone: 'site-icon-frame--gold',
  },
  {
    label: 'Execution',
    text: 'Code, output, and preview stay inside the same dark-glass composition.',
    icon: TerminalSquare,
    tone: 'site-icon-frame--cyan',
  },
  {
    label: 'Handoff',
    text: 'Share the exact state and let the next person remix forward immediately.',
    icon: Share2,
    tone: 'site-icon-frame--violet',
  },
] as const;

const CHANGELOG_ENTRIES = [
  {
    version: 'April 2026',
    title: 'Editor controls and diff view',
    body: 'Language switching, quick settings, search and replace, theme selection, and saved-vs-live diff mode now tighten the edit loop.',
  },
  {
    version: 'April 2026',
    title: 'Runtime upgrades',
    body: 'Python now runs in a dedicated worker with progress stages, a stop button, clearer stdin labeling, and execution-time feedback.',
  },
  {
    version: 'April 2026',
    title: 'AI and sharing polish',
    body: 'AI sessions keep conversational history, show active context, and can insert replies back into the editor. Shared projects now expose embed links too.',
  },
] as const;

function HeroStage() {
  return (
    <div className="site-panel-strong site-shimmer site-rise site-rise-delay-2 mx-auto w-full max-w-[44rem] rounded-[2.4rem]">
      <div className="absolute -left-8 top-10 h-32 w-32 rounded-full bg-[rgba(120,229,255,0.16)] blur-[90px]" />
      <div className="absolute bottom-[-4rem] right-[-2rem] h-44 w-44 rounded-full bg-[rgba(147,134,255,0.2)] blur-[120px]" />

      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f58db2]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f3c47e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#78e5ff]" />
        </div>
        <div className="rounded-full border border-[#78e5ff]/18 bg-[linear-gradient(135deg,rgba(120,229,255,0.1),rgba(147,134,255,0.08))] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.26em] text-[#caebff]">
          obsidian session
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.28fr_0.88fr]">
        <div className="border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40 sm:px-6">
            <span className="rounded-full border border-[#78e5ff]/16 bg-[linear-gradient(135deg,rgba(120,229,255,0.12),rgba(120,229,255,0.04))] px-3 py-1 text-[#c8f4ff]">
              main.py
            </span>
            <span>share-note.md</span>
          </div>

          <div className="space-y-6 px-5 py-6 sm:px-6">
            <div className="space-y-2 font-mono text-[13px] leading-7 text-white/78">
              <div>
                <span className="mr-4 text-white/18">1</span>
                <span className="text-[#b9adff]">def</span> <span className="text-[#8be8ff]">shape_pitch</span>(idea):
              </div>
              <div>
                <span className="mr-4 text-white/18">2</span>
                <span className="pl-6 text-[#d2f7ff]">draft</span> = <span className="text-[#f3c47e]">&quot;Turn quick code into a polished room.&quot;</span>
              </div>
              <div>
                <span className="mr-4 text-white/18">3</span>
                <span className="pl-6 text-[#79f3cf]">return</span> <span className="text-[#8be8ff]">idea</span> + <span className="text-white/56">&quot; / &quot;</span> + <span className="text-[#d6ccff]">draft</span>
              </div>
              <div>
                <span className="mr-4 text-white/18">4</span>
                <span className="text-[#d2f7ff]">message</span> = <span className="text-[#8be8ff]">shape_pitch</span>(<span className="text-[#f5a0c1]">&quot;Browser-native building&quot;</span>)
              </div>
              <div>
                <span className="mr-4 text-white/18">5</span>
                <span className="text-[#79f3cf]">print</span>(message)
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-[#9386ff]/18 bg-[linear-gradient(180deg,rgba(147,134,255,0.16),rgba(147,134,255,0.04))] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#d6ccff]">AI direction</div>
                <WandSparkles className="h-4 w-4 text-[#c5bcff]" />
              </div>
              <p className="mt-3 text-sm leading-7 text-white/74">
                Keep the copy spare. Let the typography carry the luxury and let the interface prove the product.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-black/20 px-5 py-6 sm:px-6">
          <div className="rounded-[1.6rem] border border-[#6df3c6]/18 bg-[linear-gradient(180deg,rgba(109,243,198,0.14),rgba(109,243,198,0.04))] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#b4fbe2]">Run output</div>
              <div className="rounded-full border border-[#6df3c6]/18 bg-[rgba(109,243,198,0.12)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9af5d7]">
                stable
              </div>
            </div>
            <div className="mt-4 font-mono text-sm text-[#c9fff0]">&gt; Browser-native building / Turn quick code into a polished room.</div>
          </div>

          <div className="mt-4 rounded-[1.7rem] bg-[linear-gradient(145deg,#f8efe2_0%,#ece8ff_50%,#dcf7ff_100%)] p-4 text-[#090909] shadow-[0_28px_48px_rgba(0,0,0,0.32)]">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/46">Preview fragment</div>
            <div className="mt-4">
              <div className="font-display text-[2rem] leading-[0.92] tracking-[-0.05em]">A premium frame for unfinished ideas.</div>
              <div className="site-rule mt-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(9, 9, 9, 0.18), transparent)' }} />
              <p className="mt-4 text-sm leading-6 text-black/64">Write. Run. Refine. Share the exact session forward.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: 'Live preview', tone: 'border-[#78e5ff]/14 bg-[rgba(120,229,255,0.08)] text-[#bceeff]' },
              { label: 'Share ready', tone: 'border-[#9386ff]/14 bg-[rgba(147,134,255,0.08)] text-[#d6ccff]' },
              { label: 'Autosaving', tone: 'border-[#6df3c6]/14 bg-[rgba(109,243,198,0.08)] text-[#c9fff0]' },
              { label: 'AI assist', tone: 'border-[#f3c47e]/14 bg-[rgba(243,196,126,0.08)] text-[#f7dab0]' },
            ].map((item) => (
              <div key={item.label} className={`rounded-[1.4rem] border px-4 py-3 text-sm ${item.tone}`}>
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-3xl">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/34">{eyebrow}</div>
      <h2 className="mt-4 font-display text-[2.8rem] leading-[0.94] tracking-[-0.05em] text-white sm:text-[3.9rem]">
        {title}
      </h2>
      <p className="site-copy mt-5 text-base leading-8 sm:text-lg">{body}</p>
    </div>
  );
}

async function getRepositoryStats() {
  try {
    const response = await fetch('https://api.github.com/repos/risuhfoundry/Code-Editor-Yantra-', {
      headers: {
        Accept: 'application/vnd.github+json',
      },
      next: {
        revalidate: 3600,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      stargazers_count?: number;
      forks_count?: number;
    };

    if (typeof payload.stargazers_count !== 'number') {
      return null;
    }

    return {
      stars: payload.stargazers_count,
      forks: typeof payload.forks_count === 'number' ? payload.forks_count : 0,
    };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const repoStats = await getRepositoryStats();

  return (
    <SiteShell>
      <main className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <section className="grid min-h-[calc(100svh-7rem)] items-center gap-14 py-10 lg:grid-cols-[0.92fr_1.08fr] lg:py-16">
          <div className="site-rise">
            <div className="site-kicker">
              <Sparkles className="h-3.5 w-3.5" />
              Obsidian Library / High-end editorial AI
            </div>

            <h1 className="mt-8 max-w-4xl font-display text-[4rem] leading-[0.88] tracking-[-0.07em] text-white sm:text-[5.6rem] lg:text-[6.7rem]">
              The browser becomes a{' '}
              <span className="bg-[linear-gradient(135deg,#78e5ff,#9386ff,#f3c47e)] bg-clip-text text-transparent">luminous studio</span>{' '}
              for code and ideas.
            </h1>

            <p className="site-copy mt-6 max-w-2xl text-base leading-8 sm:text-lg">
              Yantra turns quick experiments into presentation-ready sessions. Write code, run it instantly, shape the preview, and keep AI guidance in-frame inside a surface that feels immersive instead of disposable.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/editor" className="site-button-primary">
                Open Editor
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/guide" className="site-button-secondary">
                View Quick Start
              </Link>
            </div>

            <div className="mt-10 flex max-w-3xl flex-wrap gap-3">
              {LANGUAGES.map((language) => (
                <div key={language.label} className={language.tone}>
                  {language.label}
                </div>
              ))}
            </div>

            <div className="mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
              {HERO_PILLARS.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="site-panel site-glass-hover rounded-[1.65rem] p-4">
                    <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-white/34">{item.label}</div>
                    <div className="mt-4 flex items-start gap-3">
                      <div className={`site-icon-frame mt-0.5 h-10 w-10 ${item.tone}`}>
                        <Icon className="h-[18px] w-[18px]" />
                      </div>
                      <p className="text-sm leading-7 text-white/62">{item.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <HeroStage />
        </section>

        <section className="pt-2">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="site-panel rounded-[1.8rem] p-5">
              <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/38">
                <Star className="h-3.5 w-3.5 text-[#f3c47e]" />
                Social proof
              </div>
              <div className="mt-4 font-display text-[2.2rem] leading-none tracking-[-0.05em] text-white">
                {repoStats ? `${repoStats.stars}` : 'Open'}
              </div>
              <p className="mt-3 text-sm leading-7 text-white/62">
                {repoStats
                  ? `GitHub stars on the public repository, refreshed on an hourly cadence.`
                  : 'Public repository available on GitHub with the live editor already deployed.'}
              </p>
            </div>

            <div className="site-panel rounded-[1.8rem] p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/38">What is live</div>
              <div className="mt-4 font-display text-[2.2rem] leading-none tracking-[-0.05em] text-white">Demo-ready</div>
              <p className="mt-3 text-sm leading-7 text-white/62">
                The same browser-native workspace handles editing, runtime, preview, AI assist, and share links without forcing a setup phase first.
              </p>
            </div>

            <div className="site-panel rounded-[1.8rem] p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/38">Share flow</div>
              <div className="mt-4 font-display text-[2.2rem] leading-none tracking-[-0.05em] text-white">Embed-ready</div>
              <p className="mt-3 text-sm leading-7 text-white/62">
                Shared projects can now generate a clean read-only embed view for blogs, docs, and lightweight product walkthroughs.
              </p>
            </div>
          </div>
        </section>

        <section className="pt-10">
          <div className="grid gap-4 xl:grid-cols-[0.74fr_1.26fr]">
            <div className="site-panel rounded-[2.1rem] p-6 sm:p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/34">Design stance</div>
              <h2 className="mt-5 max-w-md font-display text-[2.5rem] leading-[0.96] tracking-[-0.05em] text-white sm:text-[3.3rem]">
                Fast tools do not need to look temporary.
              </h2>
              <p className="site-copy mt-5 text-base leading-8">
                The product language stays cinematic and restrained, but now uses controlled color too: cyan, violet, ember, and warm metal tones drifting through the glass so the interface feels alive rather than fully monochrome.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {RITUALS.map((ritual) => {
                const Icon = ritual.icon;

                return (
                  <div key={ritual.title} className="site-panel site-glass-hover rounded-[2rem] p-6">
                    <div className={`site-icon-frame h-11 w-11 ${ritual.tone}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <h3 className="mt-5 font-display text-[2rem] leading-[0.96] tracking-[-0.04em] text-white">{ritual.title}</h3>
                    <p className="site-copy mt-3 text-sm leading-7">{ritual.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="pt-24">
          <SectionHeading
            eyebrow="Try it here"
            title="A real editor sample, right on the homepage."
            body="Visitors no longer need to commit to the full workspace before they understand the experience. They can edit a real Monaco surface, click run, and see the result immediately."
          />
          <div className="mt-10">
            <HomeLiveDemo />
          </div>
        </section>

        <section className="pt-24">
          <SectionHeading
            eyebrow="Capabilities"
            title="Every panel is there to tighten the loop."
            body="Yantra keeps the core experience spare and serious. Editing, execution, preview, project structure, and AI assistance stay inside one premium frame so the draft can keep moving."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {FEATURE_SET.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <section key={feature.title} className="site-panel site-glass-hover rounded-[2rem] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className={`site-icon-frame h-11 w-11 ${feature.tone}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/24">0{index + 1}</div>
                  </div>
                  <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.28em] text-white/34">{feature.eyebrow}</div>
                  <h3 className="mt-3 font-display text-[2rem] leading-[0.96] tracking-[-0.04em] text-white">{feature.title}</h3>
                  <p className="site-copy mt-3 text-sm leading-7">{feature.body}</p>
                </section>
              );
            })}
          </div>
        </section>

        <section className="pt-24">
          <div className="site-panel-strong rounded-[2.35rem] p-6 sm:p-8 lg:p-10">
            <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/34">Where it shines</div>
                <h2 className="mt-4 max-w-xl font-display text-[2.9rem] leading-[0.94] tracking-[-0.05em] text-white sm:text-[4rem]">
                  Built for moments where the atmosphere matters as much as the code.
                </h2>
                <p className="site-copy mt-5 max-w-xl text-base leading-8">
                  Yantra works especially well when the draft has to be both runnable and presentable: reviews, demos, workshops, walkthroughs, and quick internal launches.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {USE_CASES.map((useCase) => (
                  <div key={useCase.text} className="rounded-[1.8rem] border border-white/10 bg-black/20 p-5">
                    <div className={useCase.tone}>Use case</div>
                    <p className="mt-5 text-sm leading-7 text-white/68">{useCase.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="pt-24">
          <div className="site-panel-strong rounded-[2.35rem] p-6 sm:p-8 lg:p-10">
            <div className="grid gap-8 xl:grid-cols-[0.86fr_1.14fr]">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/34">What&apos;s new</div>
                <h2 className="mt-4 max-w-xl font-display text-[2.9rem] leading-[0.94] tracking-[-0.05em] text-white sm:text-[4rem]">
                  Returning visitors can see the latest upgrades at a glance.
                </h2>
                <p className="site-copy mt-5 max-w-xl text-base leading-8">
                  Yantra is evolving quickly, so the homepage now carries a compact changelog instead of making people hunt for what changed.
                </p>
              </div>

              <div className="space-y-4">
                {CHANGELOG_ENTRIES.map((entry) => (
                  <div key={entry.title} className="rounded-[1.8rem] border border-white/10 bg-black/20 p-5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/36">{entry.version}</div>
                    <h3 className="mt-3 font-display text-[2rem] leading-[0.96] tracking-[-0.04em] text-white">{entry.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-white/64">{entry.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="pt-24 pb-8">
          <div className="site-panel-strong rounded-[2.5rem] px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
            <div className="max-w-4xl">
              <div className="site-kicker">
                <Sparkles className="h-3.5 w-3.5" />
                Start in the live workspace
              </div>
              <h2 className="mt-6 font-display text-[3rem] leading-[0.92] tracking-[-0.06em] text-white sm:text-[4.6rem]">
                Open the editor, make the first change, and let the page prove the product.
              </h2>
              <p className="site-copy mt-5 max-w-2xl text-base leading-8 sm:text-lg">
                The shortest explanation for Yantra is still the same: use it. Launch a project, run something real, and send the exact session forward as a remixable link.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/editor" className="site-button-primary">
                  Open Editor
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

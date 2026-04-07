import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  FileCode2,
  FolderTree,
  Globe,
  PlayCircle,
  SaveAll,
  Share2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import SiteShell from '@/components/site/SiteShell';
import FeatureVisualGallery from '@/components/site/FeatureVisualGallery';

const FEATURE_SECTIONS: ReadonlyArray<{
  title: string;
  eyebrow: string;
  description: string;
  points: readonly string[];
  icon: LucideIcon;
  tone: string;
  pointTone: string;
}> = [
  {
    title: 'Monaco Editor',
    eyebrow: 'Editing Engine',
    description:
      'Yantra uses Monaco so the first interaction already feels serious. Syntax highlighting, familiar shortcuts, and a real text model give the browser workspace weight immediately.',
    points: ['VS Code-quality editing surface', 'Language-aware highlighting and model switching', 'Designed for quick but capable browser workflows'],
    icon: FileCode2,
    tone: 'site-icon-frame--cyan',
    pointTone: 'border-[#78e5ff]/14 bg-[rgba(120,229,255,0.08)] text-[#c3efff]',
  },
  {
    title: 'Run in One Click',
    eyebrow: 'Execution',
    description:
      'Python projects execute through Pyodide and browser projects render through a live iframe preview, keeping the entire feedback loop inside one window.',
    points: ['Pyodide-backed Python execution', 'Instant preview for HTML, CSS, and JavaScript', 'Output and errors stay visible beside the draft'],
    icon: PlayCircle,
    tone: 'site-icon-frame--emerald',
    pointTone: 'border-[#6df3c6]/14 bg-[rgba(109,243,198,0.08)] text-[#c9fff0]',
  },
  {
    title: 'AI Assist',
    eyebrow: 'Guidance',
    description:
      'The AI panel stays alongside the editor so explanation, debugging, and refactoring suggestions remain part of the active composition instead of becoming a separate workflow.',
    points: ['Inline help for the active file', 'Quick prompts for explain, debug, and refactor', 'Built to support multiple project formats'],
    icon: Bot,
    tone: 'site-icon-frame--violet',
    pointTone: 'border-[#9386ff]/14 bg-[rgba(147,134,255,0.08)] text-[#ded5ff]',
  },
  {
    title: 'Smart File System',
    eyebrow: 'Workspace',
    description:
      'Projects feel like projects, not loose buffers. Explorer, tabs, filenames, and format awareness make small experiments easier to navigate and easier to trust.',
    points: ['Explorer sidebar and tab model', 'File badges and path-aware language selection', 'Supports Python, web files, JSON, Markdown, and plain text'],
    icon: FolderTree,
    tone: 'site-icon-frame--gold',
    pointTone: 'border-[#f3c47e]/14 bg-[rgba(243,196,126,0.08)] text-[#f7deb7]',
  },
  {
    title: 'Share and Remix',
    eyebrow: 'Collaboration',
    description:
      'A public link can represent the exact current state of a project, and the next person can remix it into their own workspace instead of starting from a screenshot or pasted excerpt.',
    points: ['Public project sharing', 'Read-only viewer experience', 'One-click remix into a local editor workspace'],
    icon: Share2,
    tone: 'site-icon-frame--rose',
    pointTone: 'border-[#f58db2]/14 bg-[rgba(245,141,178,0.08)] text-[#ffd6e5]',
  },
  {
    title: 'Autosave',
    eyebrow: 'Reliability',
    description:
      'Yantra keeps saving in the background so the experience feels calmer. The product protects momentum without asking the user to think about it.',
    points: ['Frequent autosave cadence', 'Local storage support', 'Designed to reduce accidental work loss'],
    icon: SaveAll,
    tone: 'site-icon-frame--emerald',
    pointTone: 'border-[#6df3c6]/14 bg-[rgba(109,243,198,0.08)] text-[#c9fff0]',
  },
] as const;

const PRINCIPLES = [
  {
    title: 'One room',
    body: 'Editing, runtime, preview, AI notes, and sharing stay in the same atmosphere so context does not evaporate.',
    icon: Globe,
    tone: 'site-icon-frame--cyan',
  },
  {
    title: 'One rhythm',
    body: 'The interface is built around draft, run, inspect, and refine rather than setup, export, and context switching.',
    icon: Sparkles,
    tone: 'site-icon-frame--violet',
  },
  {
    title: 'One handoff',
    body: 'The live project can become the shareable artifact, which keeps demos and review loops startlingly short.',
    icon: ArrowRight,
    tone: 'site-icon-frame--gold',
  },
] as const;

export default function FeaturesPage() {
  return (
    <SiteShell>
      <main className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <section className="max-w-5xl py-10 sm:py-16">
          <div className="site-kicker">
            <Sparkles className="h-3.5 w-3.5" />
            Feature breakdown / Obsidian system
          </div>
          <h1 className="mt-8 font-display text-[4rem] leading-[0.88] tracking-[-0.07em] text-white sm:text-[5.4rem] lg:text-[6.1rem]">
            Every layer is there to keep the{' '}
            <span className="bg-[linear-gradient(135deg,#78e5ff,#9386ff,#f3c47e)] bg-clip-text text-transparent">draft</span>{' '}
            moving.
          </h1>
          <p className="site-copy mt-6 max-w-3xl text-base leading-8 sm:text-lg">
            Yantra is deliberately composed around a tight loop: edit, run, inspect, refine, share. These are the pieces that make that loop feel fast, premium, and unusually coherent for a browser-native tool.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FEATURE_SECTIONS.map((feature, index) => {
            const Icon = feature.icon;
            const wideClass =
              index === 0 || index === 3 ? 'md:col-span-2 xl:col-span-2' : 'md:col-span-1 xl:col-span-1';

            return (
              <section key={feature.title} className={`site-panel site-glass-hover rounded-[2.15rem] p-6 sm:p-7 ${wideClass}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className={`site-icon-frame h-12 w-12 ${feature.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/24">0{index + 1}</div>
                </div>

                <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.28em] text-white/34">{feature.eyebrow}</div>
                <h2 className="mt-3 max-w-xl font-display text-[2.2rem] leading-[0.95] tracking-[-0.05em] text-white sm:text-[2.6rem]">
                  {feature.title}
                </h2>
                <p className="site-copy mt-4 max-w-2xl text-sm leading-7">{feature.description}</p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {feature.points.map((point) => (
                    <div key={point} className={`rounded-[1.4rem] border px-4 py-4 text-sm leading-7 ${feature.pointTone}`}>
                      {point}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <FeatureVisualGallery />

        <section className="pt-24">
          <div className="site-panel-strong rounded-[2.3rem] p-6 sm:p-8 lg:p-10">
            <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/34">What the system optimizes for</div>
                <h2 className="mt-4 max-w-xl font-display text-[2.8rem] leading-[0.94] tracking-[-0.05em] text-white sm:text-[4rem]">
                  A faster path from spark to shareable proof.
                </h2>
                <p className="site-copy mt-5 max-w-xl text-base leading-8">
                  Traditional setup-heavy workflows burn energy before the first useful moment. Yantra compresses the path into one browser session, with enough structure to feel premium and enough speed to stay playful.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {PRINCIPLES.map((principle) => {
                  const Icon = principle.icon;

                  return (
                    <div key={principle.title} className="rounded-[1.8rem] border border-white/10 bg-black/20 p-5">
                      <div className={`site-icon-frame h-11 w-11 ${principle.tone}`}>
                        <Icon className="h-[18px] w-[18px]" />
                      </div>
                      <h3 className="mt-5 font-display text-[1.9rem] leading-[0.96] tracking-[-0.04em] text-white">{principle.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-white/64">{principle.body}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="pt-24 pb-8">
          <div className="site-panel-strong rounded-[2.45rem] px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
            <div className="max-w-4xl">
              <div className="site-kicker">Next step / Enter the workspace</div>
              <h2 className="mt-6 font-display text-[3rem] leading-[0.92] tracking-[-0.06em] text-white sm:text-[4.5rem]">
                Want the fast path instead of the long setup?
              </h2>
              <p className="site-copy mt-5 max-w-2xl text-base leading-8 sm:text-lg">
                Open the editor and feel the entire system in motion, or read the guide for the shortest route from first click to first runnable draft.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/editor" className="site-button-primary">
                  Open Editor
                </Link>
                <Link href="/guide" className="site-button-secondary">
                  Read Guide
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}

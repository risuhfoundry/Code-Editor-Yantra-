'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

const SITE_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/guide', label: 'Guide' },
] as const;

function isActivePath(currentPath: string, href: string) {
  return href === '/' ? currentPath === '/' : currentPath.startsWith(href);
}

function SiteBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[-2] overflow-hidden bg-[#040404]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#020202_0%,#030303_26%,#050505_100%)]" />
      <div className="site-orb absolute left-[-14%] top-[-8%] h-[36rem] w-[36rem] rounded-full bg-[rgba(120,229,255,0.18)] blur-[170px]" />
      <div className="site-orb site-orb-delay absolute right-[-10%] top-[14%] h-[30rem] w-[30rem] rounded-full bg-[rgba(147,134,255,0.18)] blur-[170px]" />
      <div className="site-breathe absolute bottom-[-24%] left-[18%] h-[40rem] w-[40rem] rounded-full bg-[rgba(243,196,126,0.14)] blur-[190px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,229,255,0.1),transparent_22%),radial-gradient(circle_at_80%_20%,rgba(147,134,255,0.12),transparent_18%),radial-gradient(circle_at_40%_110%,rgba(243,196,126,0.14),transparent_26%)]" />
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '160px 160px',
          maskImage: 'linear-gradient(180deg, transparent, black 14%, black 86%, transparent)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.7) 0.7px, transparent 0.9px), radial-gradient(circle at 80% 40%, rgba(255,255,255,0.45) 0.7px, transparent 0.9px)',
          backgroundSize: '180px 180px',
          mixBlendMode: 'screen',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.2)_72%,rgba(0,0,0,0.72)_100%)]" />
    </div>
  );
}

type SiteShellProps = {
  children: ReactNode;
};

export default function SiteShell({ children }: SiteShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="site-shell-frame selection:bg-white selection:text-black">
      <SiteBackground />

      <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="site-panel rounded-[1.75rem] px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="group flex min-w-0 items-center gap-3" onClick={() => setMobileOpen(false)}>
                <div className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] border border-white/12 bg-[linear-gradient(135deg,rgba(120,229,255,0.18),rgba(147,134,255,0.16),rgba(243,196,126,0.12))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <span className="font-display text-2xl font-semibold leading-none text-white">Y</span>
                </div>
                <div className="min-w-0">
                  <div className="truncate font-mono text-[10px] uppercase tracking-[0.3em] text-white/42">
                    Browser-native code studio
                  </div>
                  <div className="font-display text-[1.45rem] leading-none tracking-[-0.04em] text-white">Yantra</div>
                </div>
              </Link>

              <nav className="hidden items-center gap-2 rounded-full border border-white/8 bg-black/30 p-1 md:flex">
                {SITE_LINKS.map((link) => {
                  const active = isActivePath(pathname, link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.24em] transition-colors ${
                        active
                          ? 'border border-[#78e5ff]/20 bg-[linear-gradient(135deg,rgba(120,229,255,0.16),rgba(147,134,255,0.14))] text-white'
                          : 'border border-transparent text-white/56 hover:border-white/8 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="flex items-center gap-2">
                <Link href="/editor" className="site-button-primary hidden sm:inline-flex">
                  Open Editor
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>

                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] border border-white/10 bg-white/[0.04] text-white md:hidden"
                  onClick={() => setMobileOpen((current) => !current)}
                  aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
                >
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] px-4 py-4 sm:px-6 md:hidden">
          <div className="absolute inset-0 bg-black/78 backdrop-blur-2xl" />
          <div className="relative mx-auto max-w-7xl">
            <div className="site-panel-strong rounded-[2rem] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/42">Navigation</div>
                  <div className="mt-2 font-display text-3xl tracking-[-0.05em] text-white">Explore Yantra</div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] border border-white/10 bg-white/[0.04] text-white"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-8 space-y-3">
                {SITE_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block rounded-[1.6rem] border border-white/8 bg-[linear-gradient(135deg,rgba(120,229,255,0.08),rgba(147,134,255,0.06),rgba(255,255,255,0.03))] px-5 py-4 text-lg text-white/86"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <Link href="/editor" className="site-button-primary mt-4 w-full" onClick={() => setMobileOpen(false)}>
                Open Editor
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {children}

      <footer className="px-4 pb-8 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="site-panel rounded-[2.25rem] px-6 py-8 sm:p-8 lg:p-10">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="site-kicker">Obsidian Library / Browser-native building</div>
                <h2 className="mt-6 max-w-3xl font-display text-[2.8rem] leading-[0.92] tracking-[-0.05em] text-white sm:text-[3.75rem]">
                  The fast loop, framed like it matters.
                </h2>
                <p className="site-copy mt-5 max-w-2xl text-base leading-8">
                  Yantra keeps editing, execution, preview, AI guidance, and remixable sharing in one immersive surface so the idea can stay intact all the way to the handoff.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/36">Navigate</div>
                  <div className="mt-4 flex flex-col gap-3 text-sm text-white/78">
                    {SITE_LINKS.map((link) => (
                      <Link key={link.href} href={link.href} className="transition-colors hover:text-white">
                        {link.label}
                      </Link>
                    ))}
                    <Link href="/editor" className="transition-colors hover:text-white">
                      Open Editor
                    </Link>
                  </div>
                </div>

                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/36">Essentials</div>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-white/62">
                    <p>Monaco editing with a real workspace feel.</p>
                    <p>Python runs in-browser and web projects preview instantly.</p>
                    <p>Share the exact session and let someone remix it forward.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="site-rule mt-8" />

            <div className="mt-6 flex flex-col gap-3 font-mono text-[10px] uppercase tracking-[0.26em] text-white/34 sm:flex-row sm:items-center sm:justify-between">
              <div>Yantra Code Editor</div>
              <div>Built for fast demos, walkthroughs, and shared drafts</div>
              <div>{new Date().getFullYear()}</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

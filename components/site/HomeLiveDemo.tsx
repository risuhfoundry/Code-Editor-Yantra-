'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, Play } from 'lucide-react';
import Link from 'next/link';
import ProjectCodeEditor from '@/editor/components/ProjectCodeEditor';

type DemoFile = {
  path: string;
  language: 'html' | 'css' | 'javascript';
  content: string;
};

const INITIAL_FILES: DemoFile[] = [
  {
    path: 'index.html',
    language: 'html',
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Yantra Live Demo</title>
  </head>
  <body>
    <main class="shell">
      <section class="surface">
        <div class="surface-glow surface-glow--one"></div>
        <div class="surface-glow surface-glow--two"></div>

        <header class="hero">
          <div>
            <p class="eyebrow">Auto-running demo</p>
            <h1>Yantra turns fresh code into a living product surface.</h1>
            <p class="lede">
              The preview boots itself, animates in-browser, and keeps broadcasting motion without waiting for a click.
            </p>
          </div>
          <div class="status-pill">
            <span class="status-dot"></span>
            <span id="phase">Booting live preview</span>
          </div>
        </header>

        <section class="metrics" aria-label="Live metrics">
          <article class="metric-card">
            <span>Signals</span>
            <strong data-counter="128">0</strong>
          </article>
          <article class="metric-card">
            <span>Frames</span>
            <strong data-counter="64">0</strong>
          </article>
          <article class="metric-card">
            <span>Latency</span>
            <strong data-counter="18" data-suffix="ms">0ms</strong>
          </article>
          <article class="metric-card">
            <span>Scenes</span>
            <strong data-counter="6">0</strong>
          </article>
        </section>

        <section class="runtime">
          <div class="reactor">
            <div class="orbit orbit--outer"></div>
            <div class="orbit orbit--mid"></div>
            <div class="orbit orbit--inner"></div>
            <div class="core">
              <span class="core-label">Live Build</span>
              <strong id="uptime">0.0s</strong>
              <small>Rendering motion layer</small>
            </div>
            <div class="beacon beacon--one"></div>
            <div class="beacon beacon--two"></div>
            <div class="beacon beacon--three"></div>
          </div>

          <aside class="activity-panel" aria-live="polite">
            <div class="activity-head">
              <span>Runtime events</span>
              <span class="activity-chip">Streaming</span>
            </div>
            <ul id="event-list" class="event-list"></ul>
          </aside>
        </section>
      </section>
    </main>
  </body>
</html>`,
  },
  {
    path: 'style.css',
    language: 'css',
    content: `:root {
  color-scheme: dark;
  --bg: #060816;
  --panel: rgba(7, 11, 26, 0.8);
  --panel-strong: rgba(8, 14, 30, 0.94);
  --border: rgba(148, 163, 184, 0.16);
  --text: #f8fafc;
  --muted: #8da2c8;
  --aqua: #67e8f9;
  --blue: #60a5fa;
  --pink: #f472b6;
  --gold: #facc15;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(103, 232, 249, 0.2), transparent 30%),
    radial-gradient(circle at 84% 18%, rgba(244, 114, 182, 0.16), transparent 22%),
    linear-gradient(180deg, #030612 0%, #070c1a 50%, #04050a 100%);
  color: var(--text);
  overflow: hidden;
}

.shell {
  min-height: 100vh;
  padding: 1.1rem;
}

.surface {
  position: relative;
  height: calc(100vh - 2.2rem);
  overflow: hidden;
  border-radius: 2rem;
  border: 1px solid var(--border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 18%),
    linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(2, 6, 23, 0.98));
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(18px);
  padding: 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.surface::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px);
  background-size: 3.2rem 3.2rem;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.32), transparent 75%);
  pointer-events: none;
}

.surface-glow {
  position: absolute;
  inset: auto;
  border-radius: 999px;
  filter: blur(48px);
  opacity: 0.45;
  pointer-events: none;
}

.surface-glow--one {
  width: 15rem;
  height: 15rem;
  top: -4rem;
  left: -2rem;
  background: rgba(103, 232, 249, 0.28);
}

.surface-glow--two {
  width: 14rem;
  height: 14rem;
  right: -3rem;
  bottom: -4rem;
  background: rgba(244, 114, 182, 0.22);
}

.hero,
.metrics,
.runtime {
  position: relative;
  z-index: 1;
}

.hero {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.eyebrow,
.metric-card span,
.activity-head,
.core-label,
.activity-chip {
  font-family: "SFMono-Regular", "Roboto Mono", Consolas, monospace;
}

.eyebrow {
  margin: 0;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-size: 0.72rem;
  color: var(--aqua);
}

.hero h1 {
  margin: 0.55rem 0 0;
  max-width: 32rem;
  font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
  font-size: clamp(2rem, 4.4vw, 3.4rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
}

.lede {
  margin: 0.8rem 0 0;
  max-width: 30rem;
  color: var(--muted);
  font-family: "Avenir Next", "Segoe UI", sans-serif;
  font-size: 0.98rem;
  line-height: 1.65;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.78rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(103, 232, 249, 0.16);
  background: rgba(7, 16, 32, 0.72);
  color: #d7f9ff;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.status-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--aqua), var(--blue));
  box-shadow: 0 0 18px rgba(103, 232, 249, 0.8);
  animation: pulse-dot 1.2s ease-in-out infinite;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.metric-card,
.activity-panel {
  border: 1px solid var(--border);
  background: rgba(6, 10, 22, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.metric-card {
  padding: 0.95rem 1rem;
  border-radius: 1.25rem;
}

.metric-card span {
  display: block;
  color: var(--muted);
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.metric-card strong {
  display: block;
  margin-top: 0.45rem;
  font-size: 1.85rem;
  line-height: 1;
  letter-spacing: -0.05em;
}

.runtime {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(15rem, 0.95fr);
  gap: 1rem;
  flex: 1;
}

.reactor {
  position: relative;
  min-height: 18rem;
  border-radius: 1.8rem;
  border: 1px solid rgba(96, 165, 250, 0.14);
  background:
    radial-gradient(circle at center, rgba(96, 165, 250, 0.18), transparent 28%),
    linear-gradient(180deg, rgba(7, 12, 26, 0.94), rgba(2, 6, 23, 0.96));
  overflow: hidden;
}

.orbit,
.core,
.beacon {
  position: absolute;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
}

.orbit {
  border-radius: 999px;
  border: 1px solid rgba(103, 232, 249, 0.18);
  box-shadow:
    0 0 40px rgba(96, 165, 250, 0.08),
    inset 0 0 18px rgba(103, 232, 249, 0.06);
}

.orbit::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 100%;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
  transform: translate(-50%, -50%);
  background: linear-gradient(135deg, var(--aqua), white);
  box-shadow: 0 0 18px rgba(103, 232, 249, 0.9);
}

.orbit--outer {
  width: 15.5rem;
  height: 15.5rem;
  animation: spin 18s linear infinite;
}

.orbit--mid {
  width: 11.6rem;
  height: 11.6rem;
  animation: spin 13s linear infinite reverse;
}

.orbit--inner {
  width: 7.8rem;
  height: 7.8rem;
  animation: spin 9s linear infinite;
}

.core {
  width: 7rem;
  height: 7rem;
  display: grid;
  place-items: center;
  text-align: center;
  border-radius: 999px;
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3), transparent 18%),
    linear-gradient(180deg, rgba(103, 232, 249, 0.24), rgba(96, 165, 250, 0.08)),
    rgba(4, 10, 22, 0.92);
  border: 1px solid rgba(103, 232, 249, 0.24);
  box-shadow:
    0 0 50px rgba(103, 232, 249, 0.18),
    inset 0 0 24px rgba(103, 232, 249, 0.12);
  animation: float-core 4.4s ease-in-out infinite;
}

.core-label {
  display: block;
  color: var(--muted);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.core strong {
  display: block;
  margin-top: 0.4rem;
  font-size: 1.35rem;
  letter-spacing: -0.04em;
}

.core small {
  display: block;
  margin-top: 0.15rem;
  color: #d7f9ff;
  font-size: 0.7rem;
}

.beacon {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--gold), var(--pink));
  box-shadow: 0 0 18px rgba(250, 204, 21, 0.4);
}

.beacon--one {
  margin-left: -7.6rem;
  margin-top: -5.2rem;
  animation: drift 5s ease-in-out infinite;
}

.beacon--two {
  margin-left: 6.4rem;
  margin-top: -2.8rem;
  animation: drift 4.6s ease-in-out infinite reverse;
}

.beacon--three {
  margin-left: 1.8rem;
  margin-top: 6.2rem;
  animation: drift 6.1s ease-in-out infinite;
}

.activity-panel {
  border-radius: 1.6rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  min-height: 18rem;
}

.activity-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--muted);
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.activity-chip {
  padding: 0.38rem 0.6rem;
  border-radius: 999px;
  border: 1px solid rgba(103, 232, 249, 0.18);
  color: #d7f9ff;
  font-size: 0.62rem;
}

.event-list {
  list-style: none;
  padding: 0;
  margin: 0.85rem 0 0;
  display: grid;
  gap: 0.7rem;
  overflow: hidden;
}

.event-item {
  display: grid;
  gap: 0.22rem;
  padding: 0.78rem 0.85rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(255, 255, 255, 0.03);
  opacity: 0;
  transform: translateY(10px);
  animation: event-in 420ms ease forwards;
}

.event-label {
  color: var(--text);
  font-size: 0.9rem;
  font-weight: 600;
}

.event-meta {
  color: var(--muted);
  font-family: "SFMono-Regular", "Roboto Mono", Consolas, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
}

@keyframes spin {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }

  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes float-core {
  0%,
  100% {
    transform: translate(-50%, -50%);
  }

  50% {
    transform: translate(-50%, calc(-50% - 8px));
  }
}

@keyframes drift {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
  }

  50% {
    transform: translate(-50%, -50%) scale(1.18);
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.28);
  }
}

@keyframes event-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 900px) {
  .hero,
  .runtime {
    grid-template-columns: 1fr;
    display: grid;
  }

  .hero {
    gap: 0.85rem;
  }

  .status-pill {
    justify-self: start;
  }

  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .surface {
    padding: 1rem;
  }

  .metrics {
    grid-template-columns: 1fr 1fr;
  }
}`,
  },
  {
    path: 'script.js',
    language: 'javascript',
    content: `const phase = document.getElementById("phase");
const uptime = document.getElementById("uptime");
const eventList = document.getElementById("event-list");
const counters = Array.from(document.querySelectorAll("[data-counter]"));

const phases = [
  "Compiling visual system",
  "Linking motion layer",
  "Streaming live preview",
  "Project surface online",
];

const events = [
  ["Preview hydrated", "iframe runtime attached"],
  ["Motion pass active", "gradient field responding"],
  ["State graph synced", "editor and preview in lockstep"],
  ["Signals amplified", "counters are now live"],
  ["Scene stabilized", "ready for the next code change"],
];

function animateCounter(element, target, suffix = "") {
  const start = performance.now();
  const duration = 1200;

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(target * eased) + suffix;

    if (progress < 1) {
      window.requestAnimationFrame(tick);
    }
  }

  window.requestAnimationFrame(tick);
}

function appendEvent(label, meta) {
  if (!eventList) {
    return;
  }

  const item = document.createElement("li");
  item.className = "event-item";
  item.innerHTML = '<span class="event-label"></span><span class="event-meta"></span>';
  item.querySelector(".event-label").textContent = label;
  item.querySelector(".event-meta").textContent = meta;
  eventList.prepend(item);

  while (eventList.children.length > 5) {
    eventList.removeChild(eventList.lastElementChild);
  }
}

counters.forEach((counter) => {
  const target = Number(counter.getAttribute("data-counter") || "0");
  const suffix = counter.getAttribute("data-suffix") || "";
  animateCounter(counter, target, suffix);
});

appendEvent(events[0][0], events[0][1]);
appendEvent(events[1][0], events[1][1]);
appendEvent(events[2][0], events[2][1]);

let phaseIndex = 0;
let eventIndex = 3;
const startedAt = performance.now();

window.setInterval(() => {
  phaseIndex = (phaseIndex + 1) % phases.length;

  if (phase) {
    phase.textContent = phases[phaseIndex];
  }

  const nextEvent = events[eventIndex % events.length];
  appendEvent(nextEvent[0], nextEvent[1]);
  eventIndex += 1;
}, 1350);

function updateUptime() {
  if (uptime) {
    const elapsedSeconds = (performance.now() - startedAt) / 1000;
    uptime.textContent = elapsedSeconds.toFixed(1) + "s";
  }

  window.requestAnimationFrame(updateUptime);
}

window.requestAnimationFrame(updateUptime);`,
  },
];

function buildPreviewDocument(files: DemoFile[]) {
  const html = files.find((file) => file.language === 'html')?.content ?? '<!doctype html><html><body></body></html>';
  const css = files.find((file) => file.language === 'css')?.content ?? '';
  const js = files.find((file) => file.language === 'javascript')?.content ?? '';

  if (html.includes('</head>') && html.includes('</body>')) {
    return html
      .replace('</head>', `<style>${css}</style></head>`)
      .replace('</body>', `<script>${js}</script></body>`);
  }

  if (html.includes('</body>')) {
    return `${html.replace('</body>', `<style>${css}</style><script>${js}</script></body>`)}`;
  }

  return `${html}\n<style>${css}</style>\n<script>${js}</script>`;
}

export default function HomeLiveDemo() {
  const [files, setFiles] = useState(INITIAL_FILES);
  const [activePath, setActivePath] = useState(INITIAL_FILES[0].path);
  const [previewDoc, setPreviewDoc] = useState(() => buildPreviewDocument(INITIAL_FILES));
  const [previewVersion, setPreviewVersion] = useState(0);
  const activeFile = useMemo(() => files.find((file) => file.path === activePath) ?? null, [activePath, files]);

  return (
    <section className="site-panel-strong overflow-hidden rounded-[2.4rem] p-4 sm:p-5 lg:p-6">
      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="overflow-hidden rounded-[1.8rem] border border-white/8 bg-black/30">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/34">Live interactive demo</div>
              <div className="mt-1 text-sm text-white/74">It auto-runs on load. Edit the sample, then rerun the scene when you want a fresh render.</div>
            </div>
            <button
              type="button"
              className="site-button-primary h-10 px-4 text-[11px]"
              onClick={() => {
                setPreviewDoc(buildPreviewDocument(files));
                setPreviewVersion((currentVersion) => currentVersion + 1);
              }}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Rerun Demo
            </button>
          </div>

          <div className="flex border-b border-white/8 px-3 pt-3">
            {files.map((file) => {
              const active = activePath === file.path;

              return (
                <button
                  key={file.path}
                  type="button"
                  className={`rounded-t-[1rem] border border-b-0 px-4 py-2 text-[12px] transition ${
                    active
                      ? 'border-white/12 bg-[#0d1020] text-white'
                      : 'border-transparent bg-transparent text-white/46 hover:text-white/80'
                  }`}
                  onClick={() => setActivePath(file.path)}
                >
                  {file.path}
                </button>
              );
            })}
          </div>

          <div className="h-[28rem]">
            <ProjectCodeEditor
              file={activeFile}
              theme="dark"
              settings={{
                fontSize: 13,
                minimapEnabled: false,
                wordWrap: 'on',
              }}
              onChange={(nextContent) =>
                setFiles((currentFiles) =>
                  currentFiles.map((file) =>
                    file.path === activePath
                      ? {
                          ...file,
                          content: nextContent,
                        }
                      : file,
                  ),
                )
              }
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.8rem] border border-white/8 bg-black/20">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/34">Preview pane</div>
            <Link href="/editor" className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-white/62 transition hover:text-white">
              Open full editor
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <iframe
            key={previewVersion}
            title="Yantra homepage demo preview"
            className="h-[28rem] w-full border-0 bg-white"
            sandbox="allow-scripts"
            srcDoc={previewDoc}
          />
        </div>
      </div>
    </section>
  );
}

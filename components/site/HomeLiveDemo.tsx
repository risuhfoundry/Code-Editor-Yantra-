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
  <body>
    <main class="frame">
      <p class="eyebrow">Yantra demo</p>
      <h1>Browser-native ideas, staged beautifully.</h1>
      <button id="pulse">Preview motion</button>
      <p id="status">Click the button to animate the preview.</p>
    </main>
  </body>
</html>`,
  },
  {
    path: 'style.css',
    language: 'css',
    content: `:root {
  color-scheme: dark;
  font-family: "Georgia", serif;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at top, rgba(120, 229, 255, 0.24), transparent 36%),
    linear-gradient(180deg, #05060d, #0d1020 55%, #06060b);
  color: #f8fafc;
}

.frame {
  width: min(32rem, calc(100vw - 2rem));
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 1.8rem;
  padding: 2rem;
  background: rgba(9, 11, 20, 0.78);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(18px);
}

.eyebrow {
  letter-spacing: 0.28em;
  text-transform: uppercase;
  font-size: 0.72rem;
  color: #93c5fd;
}

h1 {
  margin: 1rem 0;
  font-size: clamp(2rem, 6vw, 3rem);
  line-height: 0.94;
}

button {
  border: 0;
  border-radius: 999px;
  padding: 0.8rem 1.15rem;
  background: #f8fafc;
  color: #05060d;
  font-weight: 700;
  cursor: pointer;
}

.frame.is-pulsing {
  transform: translateY(-4px);
  box-shadow: 0 26px 90px rgba(56, 189, 248, 0.28);
}`,
  },
  {
    path: 'script.js',
    language: 'javascript',
    content: `const button = document.getElementById("pulse");
const status = document.getElementById("status");
const frame = document.querySelector(".frame");

button?.addEventListener("click", () => {
  frame?.classList.toggle("is-pulsing");
  if (status) {
    status.textContent = frame?.classList.contains("is-pulsing")
      ? "The preview just updated from code running in-browser."
      : "Click the button to animate the preview.";
  }
});`,
  },
];

function buildPreviewDocument(files: DemoFile[]) {
  const html = files.find((file) => file.language === 'html')?.content ?? '<!doctype html><html><body></body></html>';
  const css = files.find((file) => file.language === 'css')?.content ?? '';
  const js = files.find((file) => file.language === 'javascript')?.content ?? '';

  if (html.includes('</body>')) {
    return `${html.replace('</body>', `<style>${css}</style><script>${js}</script></body>`)}`;
  }

  return `${html}\n<style>${css}</style>\n<script>${js}</script>`;
}

export default function HomeLiveDemo() {
  const [files, setFiles] = useState(INITIAL_FILES);
  const [activePath, setActivePath] = useState(INITIAL_FILES[0].path);
  const [previewDoc, setPreviewDoc] = useState(() => buildPreviewDocument(INITIAL_FILES));
  const activeFile = useMemo(() => files.find((file) => file.path === activePath) ?? null, [activePath, files]);

  return (
    <section className="site-panel-strong overflow-hidden rounded-[2.4rem] p-4 sm:p-5 lg:p-6">
      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="overflow-hidden rounded-[1.8rem] border border-white/8 bg-black/30">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/34">Live interactive demo</div>
              <div className="mt-1 text-sm text-white/74">Edit the sample, click run, and watch the preview update.</div>
            </div>
            <button
              type="button"
              className="site-button-primary h-10 px-4 text-[11px]"
              onClick={() => setPreviewDoc(buildPreviewDocument(files))}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Run Demo
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

          <iframe title="Yantra homepage demo preview" className="h-[28rem] w-full border-0 bg-white" sandbox="allow-scripts" srcDoc={previewDoc} />
        </div>
      </div>
    </section>
  );
}

import type { EditorProjectFileInput, EditorTemplateKey } from '@/editor/types';

export type EditorProjectCreationTemplateId =
  | 'python-data-science'
  | 'html-landing-page'
  | 'react-component'
  | 'rest-api-client';

export type EditorProjectCreationTemplateDefinition = {
  id: EditorProjectCreationTemplateId;
  title: string;
  eyebrow: string;
  description: string;
  detail: string;
  actionLabel: string;
  accent: string;
  preview: string[];
  templateKey: EditorTemplateKey;
  files: EditorProjectFileInput[];
};

const PYTHON_DATA_SCIENCE_MAIN = `from statistics import mean

monthly_metrics = [
    {"month": "Jan", "signups": 42, "revenue": 1180},
    {"month": "Feb", "signups": 51, "revenue": 1360},
    {"month": "Mar", "signups": 57, "revenue": 1490},
    {"month": "Apr", "signups": 71, "revenue": 1725},
    {"month": "May", "signups": 78, "revenue": 1880},
]

average_signups = mean(point["signups"] for point in monthly_metrics)
best_month = max(monthly_metrics, key=lambda point: point["revenue"])
revenue_growth = ((monthly_metrics[-1]["revenue"] - monthly_metrics[0]["revenue"]) / monthly_metrics[0]["revenue"]) * 100

bars = "\\n".join(
    f"{point['month']:>3} | {'#' * max(1, point['signups'] // 3)} {point['signups']}"
    for point in monthly_metrics
)

print("Yantra data science snapshot")
print("=" * 32)
print(f"Average signups: {average_signups:.1f}")
print(f"Best revenue month: {best_month['month']} ($\{best_month['revenue']})")
print(f"Revenue growth: {revenue_growth:.1f}%")
print("\\nSignup trend")
print(bars)
`;

const PYTHON_DATA_SCIENCE_NOTES = `# Data Science Starter

- Swap the sample dataset with your own rows.
- Add new derived metrics with the standard library.
- Keep the entry file self-contained so it runs cleanly in-browser.
`;

const HTML_LANDING_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Northstar Landing Page</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="page-shell">
      <section class="hero">
        <p class="eyebrow">Launch faster</p>
        <h1>Ship a polished landing page before the coffee gets cold.</h1>
        <p class="lede">
          This starter gives you a hero, proof points, feature cards, and a call to action you can reshape into your own product story.
        </p>

        <div class="hero-actions">
          <button id="primary-cta" type="button">Book a demo</button>
          <a href="#feature-grid">See the build</a>
        </div>

        <dl class="metrics">
          <div>
            <dt>Conversion lift</dt>
            <dd>21%</dd>
          </div>
          <div>
            <dt>Time to launch</dt>
            <dd>1 afternoon</dd>
          </div>
          <div>
            <dt>Reusable sections</dt>
            <dd>5 blocks</dd>
          </div>
        </dl>
      </section>

      <section id="feature-grid" class="feature-grid">
        <article>
          <h2>Intentional hierarchy</h2>
          <p>Bold typography, layered backgrounds, and generous spacing give you a strong starting point.</p>
        </article>
        <article>
          <h2>Conversion-ready sections</h2>
          <p>Proof, product details, and a clear action path are already structured into the page.</p>
        </article>
        <article>
          <h2>Easy to remix</h2>
          <p>Swap colors, change copy, or add another section without untangling a heavy framework.</p>
        </article>
      </section>
    </main>

    <script src="script.js"></script>
  </body>
</html>
`;

const HTML_LANDING_PAGE_CSS = `:root {
  color-scheme: dark;
  font-family: "Space Grotesk", system-ui, sans-serif;
  --bg: #06070c;
  --panel: rgba(15, 23, 42, 0.76);
  --border: rgba(148, 163, 184, 0.18);
  --text: #f8fafc;
  --muted: #cbd5e1;
  --accent: #f97316;
  --accent-soft: rgba(249, 115, 22, 0.18);
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(249, 115, 22, 0.24), transparent 26%),
    radial-gradient(circle at 80% 20%, rgba(56, 189, 248, 0.16), transparent 24%),
    linear-gradient(180deg, #020617 0%, #0f172a 100%);
  color: var(--text);
}

.page-shell {
  width: min(72rem, calc(100vw - 2rem));
  margin: 0 auto;
  padding: 2rem 0 4rem;
}

.hero,
.feature-grid article {
  border: 1px solid var(--border);
  border-radius: 2rem;
  background: var(--panel);
  box-shadow: 0 30px 90px rgba(2, 6, 23, 0.45);
}

.hero {
  padding: clamp(2rem, 5vw, 4rem);
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.hero h1 {
  margin: 1rem 0 0;
  max-width: 12ch;
  font-size: clamp(3rem, 7vw, 5.6rem);
  line-height: 0.94;
}

.lede {
  max-width: 38rem;
  margin-top: 1.25rem;
  color: var(--muted);
  line-height: 1.8;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 2rem;
}

.hero-actions button,
.hero-actions a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  padding: 0 1.2rem;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 700;
}

.hero-actions button {
  border: 0;
  background: var(--accent);
  color: #0f172a;
  cursor: pointer;
}

.hero-actions a {
  border: 1px solid var(--border);
  color: var(--text);
  background: rgba(15, 23, 42, 0.58);
}

.metrics {
  display: grid;
  gap: 1rem;
  margin-top: 2.5rem;
}

.metrics div {
  padding: 1rem 1.15rem;
  border-radius: 1.35rem;
  border: 1px solid var(--border);
  background: var(--accent-soft);
}

.metrics dt {
  color: var(--muted);
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.metrics dd {
  margin: 0.45rem 0 0;
  font-size: 1.6rem;
  font-weight: 700;
}

.feature-grid {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.feature-grid article {
  padding: 1.5rem;
}

.feature-grid h2 {
  margin: 0;
  font-size: 1.2rem;
}

.feature-grid p {
  margin: 0.75rem 0 0;
  color: var(--muted);
  line-height: 1.7;
}

@media (min-width: 860px) {
  .metrics,
  .feature-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
`;

const HTML_LANDING_PAGE_JS = `const primaryCta = document.getElementById("primary-cta");

primaryCta?.addEventListener("click", () => {
  primaryCta.textContent = "Invite sent";
  primaryCta.setAttribute("disabled", "true");
});
`;

const REACT_COMPONENT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>React Component Starter</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="preview-shell">
      <section class="preview-copy">
        <p class="eyebrow">Component starter</p>
        <h1>Preview the component idea while you shape the React file.</h1>
        <p>
          The live preview is rendered from <code>script.js</code>, and the reusable React boilerplate lives in
          <code>components/ProductFeatureCard.jsx</code>.
        </p>
      </section>

      <section id="component-preview" class="component-stage" aria-live="polite"></section>
    </main>

    <script src="script.js"></script>
  </body>
</html>
`;

const REACT_COMPONENT_CSS = `:root {
  color-scheme: dark;
  font-family: "Sora", system-ui, sans-serif;
  --bg: #040814;
  --panel: rgba(15, 23, 42, 0.82);
  --border: rgba(129, 140, 248, 0.22);
  --text: #f8fafc;
  --muted: #cbd5e1;
  --accent: #22c55e;
  --accent-soft: rgba(34, 197, 94, 0.14);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(34, 197, 94, 0.22), transparent 28%),
    linear-gradient(180deg, #020617 0%, #0f172a 100%);
  color: var(--text);
}

.preview-shell {
  width: min(70rem, calc(100vw - 2rem));
  margin: 0 auto;
  padding: 2rem 0 3rem;
}

.preview-copy,
.component-stage {
  border: 1px solid var(--border);
  border-radius: 1.8rem;
  background: var(--panel);
  box-shadow: 0 28px 84px rgba(2, 6, 23, 0.45);
}

.preview-copy {
  padding: 2rem;
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.preview-copy h1 {
  margin: 0.8rem 0 0;
  max-width: 12ch;
  font-size: clamp(2.4rem, 6vw, 4.4rem);
  line-height: 0.98;
}

.preview-copy p {
  max-width: 42rem;
  margin-top: 1rem;
  color: var(--muted);
  line-height: 1.75;
}

.preview-copy code {
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.75);
  color: var(--text);
}

.component-stage {
  margin-top: 1rem;
  padding: 2rem;
}

.feature-card {
  padding: 1.75rem;
  border-radius: 1.6rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(8, 15, 28, 0.92));
}

.feature-card__eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.feature-card__title {
  margin: 0.9rem 0 0;
  font-size: 1.85rem;
}

.feature-card__body {
  margin-top: 0.9rem;
  color: var(--muted);
  line-height: 1.75;
}

.feature-card__list {
  display: grid;
  gap: 0.75rem;
  margin: 1.5rem 0 0;
  padding: 0;
  list-style: none;
}

.feature-card__list li {
  padding: 0.85rem 1rem;
  border-radius: 1rem;
  background: var(--accent-soft);
}

.feature-card__cta {
  margin-top: 1.5rem;
  border: 0;
  border-radius: 999px;
  padding: 0.9rem 1.2rem;
  background: var(--accent);
  color: #052e16;
  font-weight: 700;
}
`;

const REACT_COMPONENT_JS = `const root = document.getElementById("component-preview");

const componentState = {
  eyebrow: "Reusable UI",
  title: "ProductFeatureCard",
  body: "A focused starter for feature callouts, dashboards, launch pages, or onboarding surfaces.",
  items: ["Typed props", "Composable action slot", "Portable layout"],
  ctaLabel: "Drop into your app",
};

function renderPreview() {
  if (!root) {
    return;
  }

  root.innerHTML = [
    '<article class="feature-card">',
    '<p class="feature-card__eyebrow">' + componentState.eyebrow + '</p>',
    '<h2 class="feature-card__title">' + componentState.title + '</h2>',
    '<p class="feature-card__body">' + componentState.body + '</p>',
    '<ul class="feature-card__list">' + componentState.items.map((item) => '<li>' + item + '</li>').join("") + '</ul>',
    '<button class="feature-card__cta" type="button">' + componentState.ctaLabel + '</button>',
    '</article>',
  ].join("");
}

renderPreview();
`;

const REACT_COMPONENT_FILE = `export function ProductFeatureCard({
  eyebrow,
  title,
  body,
  items,
  actionLabel = "Deploy component",
}) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-slate-600">{body}</p>

      <ul className="mt-6 grid gap-3">
        {items.map((item) => (
          <li key={item} className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-slate-700">
            {item}
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="mt-6 inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
      >
        {actionLabel}
      </button>
    </article>
  );
}
`;

const REST_API_CLIENT_TS = `type Story = {
  id: number;
  title: string;
  body: string;
};

const endpoint = "https://jsonplaceholder.typicode.com/posts?_limit=3";

async function fetchStories() {
  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error("Request failed with status " + response.status);
  }

  return (await response.json()) as Story[];
}

async function main() {
  console.log("Requesting stories from " + endpoint);
  const stories = await fetchStories();

  stories.forEach((story, index) => {
    console.log((index + 1) + ". " + story.title);
    console.log(story.body);
    console.log("---");
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
});
`;

const REST_API_CLIENT_NOTES = `# REST API Client Starter

- Start with a simple typed fetch call.
- Expand the response shape as your endpoint grows.
- Replace the demo URL with your own service when you are ready.
`;

const PROJECT_CREATION_TEMPLATES: EditorProjectCreationTemplateDefinition[] = [
  {
    id: 'python-data-science',
    title: 'Python Data Science',
    eyebrow: 'Python',
    description: 'Analyze a tiny dataset, compute summary metrics, and print a readable trend snapshot.',
    detail: 'A runnable single-file starter with statistics, derived metrics, and simple text visualization.',
    actionLabel: 'Create data project',
    accent: '#22c55e',
    preview: ['analysis.py', 'notes.md', 'statistics.mean(...)', 'print("Yantra data science snapshot")'],
    templateKey: 'python-playground',
    files: [
      {
        path: 'analysis.py',
        language: 'python',
        content: PYTHON_DATA_SCIENCE_MAIN,
        sortOrder: 0,
        isEntry: true,
      },
      {
        path: 'notes.md',
        language: 'markdown',
        content: PYTHON_DATA_SCIENCE_NOTES,
        sortOrder: 1,
        isEntry: false,
      },
    ],
  },
  {
    id: 'html-landing-page',
    title: 'HTML Landing Page',
    eyebrow: 'Web',
    description: 'Open on a polished hero section with proof points, feature cards, and a call-to-action layout.',
    detail: 'A live-preview starter tuned for marketing pages, launch sites, and single-page product stories.',
    actionLabel: 'Create landing page',
    accent: '#f97316',
    preview: ['index.html', 'style.css', 'script.js', '<section class="hero">'],
    templateKey: 'web-playground',
    files: [
      {
        path: 'index.html',
        language: 'html',
        content: HTML_LANDING_PAGE_HTML,
        sortOrder: 0,
        isEntry: true,
      },
      {
        path: 'style.css',
        language: 'css',
        content: HTML_LANDING_PAGE_CSS,
        sortOrder: 1,
        isEntry: false,
      },
      {
        path: 'script.js',
        language: 'javascript',
        content: HTML_LANDING_PAGE_JS,
        sortOrder: 2,
        isEntry: false,
      },
    ],
  },
  {
    id: 'react-component',
    title: 'React Component',
    eyebrow: 'React',
    description: 'Start with a reusable component file and a live preview surface that mirrors the UI idea.',
    detail: 'Great for building a feature card, hero module, dashboard tile, or any portable UI block.',
    actionLabel: 'Create component starter',
    accent: '#818cf8',
    preview: ['index.html', 'style.css', 'script.js', 'components/ProductFeatureCard.jsx'],
    templateKey: 'js-playground',
    files: [
      {
        path: 'index.html',
        language: 'html',
        content: REACT_COMPONENT_HTML,
        sortOrder: 0,
        isEntry: true,
      },
      {
        path: 'style.css',
        language: 'css',
        content: REACT_COMPONENT_CSS,
        sortOrder: 1,
        isEntry: false,
      },
      {
        path: 'script.js',
        language: 'javascript',
        content: REACT_COMPONENT_JS,
        sortOrder: 2,
        isEntry: false,
      },
      {
        path: 'components/ProductFeatureCard.jsx',
        language: 'javascript',
        content: REACT_COMPONENT_FILE,
        sortOrder: 3,
        isEntry: false,
      },
    ],
  },
  {
    id: 'rest-api-client',
    title: 'REST API Client',
    eyebrow: 'TypeScript',
    description: 'Kick off a typed fetch flow that calls an endpoint, validates the response, and prints the result.',
    detail: 'A lightweight starter for dashboards, data probes, admin tools, or integration experiments.',
    actionLabel: 'Create API client',
    accent: '#38bdf8',
    preview: ['api-client.ts', 'notes.md', 'await fetch(endpoint)', 'console.log("Requesting stories...")'],
    templateKey: 'js-playground',
    files: [
      {
        path: 'api-client.ts',
        language: 'typescript',
        content: REST_API_CLIENT_TS,
        sortOrder: 0,
        isEntry: true,
      },
      {
        path: 'notes.md',
        language: 'markdown',
        content: REST_API_CLIENT_NOTES,
        sortOrder: 1,
        isEntry: false,
      },
    ],
  },
];

export function getEditorProjectCreationTemplates() {
  return PROJECT_CREATION_TEMPLATES;
}

export function getEditorProjectCreationTemplate(templateId: EditorProjectCreationTemplateId) {
  const template = PROJECT_CREATION_TEMPLATES.find((candidate) => candidate.id === templateId);

  if (!template) {
    throw new Error(`Unknown project creation template: ${templateId}`);
  }

  return template;
}

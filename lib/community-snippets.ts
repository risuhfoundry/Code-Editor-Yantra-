import type { EditorFileLanguage } from '@/editor/types';

export type EditorCommunitySnippetRuntime = 'python' | 'web' | 'javascript';

export type EditorCommunitySnippetFile = {
  path: string;
  language: EditorFileLanguage;
  content: string;
};

export type EditorCommunitySnippetDefinition = {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  detail: string;
  runtime: EditorCommunitySnippetRuntime;
  tags: string[];
  files: EditorCommunitySnippetFile[];
};

const FLASK_STARTER_APP = `from flask import Flask, jsonify, render_template

app = Flask(__name__)

STATS = [
    {"label": "Deploys today", "value": 14},
    {"label": "Healthy services", "value": 9},
    {"label": "Queued jobs", "value": 3},
]


@app.route("/")
def index():
    return render_template("index.html", stats=STATS)


@app.route("/api/stats")
def stats():
    return jsonify(STATS)


if __name__ == "__main__":
    app.run(debug=True)
`;

const FLASK_STARTER_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Yantra Flask Starter</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: "Segoe UI", sans-serif;
      }

      body {
        margin: 0;
        min-height: 100vh;
        padding: 3rem 1.5rem;
        background:
          radial-gradient(circle at top, rgba(96, 165, 250, 0.18), transparent 28%),
          linear-gradient(180deg, #020617, #0f172a);
        color: #e2e8f0;
      }

      main {
        width: min(42rem, 100%);
        margin: 0 auto;
        padding: 2rem;
        border-radius: 1.5rem;
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.14);
      }

      .stats {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
        margin-top: 1.5rem;
      }

      .card {
        padding: 1rem;
        border-radius: 1rem;
        background: rgba(30, 41, 59, 0.86);
      }

      strong {
        display: block;
        margin-top: 0.35rem;
        font-size: 1.7rem;
      }
    </style>
  </head>
  <body>
    <main>
      <p>Flask starter</p>
      <h1>Ship a tiny route, template, and JSON endpoint.</h1>
      <div class="stats">
        {% for stat in stats %}
          <article class="card">
            <span>{{ stat.label }}</span>
            <strong>{{ stat.value }}</strong>
          </article>
        {% endfor %}
      </div>
    </main>
  </body>
</html>
`;

const FETCH_RENDER_SNIPPET = `const FEED_URL = "https://jsonplaceholder.typicode.com/posts?_limit=5";

export async function fetchAndRenderPosts(root) {
  if (!(root instanceof HTMLElement)) {
    throw new Error("Pass a DOM node to fetchAndRenderPosts(root).");
  }

  root.innerHTML = "<p>Loading posts...</p>";

  try {
    const response = await fetch(FEED_URL);

    if (!response.ok) {
      throw new Error("Request failed with status " + response.status);
    }

    const posts = await response.json();

    root.innerHTML = posts
      .map(
        (post) => \`
          <article class="post-card">
            <h3>\${post.title}</h3>
            <p>\${post.body}</p>
          </article>
        \`,
      )
      .join("");
  } catch (error) {
    root.innerHTML =
      '<p class="error-state">' +
      (error instanceof Error ? error.message : "Unable to load the feed.") +
      "</p>";
  }
}

const mountNode = document.getElementById("feed-root");

if (mountNode) {
  void fetchAndRenderPosts(mountNode);
}
`;

const CHART_JS_BAR_CHART = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Chart.js Bar Chart</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, #eff6ff, #dbeafe);
        font-family: "Segoe UI", sans-serif;
      }

      .chart-shell {
        width: min(44rem, calc(100vw - 2rem));
        padding: 1.5rem;
        border-radius: 1.5rem;
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.16);
      }
    </style>
  </head>
  <body>
    <main class="chart-shell">
      <canvas id="weeklyChart" aria-label="Bar chart"></canvas>
    </main>

    <script>
      const context = document.getElementById("weeklyChart");

      new Chart(context, {
        type: "bar",
        data: {
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
          datasets: [
            {
              label: "Orders shipped",
              data: [22, 34, 29, 41, 38],
              borderRadius: 12,
              backgroundColor: ["#2563eb", "#3b82f6", "#60a5fa", "#38bdf8", "#0ea5e9"],
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0,
              },
            },
          },
        },
      });
    </script>
  </body>
</html>
`;

const RETRY_HELPER_SNIPPET = `export async function withRetry(task, options = {}) {
  const retries = options.retries ?? 3;
  const delayMs = options.delayMs ?? 300;

  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        break;
      }

      await new Promise((resolve) => window.setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("The task failed after multiple attempts.");
}

export async function loadProfile() {
  return withRetry(async () => {
    const response = await fetch("/api/profile");

    if (!response.ok) {
      throw new Error("Profile request failed.");
    }

    return response.json();
  });
}
`;

const COMMUNITY_SNIPPETS: EditorCommunitySnippetDefinition[] = [
  {
    id: 'flask-starter',
    title: 'Flask starter',
    author: 'Yantra Community',
    category: 'Backend',
    description: 'Route, template, and JSON endpoint in one small Flask scaffold.',
    detail: 'Imports app.py, a Jinja template, and a requirements file so you can sketch a service quickly.',
    runtime: 'python',
    tags: ['flask', 'api', 'jinja', 'python'],
    files: [
      {
        path: 'snippets/flask-starter/app.py',
        language: 'python',
        content: FLASK_STARTER_APP,
      },
      {
        path: 'snippets/flask-starter/templates/index.html',
        language: 'html',
        content: FLASK_STARTER_TEMPLATE,
      },
      {
        path: 'snippets/flask-starter/requirements.txt',
        language: 'plaintext',
        content: 'Flask==3.0.3\n',
      },
    ],
  },
  {
    id: 'fetch-render',
    title: 'Fetch + render',
    author: 'Yantra Community',
    category: 'UI pattern',
    description: 'Async fetch flow with empty, loading, success, and error states.',
    detail: 'Adds a DOM-ready helper for grabbing a feed and painting cards into a target container.',
    runtime: 'web',
    tags: ['fetch', 'async', 'dom', 'render'],
    files: [
      {
        path: 'snippets/fetch-render/render-feed.js',
        language: 'javascript',
        content: FETCH_RENDER_SNIPPET,
      },
    ],
  },
  {
    id: 'chartjs-bar-chart',
    title: 'Chart.js bar chart',
    author: 'Yantra Community',
    category: 'Data viz',
    description: 'A polished single-file bar chart wired up with the Chart.js CDN.',
    detail: 'Useful when you need a quick dashboard slice or a chart demo to drop into a prototype.',
    runtime: 'web',
    tags: ['chart.js', 'dashboard', 'analytics', 'visualization'],
    files: [
      {
        path: 'snippets/chartjs-bar/chart-demo.html',
        language: 'html',
        content: CHART_JS_BAR_CHART,
      },
    ],
  },
  {
    id: 'retry-helper',
    title: 'Retry helper',
    author: 'Yantra Community',
    category: 'Utility',
    description: 'Reusable retry wrapper for flaky network or async operations.',
    detail: 'Drops in a tiny utility with backoff and an example fetch call you can adapt immediately.',
    runtime: 'javascript',
    tags: ['retry', 'utility', 'network', 'typescript-friendly'],
    files: [
      {
        path: 'snippets/retry-helper/with-retry.js',
        language: 'javascript',
        content: RETRY_HELPER_SNIPPET,
      },
    ],
  },
];

export function getEditorCommunitySnippets() {
  return COMMUNITY_SNIPPETS;
}

export function getEditorCommunitySnippet(id: string) {
  return COMMUNITY_SNIPPETS.find((snippet) => snippet.id === id) ?? null;
}

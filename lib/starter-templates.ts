import type { EditorProjectFileInput, EditorStarterTemplateId, EditorTemplateKey } from '@/editor/types';

export type EditorStarterTemplateDefinition = {
  id: EditorStarterTemplateId;
  title: string;
  eyebrow: string;
  description: string;
  detail: string;
  actionLabel: string;
  accent: string;
  templateKey: EditorTemplateKey;
  preview: string[];
  files: EditorProjectFileInput[];
};

const HELLO_WORLD_PYTHON = `message = "Hello, Yantra!"
name = "builder"

print(message)
print(f"Welcome, {name}.")
print("Change these values and run again.")
`;

const DATA_CHART_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Studio Chart</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="dashboard-shell">
      <section class="chart-card">
        <div class="chart-copy">
          <p class="eyebrow">Weekly signups</p>
          <h1>Visualize a tiny dataset in minutes.</h1>
          <p class="lede">Edit the data in <code>script.js</code>, run the project, and watch the chart redraw.</p>
        </div>
        <canvas id="chart" width="640" height="320" aria-label="Bar chart preview"></canvas>
      </section>
      <div id="summary" class="summary-grid"></div>
    </main>

    <script src="script.js"></script>
  </body>
</html>
`;

const DATA_CHART_CSS = `:root {
  color-scheme: dark;
  font-family: "Inter", system-ui, sans-serif;
  --bg: #08111f;
  --panel: rgba(10, 18, 32, 0.88);
  --border: rgba(148, 163, 184, 0.16);
  --text: #e2e8f0;
  --muted: #94a3b8;
  --accent: #38bdf8;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(56, 189, 248, 0.18), transparent 30%),
    linear-gradient(180deg, #020617 0%, #0f172a 100%);
  color: var(--text);
}

.dashboard-shell {
  width: min(72rem, calc(100vw - 2rem));
  margin: 0 auto;
  padding: 2rem 0 3rem;
}

.chart-card {
  padding: 2rem;
  border: 1px solid var(--border);
  border-radius: 1.75rem;
  background: var(--panel);
  box-shadow: 0 24px 80px rgba(2, 6, 23, 0.45);
}

.chart-copy h1 {
  margin: 0.5rem 0 0;
  font-size: clamp(2rem, 5vw, 3.2rem);
  line-height: 1.05;
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.lede {
  max-width: 34rem;
  color: var(--muted);
  line-height: 1.7;
}

canvas {
  width: 100%;
  height: auto;
  display: block;
  margin-top: 1.5rem;
  border-radius: 1.25rem;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(8, 15, 28, 0.94));
}

.summary-grid {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.summary-item {
  padding: 1rem 1.25rem;
  border-radius: 1.25rem;
  border: 1px solid var(--border);
  background: rgba(10, 18, 32, 0.7);
}

.summary-item strong {
  display: block;
  font-size: 1.4rem;
  margin-top: 0.35rem;
}
`;

const DATA_CHART_JS = `const points = [
  { label: "Mon", value: 42 },
  { label: "Tue", value: 68 },
  { label: "Wed", value: 54 },
  { label: "Thu", value: 80 },
  { label: "Fri", value: 61 },
];

const canvas = document.getElementById("chart");
const summary = document.getElementById("summary");

function renderSummary() {
  if (!summary) {
    return;
  }

  const peak = points.reduce((highest, point) => (point.value > highest.value ? point : highest), points[0]);
  const average = Math.round(points.reduce((total, point) => total + point.value, 0) / points.length);

  summary.innerHTML = [
    { label: "Peak day", value: peak.label },
    { label: "Best score", value: peak.value },
    { label: "Average", value: average },
  ]
    .map(
      (item) => \`<article class="summary-item"><span>\${item.label}</span><strong>\${item.value}</strong></article>\`,
    )
    .join("");
}

function drawChart() {
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const padding = 42;
  const maxValue = Math.max(...points.map((point) => point.value));
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;
  const barWidth = chartWidth / points.length - 18;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#020617";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(148, 163, 184, 0.16)";
  context.lineWidth = 1;

  for (let row = 0; row <= 4; row += 1) {
    const y = padding + (chartHeight / 4) * row;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }

  points.forEach((point, index) => {
    const x = padding + index * (barWidth + 18) + 9;
    const barHeight = (point.value / maxValue) * (chartHeight - 14);
    const y = height - padding - barHeight;
    const gradient = context.createLinearGradient(0, y, 0, height - padding);

    gradient.addColorStop(0, "#38bdf8");
    gradient.addColorStop(1, "#0ea5e9");

    context.fillStyle = gradient;
    context.beginPath();
    context.roundRect(x, y, barWidth, barHeight, 16);
    context.fill();

    context.fillStyle = "#e2e8f0";
    context.font = "600 14px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText(String(point.value), x + barWidth / 2, y - 10);

    context.fillStyle = "#94a3b8";
    context.fillText(point.label, x + barWidth / 2, height - padding + 22);
  });
}

renderSummary();
drawChart();
`;

const API_FETCH_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API Fetch Starter</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="feed-shell">
      <section class="feed-header">
        <div>
          <p class="eyebrow">Async UI</p>
          <h1>Fetch a live JSON feed and render it.</h1>
          <p class="lede">Swap the URL, change the card layout, or add your own filters once the response arrives.</p>
        </div>
        <button id="load-button" type="button">Refresh feed</button>
      </section>

      <p id="status" class="status">Loading stories...</p>
      <section id="post-grid" class="post-grid" aria-live="polite"></section>
    </main>

    <script src="script.js"></script>
  </body>
</html>
`;

const API_FETCH_CSS = `:root {
  color-scheme: light;
  font-family: "Inter", system-ui, sans-serif;
  --bg: #f4f7fb;
  --panel: rgba(255, 255, 255, 0.82);
  --border: rgba(15, 23, 42, 0.08);
  --text: #0f172a;
  --muted: #475569;
  --accent: #0f766e;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(45, 212, 191, 0.18), transparent 30%),
    linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
  color: var(--text);
}

.feed-shell {
  width: min(70rem, calc(100vw - 2rem));
  margin: 0 auto;
  padding: 2rem 0 3rem;
}

.feed-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: end;
  padding: 2rem;
  border-radius: 1.75rem;
  border: 1px solid var(--border);
  background: var(--panel);
  backdrop-filter: blur(14px);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
}

.feed-header h1 {
  margin: 0.45rem 0 0;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.05;
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.lede,
.status {
  color: var(--muted);
}

button {
  border: 0;
  border-radius: 999px;
  padding: 0.9rem 1.25rem;
  background: linear-gradient(135deg, #0f766e, #14b8a6);
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.post-grid {
  display: grid;
  gap: 1rem;
  margin-top: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
}

.post-card {
  padding: 1.25rem;
  border-radius: 1.4rem;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
}

.post-card h2 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.4;
}

.post-card p {
  margin: 0.8rem 0 0;
  color: var(--muted);
  line-height: 1.6;
}
`;

const API_FETCH_JS = `const loadButton = document.getElementById("load-button");
const status = document.getElementById("status");
const postGrid = document.getElementById("post-grid");
const endpoint = "https://jsonplaceholder.typicode.com/posts?_limit=6";

function setStatus(message, tone = "idle") {
  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.tone = tone;
}

function renderPosts(posts) {
  if (!postGrid) {
    return;
  }

  postGrid.innerHTML = posts
    .map(
      (post) => \`
        <article class="post-card">
          <small>Story #\${post.id}</small>
          <h2>\${post.title}</h2>
          <p>\${post.body}</p>
        </article>
      \`,
    )
    .join("");
}

async function loadPosts() {
  setStatus("Loading stories...", "loading");

  try {
    const response = await fetch(endpoint);

    if (!response.ok) {
      throw new Error(\`Request failed with status \${response.status}\`);
    }

    const posts = await response.json();
    renderPosts(posts);
    setStatus(\`Loaded \${posts.length} stories from the API.\`, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    setStatus(\`Could not load the feed: \${message}\`, "error");

    if (postGrid) {
      postGrid.innerHTML = "";
    }
  }
}

loadButton?.addEventListener("click", () => {
  void loadPosts();
});

void loadPosts();
`;

const MINI_GAME_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mini Game Starter</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="game-shell">
      <section class="game-header">
        <div>
          <p class="eyebrow">Mini game</p>
          <h1>Tap the drifting star before time runs out.</h1>
          <p class="lede">This starter gives you state, timing, and DOM updates you can remix into your own game loop.</p>
        </div>
        <button id="start-button" type="button">Start round</button>
      </section>

      <section class="hud">
        <div><span>Score</span><strong id="score">0</strong></div>
        <div><span>Time</span><strong id="timer">20</strong></div>
        <div><span>Status</span><strong id="status">Waiting</strong></div>
      </section>

      <section id="arena" class="arena" aria-label="Game arena">
        <button id="target" class="target" type="button" aria-label="Catch the target">+</button>
      </section>
    </main>

    <script src="script.js"></script>
  </body>
</html>
`;

const MINI_GAME_CSS = `:root {
  color-scheme: dark;
  font-family: "Inter", system-ui, sans-serif;
  --bg: #11061f;
  --panel: rgba(20, 9, 35, 0.82);
  --border: rgba(255, 255, 255, 0.1);
  --text: #f8fafc;
  --muted: #cbd5e1;
  --accent: #fb7185;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top, rgba(251, 113, 133, 0.22), transparent 28%),
    linear-gradient(180deg, #1f1133 0%, #09090f 100%);
  color: var(--text);
}

.game-shell {
  width: min(68rem, calc(100vw - 2rem));
  margin: 0 auto;
  padding: 2rem 0 3rem;
}

.game-header,
.hud,
.arena {
  border: 1px solid var(--border);
  background: var(--panel);
  backdrop-filter: blur(18px);
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.26);
}

.game-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: end;
  padding: 2rem;
  border-radius: 1.75rem;
}

.game-header h1 {
  margin: 0.5rem 0 0;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.05;
}

.eyebrow {
  margin: 0;
  color: #f9a8d4;
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.lede {
  max-width: 34rem;
  color: var(--muted);
  line-height: 1.7;
}

button {
  border: 0;
  border-radius: 999px;
  padding: 0.9rem 1.2rem;
  background: linear-gradient(135deg, #fb7185, #f97316);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.hud {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 1.5rem;
}

.hud div span {
  display: block;
  color: var(--muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.hud div strong {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.75rem;
}

.arena {
  position: relative;
  height: 26rem;
  margin-top: 1rem;
  border-radius: 1.75rem;
  overflow: hidden;
  background:
    radial-gradient(circle at center, rgba(251, 113, 133, 0.16), transparent 34%),
    linear-gradient(180deg, rgba(10, 8, 22, 0.92), rgba(17, 6, 31, 0.98));
}

.target {
  position: absolute;
  width: 4rem;
  height: 4rem;
  display: grid;
  place-items: center;
  padding: 0;
  font-size: 1.8rem;
  line-height: 1;
  border-radius: 999px;
  box-shadow: 0 18px 40px rgba(251, 113, 133, 0.28);
}
`;

const MINI_GAME_JS = `const startButton = document.getElementById("start-button");
const target = document.getElementById("target");
const arena = document.getElementById("arena");
const scoreValue = document.getElementById("score");
const timerValue = document.getElementById("timer");
const statusValue = document.getElementById("status");

const state = {
  score: 0,
  timeLeft: 20,
  running: false,
  intervalId: null,
};

function updateHud() {
  if (scoreValue) {
    scoreValue.textContent = String(state.score);
  }

  if (timerValue) {
    timerValue.textContent = String(state.timeLeft);
  }

  if (statusValue) {
    statusValue.textContent = state.running ? "Go!" : "Waiting";
  }
}

function moveTarget() {
  if (!(arena instanceof HTMLElement) || !(target instanceof HTMLElement)) {
    return;
  }

  const maxX = arena.clientWidth - target.offsetWidth;
  const maxY = arena.clientHeight - target.offsetHeight;
  const x = Math.max(0, Math.random() * maxX);
  const y = Math.max(0, Math.random() * maxY);

  target.style.left = \`\${x}px\`;
  target.style.top = \`\${y}px\`;
}

function endRound() {
  state.running = false;

  if (state.intervalId) {
    window.clearInterval(state.intervalId);
    state.intervalId = null;
  }

  if (statusValue) {
    statusValue.textContent = \`Finished with \${state.score} points\`;
  }

  updateHud();
}

function startRound() {
  state.score = 0;
  state.timeLeft = 20;
  state.running = true;
  updateHud();
  moveTarget();

  if (state.intervalId) {
    window.clearInterval(state.intervalId);
  }

  state.intervalId = window.setInterval(() => {
    state.timeLeft -= 1;
    updateHud();

    if (state.timeLeft <= 0) {
      endRound();
    }
  }, 1000);
}

startButton?.addEventListener("click", startRound);

target?.addEventListener("click", () => {
  if (!state.running) {
    return;
  }

  state.score += 1;
  updateHud();
  moveTarget();
});

window.addEventListener("resize", moveTarget);

updateHud();
moveTarget();
`;

const STARTER_TEMPLATES: EditorStarterTemplateDefinition[] = [
  {
    id: 'hello-world',
    title: 'Hello World',
    eyebrow: 'Python basics',
    description: 'A tiny script with instant output so you can change a value and run again right away.',
    detail: 'Best for quick experiments, print debugging, and getting comfortable with the editor.',
    actionLabel: 'Open Python starter',
    accent: '#facc15',
    templateKey: 'python-playground',
    preview: ['main.py', 'message = "Hello, Yantra!"', 'print(message)', 'print(f"Welcome, {name}.")'],
    files: [
      {
        path: 'main.py',
        language: 'python',
        content: HELLO_WORLD_PYTHON,
        sortOrder: 0,
        isEntry: true,
      },
    ],
  },
  {
    id: 'data-chart',
    title: 'Data Chart',
    eyebrow: 'Canvas UI',
    description: 'A polished web starter that draws a bar chart from editable sample data.',
    detail: 'Great for dashboards, analytics mockups, or learning how HTML, CSS, and JavaScript work together.',
    actionLabel: 'Open chart starter',
    accent: '#38bdf8',
    templateKey: 'web-playground',
    preview: ['index.html', '<canvas id="chart"></canvas>', 'const points = [42, 68, 54, 80, 61];', 'drawChart();'],
    files: [
      {
        path: 'index.html',
        language: 'html',
        content: DATA_CHART_HTML,
        sortOrder: 0,
        isEntry: true,
      },
      {
        path: 'style.css',
        language: 'css',
        content: DATA_CHART_CSS,
        sortOrder: 1,
        isEntry: false,
      },
      {
        path: 'script.js',
        language: 'javascript',
        content: DATA_CHART_JS,
        sortOrder: 2,
        isEntry: false,
      },
    ],
  },
  {
    id: 'api-fetch',
    title: 'API Fetch',
    eyebrow: 'Async web app',
    description: 'Fetch live JSON, show loading and error states, and render response cards in the preview.',
    detail: 'A good starting point for dashboards, content feeds, and small frontends that talk to APIs.',
    actionLabel: 'Open fetch starter',
    accent: '#14b8a6',
    templateKey: 'web-playground',
    preview: ['script.js', 'const endpoint = "https://jsonplaceholder.typicode.com/posts?_limit=6";', 'const response = await fetch(endpoint);', 'renderPosts(posts);'],
    files: [
      {
        path: 'index.html',
        language: 'html',
        content: API_FETCH_HTML,
        sortOrder: 0,
        isEntry: true,
      },
      {
        path: 'style.css',
        language: 'css',
        content: API_FETCH_CSS,
        sortOrder: 1,
        isEntry: false,
      },
      {
        path: 'script.js',
        language: 'javascript',
        content: API_FETCH_JS,
        sortOrder: 2,
        isEntry: false,
      },
    ],
  },
  {
    id: 'mini-game',
    title: 'Mini Game',
    eyebrow: 'Interactive logic',
    description: 'A small browser game with score, timer, and moving targets you can remix into your own idea.',
    detail: 'Useful for practicing state updates, DOM events, and playful UI feedback without extra libraries.',
    actionLabel: 'Open game starter',
    accent: '#fb7185',
    templateKey: 'web-playground',
    preview: ['script.js', 'const state = { score: 0, timeLeft: 20, running: false };', 'target.addEventListener("click", ...)', 'moveTarget();'],
    files: [
      {
        path: 'index.html',
        language: 'html',
        content: MINI_GAME_HTML,
        sortOrder: 0,
        isEntry: true,
      },
      {
        path: 'style.css',
        language: 'css',
        content: MINI_GAME_CSS,
        sortOrder: 1,
        isEntry: false,
      },
      {
        path: 'script.js',
        language: 'javascript',
        content: MINI_GAME_JS,
        sortOrder: 2,
        isEntry: false,
      },
    ],
  },
];

export function getEditorStarterTemplates() {
  return STARTER_TEMPLATES;
}

export function getEditorStarterTemplate(starterTemplateId: EditorStarterTemplateId) {
  const starterTemplate = STARTER_TEMPLATES.find((template) => template.id === starterTemplateId);

  if (!starterTemplate) {
    throw new Error('Unknown editor starter template.');
  }

  return starterTemplate;
}

'use client';

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Diff,
  Files,
  History,
  Keyboard,
  Languages,
  LoaderCircle,
  Minus,
  Pause,
  Play,
  Plus,
  Save,
  Settings2,
  Share2,
  Sparkles,
  TerminalSquare,
  Users,
  WrapText,
  X,
} from 'lucide-react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { MonacoBinding as MonacoBindingType } from 'y-monaco';
import type { WebrtcProvider as WebrtcProviderType } from 'y-webrtc';
import * as Y from 'yjs';
import EditorCommunitySnippetsPanel from '@/editor/components/EditorCommunitySnippetsPanel';
import ShareModal from '@/editor/components/ShareModal';
import EditorStarterEmptyState from '@/editor/components/EditorStarterEmptyState';
import ProjectCodeEditor from '@/editor/components/ProjectCodeEditor';
import ProjectCodeDiffEditor from '@/editor/components/ProjectCodeDiffEditor';
import ShortcutCheatSheet from '@/editor/components/ShortcutCheatSheet';
import {
  getEditorCommunitySnippet,
  getEditorCommunitySnippets,
  type EditorCommunitySnippetRuntime,
} from '@/editor/lib/community-snippets';
import {
  buildCollaborationRoomName,
  createCollaborationIdentity,
  createCollaborationSessionId,
  getCollaborationText,
  hasCollaborationFiles,
  readCollaborationSnapshot,
  syncCollaborationSnapshot,
  toRgba,
  type CollaborationIdentity,
} from '@/editor/lib/editor-collaboration';
import { parseEditorExecutionErrors } from '@/editor/lib/error-utils';
import {
  createLocalEditorProject,
  createLocalEditorProjectFromStarterTemplate,
  getLocalEditorProject,
  saveLocalEditorProject,
} from '@/editor/lib/local-dev-projects';
import { getEditorLanguageFromPath } from '@/editor/lib/project-templates';
import { getEditorStarterTemplate, getEditorStarterTemplates } from '@/editor/lib/starter-templates';
import {
  appendExecutionSummary,
  formatExecutionTime,
  runPythonInBrowser,
  stopPythonInBrowserExecution,
  type PythonRunProgress,
  warmPyodideRuntime,
} from '@/src/features/rooms/pyodide-runtime';
import type {
  EditorAssistRequest,
  EditorAssistResponse,
  EditorAuthedProfile,
  EditorAuthedUser,
  EditorFileLanguage,
  EditorProjectDetails,
  EditorProjectFile,
  EditorProjectFileInput,
  EditorProjectSummary,
  EditorStarterTemplateId,
  EditorTemplateKey,
} from '@/editor/types';
import { HoverExplain } from '../legacy/components/AI/HoverExplain';
import { InlineErrorFix } from '../legacy/components/AI/InlineErrorFix';
import type { EditorFile as LegacyEditorFile, Language as LegacyLanguage } from '../legacy/types';

type EditorWorkspaceProps = {
  authedUser: EditorAuthedUser;
  profile: EditorAuthedProfile;
  initialCollaborationSessionId?: string | null;
  initialProjectId?: string | null;
  initialProjectDetails?: EditorProjectDetails | null;
  devBypass?: boolean;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type WorkspaceStatus = 'loading' | 'ready' | 'error';
type PythonRunStatus = 'idle' | 'running' | 'success' | 'error' | 'stopped';
type BottomPanelTab = 'terminal' | 'problems';
type CompactWorkspaceTab = 'code' | 'files' | 'output' | 'assist';
type EditorViewMode = 'code' | 'diff';
type EditorThemeMode = 'dark' | 'light' | 'contrast';
type PendingFileAction =
  | { type: 'rename'; path: string }
  | { type: 'delete'; path: string }
  | null;

type PythonRunOutput = {
  status: PythonRunStatus;
  stdout: string;
  stderr: string;
  output: string;
  durationMs: number | null;
  events: TerminalEvent[];
};

type WorkspaceFile = Pick<EditorProjectFile, 'path' | 'language' | 'content' | 'sortOrder' | 'isEntry'>;

type EditorQuickSettings = {
  fontSize: number;
  minimapEnabled: boolean;
  wordWrap: 'off' | 'on';
};

type AssistConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type SnippetPanelFeedback = {
  tone: 'error' | 'success';
  text: string;
};

type TerminalTone = 'stdout' | 'stderr' | 'info' | 'success';

type TerminalEvent = {
  id: string;
  text: string;
  timestamp: number;
  tone: TerminalTone;
};

type TerminalEntry =
  | {
      id: string;
      type: 'line';
      text: string;
      timestamp: number;
      tone: TerminalTone;
    }
  | {
      id: string;
      type: 'trace';
      summary: string;
      details: TerminalEvent[];
      timestamp: number;
      tone: 'stderr';
    }
  | {
      id: string;
      type: 'empty';
      text: string;
      tone: 'info' | 'stderr';
    };

type TerminalLine = {
  id: string;
  prefix: string;
  text: string;
  tone: 'stdout' | 'stderr' | 'info';
};

type RunSnapshotRuntime = 'python' | 'javascript' | 'preview' | 'unsupported';

type RunHistorySnapshot = {
  id: string;
  capturedAt: number;
  durationMs: number | null;
  entryPath: string;
  events: TerminalEvent[];
  output: string;
  previewSrcDoc?: string;
  runtime: RunSnapshotRuntime;
  status: PythonRunStatus;
  stderr: string;
  stdout: string;
};

type ExecutionEventOptions = {
  durationMs?: number | null;
  fallbackOutput?: string;
  status: PythonRunStatus;
};

type ProblemEntry = {
  id: string;
  filePath: string;
  fileName: string;
  lineNumber: number | null;
  message: string;
};

type CommandPaletteItem = {
  id: string;
  label: string;
  description?: string;
  keywords: string;
  onSelect: () => void | Promise<void>;
};

type CollaborationParticipant = {
  clientId: number;
  color: string;
  filePath: string | null;
  isSelf: boolean;
  name: string;
};

type JsRunnerMessage = {
  source: 'yantra-js-runner';
  runId: string;
  type: 'log' | 'error' | 'done';
  payload?: string;
};

const PYTHON_AUTOSAVE_DELAY_MS = 2000;
const DEFAULT_SIDEBAR_WIDTH = 236;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;
const DEFAULT_BOTTOM_PANEL_HEIGHT = 200;
const MIN_BOTTOM_PANEL_HEIGHT = 120;
const MIN_CENTER_COLUMN_WIDTH = 340;
const AI_PANEL_WIDTH = 320;
const COMPACT_LAYOUT_BREAKPOINT = 1180;
const RUN_HISTORY_STORAGE_KEY = 'yantra.editor.run-history';
const MAX_RUN_HISTORY_ENTRIES = 18;
const COLLABORATION_SESSION_QUERY_KEY = 'session';
const DEFAULT_EDITOR_SETTINGS: EditorQuickSettings = {
  fontSize: 13,
  minimapEnabled: true,
  wordWrap: 'off',
};
const LANGUAGE_OPTIONS: Array<{
  value: EditorFileLanguage;
  label: string;
}> = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'plaintext', label: 'Plain Text' },
];
const THEME_OPTIONS: Array<{
  value: EditorThemeMode;
  label: string;
  description: string;
}> = [
  { value: 'dark', label: 'Dark', description: 'Obsidian default' },
  { value: 'light', label: 'Light', description: 'Paper studio' },
  { value: 'contrast', label: 'High Contrast', description: 'Max legibility' },
];
const ASSIST_SUGGESTIONS = [
  {
    label: 'Explain this',
    value: 'Explain this code in practical terms and call out the parts I should understand first.',
  },
  {
    label: 'Fix bugs',
    value: 'Review the active file and point out the most likely bug or runtime issue, then suggest the smallest fix.',
  },
  {
    label: 'Add comments',
    value: 'Add concise comments only where the code is genuinely hard to parse, and keep them short.',
  },
  {
    label: 'Optimize',
    value: 'Suggest one or two focused optimizations that improve clarity, speed, or maintainability without changing behavior.',
  },
] as const;
const SHORTCUTS = [
  { keys: 'Ctrl/Cmd + S', action: 'Save the current project.' },
  { keys: 'Ctrl/Cmd + Shift + P', action: 'Open the command palette.' },
  { keys: 'Ctrl/Cmd + N', action: 'Create a new file.' },
  { keys: 'Ctrl/Cmd + H', action: 'Open Monaco search and replace.' },
  { keys: 'Ctrl/Cmd + Enter', action: 'Send the current AI prompt.' },
  { keys: 'Alt + Shift + D', action: 'Toggle diff view for the active file.' },
  { keys: '?', action: 'Open this keyboard shortcuts sheet.' },
] as const;
const SUPPORTED_NEW_FILE_EXTENSIONS = ['.py', '.html', '.css', '.js', '.ts', '.tsx', '.json', '.md', '.mdx', '.txt'] as const;
const COMMUNITY_SNIPPET_CATALOG = getEditorCommunitySnippets();

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}.`);
  }

  return payload;
}

function toWorkspaceFiles(files: EditorProjectFile[]): WorkspaceFile[] {
  return files.map((file) => ({
    path: file.path,
    language: file.language,
    content: file.content,
    sortOrder: file.sortOrder,
    isEntry: file.isEntry,
  }));
}

function serializeFiles(files: WorkspaceFile[]) {
  return JSON.stringify(
    files.map((file) => ({
      path: file.path,
      language: file.language,
      content: file.content,
      sortOrder: file.sortOrder,
      isEntry: file.isEntry,
    })),
  );
}

function getEntryFile(files: WorkspaceFile[]) {
  return files.find((file) => file.isEntry) ?? files[0] ?? null;
}

function getDefaultRunOutputText(templateKey?: EditorTemplateKey | null, entryFile?: WorkspaceFile | null) {
  if (entryFile?.language === 'html' || templateKey === 'web-playground') {
    return 'Run the web playground to refresh the live preview.';
  }

  if (templateKey === 'js-playground' || entryFile?.language === 'javascript' || entryFile?.language === 'typescript') {
    return 'Run your JavaScript or TypeScript file to see console output here.';
  }

  if (templateKey === 'python-playground') {
    return 'Run your Python file to see stdout, stderr, and tracebacks here.';
  }

  return 'Open a project and run it to see output here.';
}

function getSnippetRuntimeForProject({
  isJsProject,
  isPythonProject,
  isWebProject,
}: {
  isJsProject: boolean;
  isPythonProject: boolean;
  isWebProject: boolean;
}): EditorCommunitySnippetRuntime | null {
  if (isWebProject) {
    return 'web';
  }

  if (isPythonProject) {
    return 'python';
  }

  if (isJsProject) {
    return 'javascript';
  }

  return null;
}

function isSnippetCompatibleWithProject(
  snippetRuntime: EditorCommunitySnippetRuntime,
  projectRuntime: EditorCommunitySnippetRuntime | null,
) {
  if (!projectRuntime) {
    return false;
  }

  return snippetRuntime === projectRuntime;
}

function buildUniqueImportedFilePath(candidatePath: string, existingPaths: Set<string>) {
  const normalizedPath = candidatePath.trim().replace(/\\/g, '/').replace(/^\/+/, '');

  if (!existingPaths.has(normalizedPath.toLowerCase())) {
    return normalizedPath;
  }

  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  const directoryPrefix = lastSlashIndex >= 0 ? `${normalizedPath.slice(0, lastSlashIndex + 1)}` : '';
  const fileName = lastSlashIndex >= 0 ? normalizedPath.slice(lastSlashIndex + 1) : normalizedPath;
  const lastDotIndex = fileName.lastIndexOf('.');
  const baseName = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
  const extension = lastDotIndex > 0 ? fileName.slice(lastDotIndex) : '';

  let attempt = 2;
  let nextPath = `${directoryPrefix}${baseName}-${attempt}${extension}`;

  while (existingPaths.has(nextPath.toLowerCase())) {
    attempt += 1;
    nextPath = `${directoryPrefix}${baseName}-${attempt}${extension}`;
  }

  return nextPath;
}

function createClientId(prefix: string) {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createRunOutputState({
  durationMs = null,
  events = [],
  output,
  status,
  stderr = '',
  stdout = '',
}: {
  durationMs?: number | null;
  events?: TerminalEvent[];
  output: string;
  status: PythonRunStatus;
  stderr?: string;
  stdout?: string;
}): PythonRunOutput {
  return {
    status,
    stdout,
    stderr,
    output,
    durationMs,
    events,
  };
}

function createIdleRunOutput(output: string): PythonRunOutput {
  return createRunOutputState({
    status: 'idle',
    output,
  });
}

function createTerminalEvent(text: string, tone: TerminalTone, timestamp = Date.now()): TerminalEvent {
  return {
    id: createClientId('terminal'),
    text,
    timestamp,
    tone,
  };
}

function createTerminalEventsFromText(text: string, tone: TerminalTone, timestamp = Date.now()) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\r/g, ''))
    .filter((line) => line.length > 0)
    .map((line, index) => createTerminalEvent(line, tone, timestamp + index));
}

function appendTerminalEvents(currentEvents: TerminalEvent[], text: string, tone: TerminalTone) {
  if (!text) {
    return currentEvents;
  }

  return [...currentEvents, ...createTerminalEventsFromText(text, tone)];
}

function appendExecutionText(currentValue: string, nextValue: string) {
  if (!nextValue) {
    return currentValue;
  }

  return currentValue ? `${currentValue}\n${nextValue}` : nextValue;
}

function buildExecutionOutput(stdout: string, stderr: string, fallbackMessage: string) {
  if (stdout && stderr) {
    return `${stdout}\n${stderr}`;
  }

  return stdout || stderr || fallbackMessage;
}

function buildExecutionEvents(stdout: string, stderr: string, options: ExecutionEventOptions) {
  const timestamp = Date.now();
  const events = [
    ...createTerminalEventsFromText(stdout, 'stdout', timestamp),
    ...createTerminalEventsFromText(stderr, 'stderr', timestamp + 32),
  ];

  if (events.length === 0 && options.fallbackOutput) {
    const fallbackTone: TerminalTone =
      options.status === 'error' ? 'stderr' : options.status === 'success' ? 'success' : 'info';
    events.push(...createTerminalEventsFromText(options.fallbackOutput, fallbackTone, timestamp + 64));
  }

  if (options.durationMs !== null && options.durationMs !== undefined) {
    const durationLabel = formatExecutionTime(options.durationMs);
    const summaryText =
      options.status === 'error'
        ? `Run failed in ${durationLabel}.`
        : options.status === 'stopped'
          ? `Run stopped after ${durationLabel}.`
          : `Run completed in ${durationLabel}.`;
    const summaryTone: TerminalTone =
      options.status === 'error' ? 'stderr' : options.status === 'success' ? 'success' : 'info';
    events.push(createTerminalEvent(summaryText, summaryTone, timestamp + 96));
  }

  return events;
}

function getTerminalPrefix(tone: TerminalTone) {
  if (tone === 'stderr') {
    return '! ';
  }

  if (tone === 'success') {
    return '+ ';
  }

  return '> ';
}

function getTerminalToneClassName(tone: TerminalTone) {
  if (tone === 'stderr') {
    return 'yantra-terminal-entry--stderr';
  }

  if (tone === 'success') {
    return 'yantra-terminal-entry--success';
  }

  if (tone === 'stdout') {
    return 'yantra-terminal-entry--stdout';
  }

  return 'yantra-terminal-entry--info';
}

const terminalTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatTerminalTimestamp(timestamp: number) {
  return terminalTimestampFormatter.format(timestamp);
}

function isTerminalTraceChunk(events: TerminalEvent[]) {
  if (events.length < 2) {
    return false;
  }

  const lines = events.map((event) => event.text.trim());

  if (lines[0] === 'Traceback (most recent call last):') {
    return true;
  }

  const hasStackLines = lines.some((line) => /^at\s/.test(line) || /^File ".+", line \d+/.test(line));
  const hasErrorHeading = lines.some((line) =>
    /^(?:Uncaught\s+)?(?:[A-Z][A-Za-z]+Error|Error|Exception|SyntaxError|TypeError|ReferenceError|RangeError|ValueError|NameError|RuntimeError|ImportError|ModuleNotFoundError|ZeroDivisionError|KeyError|IndexError|AttributeError|AssertionError)\b/.test(
      line,
    ),
  );

  return hasStackLines && hasErrorHeading;
}

function getTerminalTraceSummary(events: TerminalEvent[]) {
  const lines = events.map((event) => event.text.trim()).filter(Boolean);

  if (lines[0] === 'Traceback (most recent call last):') {
    return lines[lines.length - 1] ?? 'Python traceback';
  }

  return lines.find((line) => !/^at\s/.test(line) && !/^File ".+", line \d+/.test(line)) ?? lines[0] ?? 'Stack trace';
}

function serializeForInlineScript(value: string) {
  return JSON.stringify(value)
    .replace(/<\//g, '<\\/')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function buildJsRunnerDocument(entryCode: string, runId: string) {
  const serializedRunId = serializeForInlineScript(runId);
  const serializedEntryCode = serializeForInlineScript(entryCode);

  return `<!doctype html>
<html lang="en">
  <body>
    <script>
      const runId = ${serializedRunId};
      const postToParent = (type, payload = '') => {
        window.parent.postMessage(
          {
            source: 'yantra-js-runner',
            runId,
            type,
            payload,
          },
          '*',
        );
      };

      const formatLogValue = (value) => {
        if (typeof value === 'string') {
          return value;
        }

        try {
          return JSON.stringify(value);
        } catch (error) {
          return String(value);
        }
      };

      const formatLogArgs = (args) => Array.from(args).map(formatLogValue).join(' ');
      const originalLog = console.log.bind(console);
      const originalError = console.error.bind(console);

      console.log = (...args) => {
        const message = formatLogArgs(args);
        postToParent('log', message);
        originalLog(...args);
      };

      console.error = (...args) => {
        const message = formatLogArgs(args);
        postToParent('error', message);
        originalError(...args);
      };

      window.addEventListener('error', (event) => {
        const locationSuffix =
          event.lineno && event.colno ? ' (' + event.lineno + ':' + event.colno + ')' : event.lineno ? ' (' + event.lineno + ')' : '';
        postToParent('error', String(event.message || 'JavaScript runtime error') + locationSuffix);
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
        postToParent('error', message);
      });

      Promise.resolve()
        .then(() => {
          const entryCode = ${serializedEntryCode};
          return new Function(entryCode)();
        })
        .catch((error) => {
          postToParent('error', error instanceof Error ? error.stack || error.message : String(error));
        })
        .finally(() => {
          postToParent('done');
        });
    <\/script>
  </body>
</html>`;
}

async function getExecutableJsSource(file: WorkspaceFile) {
  if (file.language !== 'typescript') {
    return {
      code: file.content,
      diagnostics: '',
    };
  }

  const ts = await import('typescript');
  const transpiled = ts.transpileModule(file.content, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2020,
    },
    reportDiagnostics: true,
  });

  const diagnostics = (transpiled.diagnostics ?? [])
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    .filter((message) => message.trim().length > 0)
    .join('\n');

  return {
    code: transpiled.outputText,
    diagnostics,
  };
}

function buildWebPreviewDocument(files: WorkspaceFile[]) {
  const htmlFile = files.find((file) => file.path === 'index.html' || file.language === 'html');
  const cssFile = files.find((file) => file.path === 'style.css' || file.language === 'css');
  const scriptFile = files.find((file) => file.path === 'script.js' || file.language === 'javascript');
  const html = htmlFile?.content ?? '<!doctype html><html><body></body></html>';
  const css = cssFile?.content ?? '';
  const script = scriptFile?.content ?? '';

  if (html.includes('</head>')) {
    return html.replace('</head>', `<style>${css}</style></head>`).replace('</body>', `<script>${script}</script></body>`);
  }

  if (html.includes('</body>')) {
    return `${html.replace('</body>', `<style>${css}</style><script>${script}</script></body>`)}`;
  }

  return `${html}\n<style>${css}</style>\n<script>${script}</script>`;
}

function normalizeSaveFiles(files: WorkspaceFile[]): EditorProjectFileInput[] {
  return files.map((file) => ({
    path: file.path,
    language: file.language,
    content: file.content,
    sortOrder: file.sortOrder,
    isEntry: file.isEntry,
  }));
}

function getFileName(path: string) {
  const segments = path.split(/[\\/]/);
  return segments[segments.length - 1] ?? path;
}

function getFileExtension(path: string) {
  const fileName = getFileName(path);
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex >= 0 ? fileName.slice(lastDotIndex).toLowerCase() : '';
}

function getFileIndicator(path: string) {
  switch (getFileExtension(path)) {
    case '.py':
      return { label: 'PY', color: '#facc15' };
    case '.html':
      return { label: 'HTML', color: '#f97316' };
    case '.css':
      return { label: 'CSS', color: '#38bdf8' };
    case '.js':
    case '.jsx':
      return { label: 'JS', color: '#60a5fa' };
    case '.ts':
    case '.tsx':
      return { label: 'TS', color: '#3b82f6' };
    case '.json':
      return { label: 'JSON', color: '#a78bfa' };
    case '.md':
    case '.mdx':
      return { label: 'MD', color: '#c084fc' };
    case '.txt':
      return { label: 'TXT', color: '#94a3b8' };
    default:
      return { label: '•', color: '#9E9E9E' };
  }
}

function toLegacyEditorFile(file: WorkspaceFile): LegacyEditorFile {
  return {
    id: file.path,
    name: getFileName(file.path),
    language: file.language as LegacyLanguage,
    content: file.content,
  };
}

function buildTerminalLines(output: PythonRunOutput): TerminalLine[] {
  const lines: TerminalLine[] = [];

  for (const stdoutLine of output.stdout.split(/\r?\n/).filter((line) => line.length > 0)) {
    lines.push({ id: `stdout-${lines.length}`, prefix: '> ', text: stdoutLine, tone: 'stdout' });
  }

  for (const stderrLine of output.stderr.split(/\r?\n/).filter((line) => line.length > 0)) {
    lines.push({ id: `stderr-${lines.length}`, prefix: '✕ ', text: stderrLine, tone: 'stderr' });
  }

  if (lines.length > 0) {
    return lines;
  }

  const fallbackMessage =
    output.status === 'running'
      ? 'Executing your Python file in-browser...'
      : output.output || 'Run your Python file to see stdout, stderr, and tracebacks here.';

  return fallbackMessage.split(/\r?\n/).map((line, index) => ({
    id: `info-${index}`,
    prefix: '> ',
    text: line || ' ',
    tone: output.status === 'error' ? 'stderr' : 'info',
  }));
}

function buildProblemEntries(stderr: string, entryFile: WorkspaceFile | null): ProblemEntry[] {
  if (!stderr.trim() || !entryFile) {
    return [];
  }

  const fileName = getFileName(entryFile.path);
  const parsedEntries = parseEditorExecutionErrors(stderr, entryFile.content.split('\n').length || 1);

  if (parsedEntries.length > 0) {
    return parsedEntries.map((entry, index) => ({
      id: `${entryFile.path}-${entry.lineNumber}-${index}`,
      filePath: entryFile.path,
      fileName,
      lineNumber: entry.lineNumber,
      message: entry.message,
    }));
  }

  return stderr
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => ({
      id: `${entryFile.path}-generic-${index}`,
      filePath: entryFile.path,
      fileName,
      lineNumber: null,
      message: line.trim(),
    }));
}

function getEditorFileIndicator(path: string) {
  return getFileIndicator(path);
}

function getProgressPercent(stage: PythonRunProgress['stage'] | null) {
  switch (stage) {
    case 'downloading-runtime':
      return 20;
    case 'initializing-runtime':
      return 45;
    case 'ready':
      return 100;
    case 'loading-imports':
      return 72;
    case 'running':
      return 92;
    default:
      return 0;
  }
}

function buildEditorTerminalEntries(output: PythonRunOutput): TerminalEntry[] {
  if (output.events.length === 0) {
    return [
      {
        id: 'terminal-empty',
        type: 'empty',
        text:
          output.output ||
          (output.status === 'running'
            ? 'Executing your file in-browser...'
            : 'Run your file to see stdout, stderr, and tracebacks here.'),
        tone: output.status === 'error' ? 'stderr' : 'info',
      },
    ];
  }

  const entries: TerminalEntry[] = [];
  let index = 0;

  while (index < output.events.length) {
    const currentEvent = output.events[index];

    if (currentEvent.tone !== 'stderr') {
      entries.push({
        id: currentEvent.id,
        type: 'line',
        text: currentEvent.text,
        timestamp: currentEvent.timestamp,
        tone: currentEvent.tone,
      });
      index += 1;
      continue;
    }

    let nextIndex = index;

    while (nextIndex < output.events.length && output.events[nextIndex]?.tone === 'stderr') {
      nextIndex += 1;
    }

    const errorChunk = output.events.slice(index, nextIndex);

    if (isTerminalTraceChunk(errorChunk)) {
      entries.push({
        id: `trace-${errorChunk[0]?.id ?? index}`,
        type: 'trace',
        summary: getTerminalTraceSummary(errorChunk),
        details: errorChunk,
        timestamp: errorChunk[0]?.timestamp ?? Date.now(),
        tone: 'stderr',
      });
    } else {
      errorChunk.forEach((event) => {
        entries.push({
          id: event.id,
          type: 'line',
          text: event.text,
          timestamp: event.timestamp,
          tone: event.tone,
        });
      });
    }

    index = nextIndex;
  }

  return entries;
}

function canUseClientStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readStoredRunHistory(projectId: string | null) {
  if (!projectId || !canUseClientStorage()) {
    return [] as RunHistorySnapshot[];
  }

  try {
    const rawValue = window.localStorage.getItem(RUN_HISTORY_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue) as Record<string, RunHistorySnapshot[]>;
    const projectHistory = parsedValue?.[projectId];

    return Array.isArray(projectHistory) ? projectHistory : [];
  } catch {
    return [];
  }
}

function writeStoredRunHistory(projectId: string, snapshots: RunHistorySnapshot[]) {
  if (!canUseClientStorage()) {
    return;
  }

  let nextValue: Record<string, RunHistorySnapshot[]> = {};

  try {
    const rawValue = window.localStorage.getItem(RUN_HISTORY_STORAGE_KEY);
    nextValue = rawValue ? ((JSON.parse(rawValue) as Record<string, RunHistorySnapshot[]>) ?? {}) : {};
  } catch {
    nextValue = {};
  }

  nextValue[projectId] = snapshots;
  window.localStorage.setItem(RUN_HISTORY_STORAGE_KEY, JSON.stringify(nextValue));
}

function createRunHistorySnapshot({
  entryPath,
  previewSrcDoc,
  runOutput,
  runtime,
}: {
  entryPath: string;
  previewSrcDoc?: string;
  runOutput: PythonRunOutput;
  runtime: RunSnapshotRuntime;
}): RunHistorySnapshot {
  return {
    id: createClientId('run-snapshot'),
    capturedAt: Date.now(),
    durationMs: runOutput.durationMs,
    entryPath,
    events: runOutput.events.map((event) => ({ ...event })),
    output: runOutput.output,
    previewSrcDoc,
    runtime,
    status: runOutput.status,
    stderr: runOutput.stderr,
    stdout: runOutput.stdout,
  };
}

function getRunSnapshotStatusLabel(snapshot: RunHistorySnapshot) {
  if (snapshot.runtime === 'preview') {
    return 'Preview';
  }

  if (snapshot.status === 'error') {
    return 'Failed';
  }

  if (snapshot.status === 'stopped') {
    return 'Stopped';
  }

  if (snapshot.status === 'success') {
    return 'Success';
  }

  if (snapshot.status === 'running') {
    return 'Running';
  }

  return 'Ready';
}

function getRunSnapshotRuntimeLabel(snapshot: RunHistorySnapshot) {
  switch (snapshot.runtime) {
    case 'python':
      return 'Python';
    case 'javascript':
      return 'JavaScript';
    case 'preview':
      return 'Web Preview';
    default:
      return 'Editor';
  }
}

function getRunSnapshotBadgeClasses(snapshot: RunHistorySnapshot) {
  if (snapshot.runtime === 'preview') {
    return 'border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.12)] text-[var(--green)]';
  }

  if (snapshot.status === 'error') {
    return 'border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.12)] text-[var(--red)]';
  }

  if (snapshot.status === 'stopped') {
    return 'border-[rgba(250,204,21,0.3)] bg-[rgba(250,204,21,0.12)] text-[var(--yellow)]';
  }

  if (snapshot.status === 'success') {
    return 'border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.12)] text-[var(--green)]';
  }

  return 'border-[color:var(--border-subtle)] bg-[var(--bg-panel-alt)] text-[var(--text-secondary)]';
}

function getRunSnapshotOutputText(snapshot: RunHistorySnapshot) {
  const normalizedOutput = snapshot.output.replace(/\r\n/g, '\n').trim();
  const normalizedStderr = snapshot.stderr.replace(/\r\n/g, '\n').trim();
  const normalizedStdout = snapshot.stdout.replace(/\r\n/g, '\n').trim();

  return normalizedOutput || normalizedStderr || normalizedStdout || 'No output captured for this run.';
}

const runHistoryTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

function formatRunHistoryTimestamp(timestamp: number) {
  return runHistoryTimestampFormatter.format(timestamp);
}

function buildRunComparisonSummary(latestSnapshot: RunHistorySnapshot, selectedSnapshot: RunHistorySnapshot) {
  const latestOutput = getRunSnapshotOutputText(latestSnapshot);
  const selectedOutput = getRunSnapshotOutputText(selectedSnapshot);
  const hasSameOutput = latestOutput === selectedOutput;
  const hasSameStatus = latestSnapshot.status === selectedSnapshot.status && latestSnapshot.runtime === selectedSnapshot.runtime;

  if (hasSameOutput && hasSameStatus) {
    return 'The latest run matches this snapshot exactly.';
  }

  if (hasSameOutput) {
    return 'The output stayed the same, but the run status changed.';
  }

  if (hasSameStatus) {
    return `Both runs ended as ${getRunSnapshotStatusLabel(latestSnapshot).toLowerCase()}, but the output changed.`;
  }

  return `The latest run is ${getRunSnapshotStatusLabel(latestSnapshot).toLowerCase()} versus ${getRunSnapshotStatusLabel(selectedSnapshot).toLowerCase()} in the selected snapshot.`;
}

function createConversationMessage(role: 'user' | 'assistant', content: string): AssistConversationMessage {
  return {
    id: createClientId(role),
    role,
    content,
  };
}

function extractAssistInsertionText(response: string) {
  const fencedCodeBlock = response.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);

  if (fencedCodeBlock?.[1]) {
    return fencedCodeBlock[1].trim();
  }

  return response.trim();
}

function getDefaultNewFileContent(language: EditorFileLanguage) {
  switch (language) {
    case 'python':
      return '';
    case 'html':
      return '<!doctype html>\n';
    case 'css':
      return '';
    case 'javascript':
      return '';
    case 'typescript':
      return '';
    case 'json':
      return '{\n  \n}\n';
    case 'markdown':
      return '# New Document\n';
    case 'plaintext':
      return '';
    default:
      return '';
  }
}

function getThemeVariables(theme: EditorThemeMode) {
  switch (theme) {
    case 'light':
      return {
        '--bg-base': '#f5f7fb',
        '--bg-surface': '#ffffff',
        '--bg-elevated': '#eef2ff',
        '--bg-overlay': '#e8eefc',
        '--bg-panel': '#f7f9ff',
        '--bg-panel-alt': '#eef3ff',
        '--bg-terminal': '#f3f6fd',
        '--border-subtle': '#d6dbe8',
        '--border-strong': '#bcc7de',
        '--border-accent': '#4f46e5',
        '--accent-primary': '#4f46e5',
        '--accent-glow': '#4338ca',
        '--accent-soft': 'rgba(79, 70, 229, 0.12)',
        '--accent-strong': 'rgba(79, 70, 229, 0.22)',
        '--chrome-highlight': 'rgba(255, 255, 255, 0.72)',
        '--panel-shadow': '0 20px 56px rgba(15, 23, 42, 0.12)',
        '--text-primary': '#0f172a',
        '--text-secondary': '#334155',
        '--text-muted': '#64748b',
        '--green': '#059669',
        '--red': '#dc2626',
        '--yellow': '#d97706',
      } as const;
    case 'contrast':
      return {
        '--bg-base': '#000000',
        '--bg-surface': '#030712',
        '--bg-elevated': '#111827',
        '--bg-overlay': '#0f172a',
        '--bg-panel': '#050816',
        '--bg-panel-alt': '#0b1120',
        '--bg-terminal': '#000000',
        '--border-subtle': '#334155',
        '--border-strong': '#facc15',
        '--border-accent': '#facc15',
        '--accent-primary': '#facc15',
        '--accent-glow': '#fde68a',
        '--accent-soft': 'rgba(250, 204, 21, 0.16)',
        '--accent-strong': 'rgba(250, 204, 21, 0.3)',
        '--chrome-highlight': 'rgba(255, 255, 255, 0.08)',
        '--panel-shadow': '0 20px 56px rgba(0, 0, 0, 0.58)',
        '--text-primary': '#ffffff',
        '--text-secondary': '#e2e8f0',
        '--text-muted': '#93c5fd',
        '--green': '#22c55e',
        '--red': '#fb7185',
        '--yellow': '#facc15',
      } as const;
    default:
      return {
        '--bg-base': '#04070d',
        '--bg-surface': '#090d14',
        '--bg-elevated': '#101722',
        '--bg-overlay': '#141b28',
        '--bg-panel': '#0b1018',
        '--bg-panel-alt': '#0f1520',
        '--bg-terminal': '#05070c',
        '--border-subtle': '#192131',
        '--border-strong': '#263146',
        '--border-accent': '#44506b',
        '--accent-primary': '#7382f6',
        '--accent-glow': '#c7d0ff',
        '--accent-soft': 'rgba(115, 130, 246, 0.14)',
        '--accent-strong': 'rgba(115, 130, 246, 0.28)',
        '--chrome-highlight': 'rgba(255, 255, 255, 0.04)',
        '--panel-shadow': '0 24px 80px rgba(0, 0, 0, 0.46)',
        '--text-primary': '#e8edf8',
        '--text-secondary': '#93a0b7',
        '--text-muted': '#566175',
        '--green': '#86e0a8',
        '--red': '#f08b8b',
        '--yellow': '#f0c96a',
      } as const;
  }
}

export default function EditorWorkspace({
  authedUser,
  profile,
  initialCollaborationSessionId = null,
  initialProjectId = null,
  initialProjectDetails = null,
  devBypass = false,
}: EditorWorkspaceProps) {
  const router = useRouter();
  const starterTemplates = getEditorStarterTemplates();
  const shouldShowStarterOnLoad = !initialProjectId && !initialProjectDetails;
  const initialBottomPanelHeight = shouldShowStarterOnLoad ? 0 : DEFAULT_BOTTOM_PANEL_HEIGHT;
  const initialFiles = initialProjectDetails ? toWorkspaceFiles(initialProjectDetails.files) : [];
  const initialEntryFile = initialProjectDetails ? getEntryFile(initialFiles) : null;
  const initialOutputText = getDefaultRunOutputText(initialProjectDetails?.project.templateKey ?? null, initialEntryFile);

  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>(shouldShowStarterOnLoad || initialProjectDetails ? 'ready' : 'loading');
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [project, setProject] = useState<EditorProjectSummary | null>(initialProjectDetails?.project ?? null);
  const [files, setFiles] = useState<WorkspaceFile[]>(initialFiles);
  const [openFilePaths, setOpenFilePaths] = useState<string[]>(initialFiles.map((file) => file.path));
  const [resolvedProjectId, setResolvedProjectId] = useState<string | null>(
    initialProjectId ?? initialProjectDetails?.project.id ?? null,
  );
  const [activeFilePath, setActiveFilePath] = useState<string | null>(initialEntryFile?.path ?? initialFiles[0]?.path ?? null);
  const [projectTitle, setProjectTitle] = useState(initialProjectDetails?.project.title ?? '');
  const [savedProjectTitle, setSavedProjectTitle] = useState(initialProjectDetails?.project.title ?? '');
  const [savedFilesSnapshot, setSavedFilesSnapshot] = useState(initialProjectDetails ? serializeFiles(initialFiles) : '[]');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [starterSelectionError, setStarterSelectionError] = useState<string | null>(null);
  const [creatingStarterId, setCreatingStarterId] = useState<EditorStarterTemplateId | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareError, setShareError] = useState<string | null>(null);
  const [collaborationIdentity] = useState<CollaborationIdentity>(() =>
    createCollaborationIdentity(profile.name || authedUser.email?.split('@')[0] || 'Collaborator'),
  );
  const [collaborationSessionId, setCollaborationSessionId] = useState<string | null>(initialCollaborationSessionId);
  const [collaborationConnected, setCollaborationConnected] = useState(false);
  const [collaborationInviteCopied, setCollaborationInviteCopied] = useState(false);
  const [collaborationParticipants, setCollaborationParticipants] = useState<CollaborationParticipant[]>([]);
  const [collaborationReadyForSync, setCollaborationReadyForSync] = useState(false);
  const [collaborationError, setCollaborationError] = useState<string | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const [assistQuestion, setAssistQuestion] = useState('');
  const [assistResponse, setAssistResponse] = useState('');
  const [assistMessages, setAssistMessages] = useState<AssistConversationMessage[]>([]);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [assistLoading, setAssistLoading] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('');
  const [commandPaletteHighlightIndex, setCommandPaletteHighlightIndex] = useState(0);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [compactActiveTab, setCompactActiveTab] = useState<CompactWorkspaceTab>('code');
  const [showShortcutSheet, setShowShortcutSheet] = useState(false);
  const [showViewControls, setShowViewControls] = useState(false);
  const [editorViewMode, setEditorViewMode] = useState<EditorViewMode>('code');
  const [editorTheme, setEditorTheme] = useState<EditorThemeMode>('dark');
  const [editorSettings, setEditorSettings] = useState(DEFAULT_EDITOR_SETTINGS);
  const [pythonRuntimeProgress, setPythonRuntimeProgress] = useState<PythonRunProgress | null>(null);
  const [pythonRunOutput, setPythonRunOutput] = useState<PythonRunOutput>(() => createIdleRunOutput(initialOutputText));
  const [jsRunOutput, setJsRunOutput] = useState<PythonRunOutput>(() => createIdleRunOutput(initialOutputText));
  const [jsRunnerSrcDoc, setJsRunnerSrcDoc] = useState('');
  const [previewSrcDoc, setPreviewSrcDoc] = useState('');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileError, setNewFileError] = useState<string | null>(null);
  const [pendingFileAction, setPendingFileAction] = useState<PendingFileAction>(null);
  const [fileActionPath, setFileActionPath] = useState('');
  const [fileActionError, setFileActionError] = useState<string | null>(null);
  const [explorerInlineError, setExplorerInlineError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [snippetSearchQuery, setSnippetSearchQuery] = useState('');
  const [isSnippetLibraryOpen, setIsSnippetLibraryOpen] = useState(true);
  const [importingSnippetId, setImportingSnippetId] = useState<string | null>(null);
  const [snippetFeedback, setSnippetFeedback] = useState<SnippetPanelFeedback | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isSaveErrorBannerDismissed, setIsSaveErrorBannerDismissed] = useState(false);
  const [stdin, setStdin] = useState('');
  const [isStdinExpanded, setIsStdinExpanded] = useState(false);
  const [runHistory, setRunHistory] = useState<RunHistorySnapshot[]>(() =>
    readStoredRunHistory(initialProjectDetails?.project.id ?? initialProjectId ?? null),
  );
  const [selectedRunHistoryId, setSelectedRunHistoryId] = useState<string | null>(null);
  const [activeBottomPanelTab, setActiveBottomPanelTab] = useState<BottomPanelTab>('terminal');
  const [expandedTraceIds, setExpandedTraceIds] = useState<Record<string, boolean>>({});
  const [mountedEditor, setMountedEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<Monaco | null>(null);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(initialBottomPanelHeight);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [selectionVersion, setSelectionVersion] = useState(0);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const newFileInputRef = useRef<HTMLInputElement | null>(null);
  const fileActionInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const snippetSearchInputRef = useRef<HTMLInputElement | null>(null);
  const commandPaletteInputRef = useRef<HTMLInputElement | null>(null);
  const jsRunnerIframeRef = useRef<HTMLIFrameElement | null>(null);
  const jsRunnerRunIdRef = useRef<string | null>(null);
  const jsRunStartedAtRef = useRef<number | null>(null);
  const editorColumnRef = useRef<HTMLDivElement | null>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const viewControlsRef = useRef<HTMLDivElement | null>(null);
  const bottomPanelHeightRef = useRef(initialBottomPanelHeight);
  const sidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const lastExpandedPanelHeightRef = useRef(DEFAULT_BOTTOM_PANEL_HEIGHT);
  const collaborationDocRef = useRef<Y.Doc | null>(null);
  const collaborationProviderRef = useRef<WebrtcProviderType | null>(null);
  const collaborationBindingRef = useRef<MonacoBindingType | null>(null);
  const filesRef = useRef<WorkspaceFile[]>(initialFiles);
  const projectTitleRef = useRef(initialProjectDetails?.project.title ?? '');
  const activeFilePathStateRef = useRef<string | null>(initialEntryFile?.path ?? initialFiles[0]?.path ?? null);

  const activeFile = useMemo(
    () => files.find((file) => file.path === activeFilePath) ?? null,
    [activeFilePath, files],
  );
  const activeOverlayFile = useMemo<LegacyEditorFile | null>(
    () => (activeFile ? toLegacyEditorFile(activeFile) : null),
    [activeFile],
  );
  const entryFile = useMemo(() => getEntryFile(files), [files]);
  const openTabs = useMemo(() => {
    const fileMap = new Map(files.map((file) => [file.path, file]));

    return openFilePaths.reduce<WorkspaceFile[]>((result, path) => {
      const file = fileMap.get(path);

      if (file) {
        result.push(file);
      }

      return result;
    }, []);
  }, [files, openFilePaths]);
  const isWebProject = files.some((file) => file.language === 'html');
  const isPythonProject = !isWebProject && entryFile?.language === 'python';
  const isJsProject =
    !isPythonProject &&
    !isWebProject &&
    (entryFile?.language === 'javascript' || entryFile?.language === 'typescript');
  const activeSnippetRuntime = getSnippetRuntimeForProject({ isWebProject, isPythonProject, isJsProject });
  const hasProject = Boolean(project?.id);
  const isCollaborationActive = Boolean(collaborationSessionId);
  const showCollaborationWaitingState = workspaceStatus === 'ready' && isCollaborationActive && files.length === 0;
  const showStarterEmptyState =
    workspaceStatus === 'ready' && !hasProject && files.length === 0 && !resolvedProjectId && !isCollaborationActive;
  const activeRunOutput = isJsProject ? jsRunOutput : pythonRunOutput;
  const isTitleDirty = projectTitle.trim() !== savedProjectTitle.trim();
  const stdinCharacterCountLabel = `${stdin.length} char${stdin.length === 1 ? '' : 's'}`;
  const filesSnapshot = useMemo(() => serializeFiles(files), [files]);
  const savedFiles = useMemo(() => JSON.parse(savedFilesSnapshot) as WorkspaceFile[], [savedFilesSnapshot]);
  const areFilesDirty = filesSnapshot !== savedFilesSnapshot;
  const isDirty = hasProject ? isTitleDirty || areFilesDirty : false;
  const runErrorText = isPythonProject && activeFile?.path === entryFile?.path ? pythonRunOutput.stderr : '';
  const titleLabel = showCollaborationWaitingState
    ? 'Live session'
    : showStarterEmptyState
      ? 'Starter templates'
      : projectTitle.trim() || project?.title || 'Untitled Project';
  const saveStatusLabel =
    !hasProject
      ? 'Choose a starter'
      : saveStatus === 'saving'
        ? 'Saving...'
        : saveStatus === 'saved'
          ? 'Saved'
          : saveStatus === 'error'
            ? 'Save failed'
            : isDirty
              ? 'Unsaved changes'
              : 'Synced';
  const showSaveErrorBanner = saveStatus === 'error' && Boolean(workspaceError) && !isSaveErrorBannerDismissed;
  const panelIsCollapsed = bottomPanelHeight === 0;
  const activeFileName = activeFile ? getFileName(activeFile.path) : 'No file selected';
  const activeFileIndicator = activeFile ? getEditorFileIndicator(activeFile.path) : null;
  const projectKindLabel = showCollaborationWaitingState
    ? 'LIVE'
    : showStarterEmptyState
      ? 'WELCOME'
      : isWebProject
      ? 'WEB PLAYGROUND'
      : isJsProject
        ? 'JS PLAYGROUND'
        : isPythonProject
          ? 'PYTHON PLAYGROUND'
          : 'EDITOR';
  const isRunning = activeRunOutput.status === 'running';
  const runButtonLabel = isRunning ? 'Running...' : isCompactLayout ? 'Run' : 'Run Code';
  const assistPanelLabel = 'Assist';
  const outputPanelButtonLabel = isWebProject ? 'Preview' : 'Output';
  const terminalPanelTabLabel = isWebProject ? 'Preview' : 'Logs';
  const problemsPanelLabel = 'Errors';
  const panelStatusLabel = showCollaborationWaitingState
    ? 'Waiting for host'
    : showStarterEmptyState
      ? 'Pick a starter'
      : isWebProject
      ? previewSrcDoc
        ? 'Preview live'
        : 'Preview idle'
      : activeRunOutput.status === 'running'
        ? 'Process running'
        : activeRunOutput.status === 'error'
          ? 'Run failed'
          : activeRunOutput.status === 'stopped'
            ? 'Run stopped'
            : activeRunOutput.status === 'success'
              ? 'Last run finished'
              : 'Ready';
  const panelStatusDotColor = showCollaborationWaitingState
    ? '#38bdf8'
    : showStarterEmptyState
      ? '#64748b'
      : isWebProject
      ? previewSrcDoc
        ? '#4ade80'
        : '#374151'
      : activeRunOutput.status === 'running'
        ? '#818cf8'
        : activeRunOutput.status === 'error'
          ? '#f87171'
          : activeRunOutput.status === 'stopped'
            ? '#facc15'
            : '#4ade80';
  const currentLanguageLabel = activeFile
    ? LANGUAGE_OPTIONS.find((language) => language.value === activeFile.language)?.label ?? activeFile.language
    : 'Language';
  const remoteCollaboratorCount = collaborationParticipants.filter((participant) => !participant.isSelf).length;
  const collaborationStatusLabel = !isCollaborationActive
    ? 'Collaboration off'
    : remoteCollaboratorCount > 0
      ? `${remoteCollaboratorCount + 1} people live`
      : collaborationConnected
        ? 'Live session ready'
        : 'Connecting live session';
  const collaborationPresenceLabel =
    remoteCollaboratorCount > 0 ? `${remoteCollaboratorCount} collaborator${remoteCollaboratorCount === 1 ? '' : 's'} joined` : 'Waiting for collaborator';
  const canEditProjectTitle = hasProject;
  const canSaveProject = hasProject;
  const canShareProject = hasProject;
  const canRunProject = Boolean(entryFile);
  const canStartCollaboration = files.length > 0 || isCollaborationActive;
  const savedActiveFile = useMemo(
    () => (activeFile ? savedFiles.find((file) => file.path === activeFile.path) ?? null : null),
    [activeFile, savedFiles],
  );
  const canShowDiff = Boolean(activeFile && (savedActiveFile?.content ?? '') !== activeFile.content);
  const defaultRunOutputText = getDefaultRunOutputText(project?.templateKey ?? null, entryFile);
  const executionTimeLabel =
    activeRunOutput.durationMs !== null ? `Last run: ${formatExecutionTime(activeRunOutput.durationMs)}` : null;
  const pythonProgressPercent = getProgressPercent(pythonRuntimeProgress?.stage ?? null);
  const assistSelectionSummary = useMemo(() => {
    const model = editorRef.current?.getModel();
    const selection = editorRef.current?.getSelection();

    if (!model || !selection || selection.isEmpty()) {
      return 'No selection';
    }

    const startLine = selection.startLineNumber;
    const endLine = selection.endLineNumber;
    const selectedText = model.getValueInRange(selection);
    const selectedCharacterCount = selectedText.trim().length;

    return selectedCharacterCount > 0
      ? `Lines ${startLine}-${endLine} • ${selectedCharacterCount} chars selected`
      : `Lines ${startLine}-${endLine}`;
  }, [mountedEditor, activeFile?.content, selectionVersion]);
  const editorThemeVariables = getThemeVariables(editorTheme);
  const overlayTheme = editorTheme === 'light' ? 'light' : 'dark';

  const filteredFiles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return files;
    }

    return files.filter((file) => {
      const fileName = getFileName(file.path).toLowerCase();
      return file.path.toLowerCase().includes(normalizedQuery) || fileName.includes(normalizedQuery);
    });
  }, [files, searchQuery]);
  const filteredCommunitySnippets = useMemo(() => {
    const normalizedQuery = snippetSearchQuery.trim().toLowerCase();

    return COMMUNITY_SNIPPET_CATALOG.filter((snippet) => {
      if (!normalizedQuery) {
        return true;
      }

      const searchableText = `${snippet.title} ${snippet.description} ${snippet.detail} ${snippet.author} ${snippet.category} ${snippet.tags.join(' ')}`.toLowerCase();
      return searchableText.includes(normalizedQuery);
    }).sort((left, right) => {
      const leftIsBestFit = isSnippetCompatibleWithProject(left.runtime, activeSnippetRuntime) ? 1 : 0;
      const rightIsBestFit = isSnippetCompatibleWithProject(right.runtime, activeSnippetRuntime) ? 1 : 0;

      if (leftIsBestFit !== rightIsBestFit) {
        return rightIsBestFit - leftIsBestFit;
      }

      return left.title.localeCompare(right.title);
    });
  }, [activeSnippetRuntime, snippetSearchQuery]);

  const dirtyFilePaths = useMemo(() => {
    if (!hasProject) {
      return new Set<string>();
    }

    const savedFileMap = new Map(savedFiles.map((file) => [file.path, file.content]));

    return new Set(
      files
        .filter((file) => savedFileMap.get(file.path) !== file.content)
        .map((file) => file.path),
    );
  }, [files, hasProject, savedFiles]);
  const changedFileCount = dirtyFilePaths.size;
  const hasChangesSinceLastSave = hasProject && changedFileCount > 0;
  const terminalEntries = useMemo(() => buildEditorTerminalEntries(activeRunOutput), [activeRunOutput]);
  const problemEntries = useMemo(() => buildProblemEntries(activeRunOutput.stderr, entryFile), [activeRunOutput.stderr, entryFile]);
  const latestRunSnapshot = runHistory[0] ?? null;
  const selectedRunSnapshot = useMemo(
    () => runHistory.find((snapshot) => snapshot.id === selectedRunHistoryId) ?? null,
    [runHistory, selectedRunHistoryId],
  );
  const comparisonRunSnapshot =
    selectedRunSnapshot && latestRunSnapshot && selectedRunSnapshot.id !== latestRunSnapshot.id ? selectedRunSnapshot : null;
  const runHistoryComparisonSummary =
    latestRunSnapshot && comparisonRunSnapshot ? buildRunComparisonSummary(latestRunSnapshot, comparisonRunSnapshot) : null;
  const canClearConsole =
    !isWebProject &&
    activeRunOutput.status !== 'running' &&
    (activeRunOutput.events.length > 0 ||
      activeRunOutput.stdout.trim().length > 0 ||
      activeRunOutput.stderr.trim().length > 0 ||
      activeRunOutput.durationMs !== null ||
      activeRunOutput.status !== 'idle' ||
      activeRunOutput.output !== defaultRunOutputText);
  const panelTabs = [
    { id: 'terminal' as BottomPanelTab, label: terminalPanelTabLabel, icon: TerminalSquare },
    { id: 'problems' as BottomPanelTab, label: problemsPanelLabel, icon: AlertCircle, count: problemEntries.length },
  ];
  const activePanelLabel = panelTabs.find((tab) => tab.id === activeBottomPanelTab)?.label ?? terminalPanelTabLabel;
  const compactTabItems: Array<{
    id: CompactWorkspaceTab;
    label: string;
    badge?: string | number;
  }> = [
    { id: 'code', label: 'Code' },
    { id: 'files', label: 'Files', badge: files.length },
    { id: 'output', label: outputPanelButtonLabel, badge: problemEntries.length > 0 ? problemEntries.length : undefined },
    { id: 'assist', label: assistPanelLabel },
  ];
  const showExplorerPanel = isCompactLayout ? compactActiveTab === 'files' : isSidebarVisible;
  const showAssistPanel = isCompactLayout ? compactActiveTab === 'assist' : assistOpen;
  const showEditorWorkspacePanel = !isCompactLayout || compactActiveTab === 'code' || compactActiveTab === 'output';
  const showCompactOutputPanel = isCompactLayout && compactActiveTab === 'output';

  const getCollaborationInviteUrl = useCallback(
    (sessionId: string) => {
      if (typeof window === 'undefined') {
        return '';
      }

      const url = new URL(window.location.href);

      url.searchParams.set(COLLABORATION_SESSION_QUERY_KEY, sessionId);

      if (resolvedProjectId) {
        url.searchParams.set('projectId', resolvedProjectId);
      } else {
        url.searchParams.delete('projectId');
      }

      return url.toString();
    },
    [resolvedProjectId],
  );

  const replaceCollaborationUrl = useCallback(
    (sessionId: string | null) => {
      if (typeof window === 'undefined') {
        return;
      }

      const url = new URL(window.location.href);

      if (sessionId) {
        url.searchParams.set(COLLABORATION_SESSION_QUERY_KEY, sessionId);
      } else {
        url.searchParams.delete(COLLABORATION_SESSION_QUERY_KEY);
      }

      if (resolvedProjectId) {
        url.searchParams.set('projectId', resolvedProjectId);
      }

      window.history.replaceState({}, '', url.toString());
    },
    [resolvedProjectId],
  );

  const applyCollaborationSnapshotToWorkspace = useCallback((snapshot?: ReturnType<typeof readCollaborationSnapshot>) => {
    const collaborationDoc = collaborationDocRef.current;

    if (!collaborationDoc) {
      return;
    }

    const nextSnapshot = snapshot ?? readCollaborationSnapshot(collaborationDoc);
    const nextFiles = nextSnapshot.files.map((file) => ({
      path: file.path,
      language: file.language,
      content: file.content,
      sortOrder: file.sortOrder,
      isEntry: file.isEntry,
    }));
    const nextFilePaths = new Set(nextFiles.map((file) => file.path));
    const preferredActivePath =
      (activeFilePathStateRef.current && nextFilePaths.has(activeFilePathStateRef.current) ? activeFilePathStateRef.current : null) ??
      (nextSnapshot.activeFilePath && nextFilePaths.has(nextSnapshot.activeFilePath) ? nextSnapshot.activeFilePath : null) ??
      getEntryFile(nextFiles)?.path ??
      nextFiles[0]?.path ??
      null;

    setFiles(nextFiles);
    setProjectTitle(nextSnapshot.title || projectTitleRef.current);
    setProject((currentProject) =>
      currentProject && nextSnapshot.title
        ? {
            ...currentProject,
            title: nextSnapshot.title,
          }
        : currentProject,
    );
    setActiveFilePath(preferredActivePath);
    setOpenFilePaths((currentPaths) => {
      const nextOpenPaths = currentPaths.filter((path) => nextFilePaths.has(path));

      if (preferredActivePath && !nextOpenPaths.includes(preferredActivePath)) {
        nextOpenPaths.push(preferredActivePath);
      }

      return nextOpenPaths;
    });
  }, []);

  const syncCollaborationParticipants = useCallback(() => {
    const provider = collaborationProviderRef.current;

    if (!provider) {
      setCollaborationParticipants([]);
      return;
    }

    const nextParticipants = Array.from(provider.awareness.getStates().entries())
      .map(([clientId, state]) => {
        const userState = typeof state.user === 'object' && state.user ? state.user : {};
        const metaState = typeof state.meta === 'object' && state.meta ? state.meta : {};

        return {
          clientId,
          color: typeof userState.color === 'string' ? userState.color : '#818cf8',
          filePath: typeof metaState.filePath === 'string' ? metaState.filePath : null,
          isSelf: clientId === provider.doc.clientID,
          name: typeof userState.name === 'string' ? userState.name : `Collaborator ${clientId}`,
        } satisfies CollaborationParticipant;
      })
      .sort((left, right) => Number(right.isSelf) - Number(left.isSelf) || left.name.localeCompare(right.name));

    setCollaborationParticipants(nextParticipants);
  }, []);

  const handleEditorReady = useCallback((nextEditor: editor.IStandaloneCodeEditor | null) => {
    editorRef.current = nextEditor;
    setMountedEditor(nextEditor);
  }, []);

  const handleMonacoReady = useCallback((nextMonacoInstance: Monaco | null) => {
    setMonacoInstance(nextMonacoInstance);
  }, []);

  useEffect(() => {
    bottomPanelHeightRef.current = bottomPanelHeight;

    if (bottomPanelHeight > 0) {
      lastExpandedPanelHeightRef.current = bottomPanelHeight;
    }
  }, [bottomPanelHeight]);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    projectTitleRef.current = projectTitle;
  }, [projectTitle]);

  useEffect(() => {
    activeFilePathStateRef.current = activeFilePath;
  }, [activeFilePath]);

  useEffect(() => {
    setRunHistory(readStoredRunHistory(project?.id ?? null));
  }, [project?.id]);

  useEffect(() => {
    if (selectedRunHistoryId && !runHistory.some((snapshot) => snapshot.id === selectedRunHistoryId)) {
      setSelectedRunHistoryId(null);
    }
  }, [runHistory, selectedRunHistoryId]);

  useEffect(() => {
    setCollaborationSessionId(initialCollaborationSessionId);
  }, [initialCollaborationSessionId]);

  useEffect(() => {
    if (!collaborationSessionId) {
      return;
    }

    replaceCollaborationUrl(collaborationSessionId);
  }, [collaborationSessionId, replaceCollaborationUrl]);

  useEffect(() => {
    collaborationBindingRef.current?.destroy();
    collaborationBindingRef.current = null;
    collaborationProviderRef.current?.destroy();
    collaborationProviderRef.current = null;
    collaborationDocRef.current?.destroy();
    collaborationDocRef.current = null;
    setCollaborationConnected(false);
    setCollaborationInviteCopied(false);
    setCollaborationParticipants([]);
    setCollaborationReadyForSync(false);
    setCollaborationError(null);

    if (!collaborationSessionId) {
      return;
    }

    let isCancelled = false;
    let collaborationDoc: Y.Doc | null = null;
    let provider: WebrtcProviderType | null = null;
    let initialSyncTimeoutId: number | null = null;
    let handleProviderStatus: ((event: { connected: boolean }) => void) | null = null;
    let handleDocUpdate: ((update: Uint8Array, origin: unknown) => void) | null = null;
    let finalizeInitialSync: (() => void) | null = null;

    void (async () => {
      try {
        const { WebrtcProvider: RuntimeWebrtcProvider } = await import('y-webrtc');

        if (isCancelled) {
          return;
        }

        collaborationDoc = new Y.Doc();
        provider = new RuntimeWebrtcProvider(buildCollaborationRoomName(collaborationSessionId), collaborationDoc, {
          password: collaborationSessionId,
        });
        handleProviderStatus = (event: { connected: boolean }) => {
          setCollaborationConnected(event.connected);
        };
        handleDocUpdate = (_update: Uint8Array, origin: unknown) => {
          if (origin === 'yantra-collaboration-sync' || origin === collaborationBindingRef.current) {
            return;
          }

          applyCollaborationSnapshotToWorkspace();
        };
        finalizeInitialSync = () => {
          if (!collaborationDocRef.current || !collaborationDoc || collaborationDocRef.current !== collaborationDoc) {
            return;
          }

          if (!hasCollaborationFiles(collaborationDoc) && filesRef.current.length > 0) {
            syncCollaborationSnapshot(collaborationDoc, {
              activeFilePath: activeFilePathStateRef.current,
              files: normalizeSaveFiles(filesRef.current),
              title: projectTitleRef.current.trim() || 'Untitled Project',
            });
          }

          applyCollaborationSnapshotToWorkspace();
          syncCollaborationParticipants();
          setCollaborationReadyForSync(true);
        };
        initialSyncTimeoutId = window.setTimeout(finalizeInitialSync, 1200);

        collaborationDocRef.current = collaborationDoc;
        collaborationProviderRef.current = provider;
        provider.awareness.setLocalStateField('user', collaborationIdentity);
        provider.awareness.setLocalStateField('meta', { filePath: activeFilePathStateRef.current });
        provider.on('status', handleProviderStatus);
        provider.on('synced', finalizeInitialSync);
        provider.awareness.on('change', syncCollaborationParticipants);
        collaborationDoc.on('update', handleDocUpdate);
        syncCollaborationParticipants();
      } catch (error) {
        setCollaborationError(error instanceof Error ? error.message : 'Unable to start live collaboration.');
      }
    })();

    return () => {
      isCancelled = true;

      if (initialSyncTimeoutId !== null) {
        window.clearTimeout(initialSyncTimeoutId);
      }

      if (provider && handleProviderStatus) {
        provider.off('status', handleProviderStatus);
      }

      if (provider && finalizeInitialSync) {
        provider.off('synced', finalizeInitialSync);
      }

      if (provider) {
        provider.awareness.off('change', syncCollaborationParticipants);
        provider.awareness.setLocalState(null);
        provider.destroy();
      }

      if (collaborationDoc && handleDocUpdate) {
        collaborationDoc.off('update', handleDocUpdate);
      }

      collaborationDoc?.destroy();

      if (collaborationProviderRef.current === provider) {
        collaborationProviderRef.current = null;
      }

      if (collaborationDocRef.current === collaborationDoc) {
        collaborationDocRef.current = null;
      }
    };
  }, [
    applyCollaborationSnapshotToWorkspace,
    collaborationIdentity,
    collaborationSessionId,
    syncCollaborationParticipants,
  ]);

  useEffect(() => {
    const provider = collaborationProviderRef.current;

    if (!provider) {
      return;
    }

    provider.awareness.setLocalStateField('user', collaborationIdentity);
    provider.awareness.setLocalStateField('meta', {
      filePath: activeFilePath,
    });
    syncCollaborationParticipants();
  }, [activeFilePath, collaborationIdentity, collaborationSessionId, syncCollaborationParticipants]);

  useEffect(() => {
    if (!collaborationSessionId || !collaborationReadyForSync || !collaborationDocRef.current) {
      return;
    }

    if (files.length === 0 && !projectTitle.trim()) {
      return;
    }

    syncCollaborationSnapshot(collaborationDocRef.current, {
      activeFilePath,
      files: normalizeSaveFiles(files),
      title: projectTitle.trim() || project?.title || 'Untitled Project',
    });
  }, [activeFilePath, collaborationReadyForSync, collaborationSessionId, files, filesSnapshot, project?.title, projectTitle]);

  useEffect(() => {
    collaborationBindingRef.current?.destroy();
    collaborationBindingRef.current = null;

    const provider = collaborationProviderRef.current;
    const collaborationDoc = collaborationDocRef.current;
    const activeEditor = editorRef.current ?? mountedEditor;
    const model = activeEditor?.getModel();

    if (!collaborationReadyForSync || !provider || !collaborationDoc || !activeEditor || !model || !activeFile) {
      return;
    }

    let isCancelled = false;
    let binding: MonacoBindingType | null = null;

    void (async () => {
      const { MonacoBinding: RuntimeMonacoBinding } = await import('y-monaco');

      if (isCancelled) {
        return;
      }

      const yText = getCollaborationText(collaborationDoc, activeFile);

      binding = new RuntimeMonacoBinding(yText, model, new Set([activeEditor]), provider.awareness);
      collaborationBindingRef.current = binding;
    })();

    return () => {
      isCancelled = true;
      binding?.destroy();

      if (collaborationBindingRef.current === binding) {
        collaborationBindingRef.current = null;
      }
    };
  }, [activeFile, collaborationReadyForSync, collaborationSessionId, mountedEditor]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const styleElement = document.createElement('style');
    styleElement.setAttribute('data-yantra-collaboration-cursors', 'true');

    const renderCollaborationStyles = () => {
      const provider = collaborationProviderRef.current;

      if (!provider) {
        styleElement.textContent = '';
        return;
      }

      styleElement.textContent = collaborationParticipants
        .filter((participant) => !participant.isSelf)
        .map((participant) => {
          const label = JSON.stringify(participant.name);

          return `
            .yRemoteSelection-${participant.clientId} {
              background: ${toRgba(participant.color, 0.18)};
            }

            .yRemoteSelectionHead-${participant.clientId} {
              border-left: 2px solid ${participant.color};
              position: relative;
            }

            .monaco-editor .yRemoteSelectionHead-${participant.clientId}::after {
              content: ${label};
              position: absolute;
              top: -1.45rem;
              left: -1px;
              padding: 0.18rem 0.45rem;
              border-radius: 999px;
              background: ${participant.color};
              color: #020617;
              font-size: 10px;
              font-weight: 700;
              line-height: 1;
              letter-spacing: 0.01em;
              white-space: nowrap;
            }
          `;
        })
        .join('\n');
    };

    document.head.appendChild(styleElement);
    renderCollaborationStyles();

    return () => {
      styleElement.remove();
    };
  }, [collaborationParticipants, collaborationSessionId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${COMPACT_LAYOUT_BREAKPOINT}px)`);
    const syncCompactLayout = () => {
      setIsCompactLayout(mediaQuery.matches);
    };

    syncCompactLayout();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncCompactLayout);

      return () => {
        mediaQuery.removeEventListener('change', syncCompactLayout);
      };
    }

    mediaQuery.addListener(syncCompactLayout);

    return () => {
      mediaQuery.removeListener(syncCompactLayout);
    };
  }, []);

  useEffect(() => {
    if (!isCompactLayout) {
      return;
    }

    setShowViewControls(false);
    setIsEditingTitle(false);

    if (showStarterEmptyState) {
      setCompactActiveTab('code');
    }
  }, [isCompactLayout, showStarterEmptyState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedTheme = window.localStorage.getItem('yantra.editor.theme');
    const storedSettings = window.localStorage.getItem('yantra.editor.settings');

    if (storedTheme === 'dark' || storedTheme === 'light' || storedTheme === 'contrast') {
      setEditorTheme(storedTheme);
    }

    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings) as Partial<EditorQuickSettings>;

        setEditorSettings({
          fontSize:
            typeof parsed.fontSize === 'number' && Number.isFinite(parsed.fontSize)
              ? Math.max(11, Math.min(22, parsed.fontSize))
              : DEFAULT_EDITOR_SETTINGS.fontSize,
          minimapEnabled:
            typeof parsed.minimapEnabled === 'boolean'
              ? parsed.minimapEnabled
              : DEFAULT_EDITOR_SETTINGS.minimapEnabled,
          wordWrap: parsed.wordWrap === 'on' ? 'on' : DEFAULT_EDITOR_SETTINGS.wordWrap,
        });
      } catch {
        // Ignore malformed local settings and keep defaults.
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem('yantra.editor.theme', editorTheme);
  }, [editorTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem('yantra.editor.settings', JSON.stringify(editorSettings));
  }, [editorSettings]);

  useEffect(() => {
    if (canShowDiff) {
      return;
    }

    setEditorViewMode('code');
  }, [canShowDiff]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (viewControlsRef.current?.contains(event.target as Node)) {
        return;
      }

      setShowViewControls(false);
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const activeEditor = editorRef.current ?? mountedEditor;

    if (!activeEditor) {
      return;
    }

    const selectionListener = activeEditor.onDidChangeCursorSelection(() => {
      setSelectionVersion((current) => current + 1);
    });

    return () => {
      selectionListener.dispose();
    };
  }, [mountedEditor, activeFile?.path]);

  useEffect(() => {
    if (!isEditingTitle) {
      return;
    }

    window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
  }, [isEditingTitle]);

  useEffect(() => {
    if (!isCreatingFile) {
      return;
    }

    window.requestAnimationFrame(() => {
      newFileInputRef.current?.focus();
      newFileInputRef.current?.select();
    });
  }, [isCreatingFile]);

  useEffect(() => {
    if (!pendingFileAction) {
      return;
    }

    window.requestAnimationFrame(() => {
      fileActionInputRef.current?.focus();
      fileActionInputRef.current?.select();
    });
  }, [pendingFileAction]);

  useEffect(() => {
    if (!activeFilePath) {
      return;
    }

    setOpenFilePaths((currentPaths) =>
      currentPaths.includes(activeFilePath) ? currentPaths : [...currentPaths, activeFilePath],
    );
  }, [activeFilePath]);

  const applyProjectDetails = useCallback((projectDetails: EditorProjectDetails) => {
    const nextFiles = toWorkspaceFiles(projectDetails.files);
    const nextActiveFile = getEntryFile(nextFiles) ?? nextFiles[0] ?? null;

    setProject(projectDetails.project);
    setFiles(nextFiles);
    setOpenFilePaths(nextFiles.map((file) => file.path));
    setResolvedProjectId(projectDetails.project.id);
    setActiveFilePath(nextActiveFile?.path ?? null);
    setProjectTitle(projectDetails.project.title);
    setSavedProjectTitle(projectDetails.project.title);
    setSavedFilesSnapshot(serializeFiles(nextFiles));
    setIsEditingTitle(false);
    setSaveStatus('idle');
    setStarterSelectionError(null);
    setCreatingStarterId(null);
    setAssistResponse('');
    setAssistMessages([]);
    setAssistError(null);
    setShareUrl('');
    setShareError(null);
    setEditorViewMode('code');
    setPreviewSrcDoc('');
    setJsRunnerSrcDoc('');
    jsRunnerRunIdRef.current = null;
    setPythonRuntimeProgress(null);
    setIsCreatingFile(false);
    setNewFilePath('');
    setNewFileError(null);
    setSnippetSearchQuery('');
    setSnippetFeedback(null);
    setImportingSnippetId(null);
    setPythonRunOutput(createIdleRunOutput(getDefaultRunOutputText(projectDetails.project.templateKey, nextActiveFile)));
    setJsRunOutput(createIdleRunOutput(getDefaultRunOutputText(projectDetails.project.templateKey, nextActiveFile)));
    setWorkspaceStatus('ready');
  }, []);

  const handleSelectStarterTemplate = useCallback(
    async (starterTemplateId: EditorStarterTemplateId) => {
      if (creatingStarterId) {
        return;
      }

      const starterTemplate = getEditorStarterTemplate(starterTemplateId);

      setStarterSelectionError(null);
      setCreatingStarterId(starterTemplateId);

      try {
        if (devBypass) {
          const createdProjectDetails = saveLocalEditorProject(
            createLocalEditorProjectFromStarterTemplate(starterTemplateId, authedUser.id),
          );

          applyProjectDetails(createdProjectDetails);
          startTransition(() => {
            router.replace(`/editor?projectId=${createdProjectDetails.project.id}`);
          });
          return;
        }

        const createdProjectDetails = await readJson<EditorProjectDetails>(
          await fetch('/api/editor/projects', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              templateKey: starterTemplate.templateKey,
              title: starterTemplate.title,
            }),
          }),
        );

        const savedFilesResponse = await readJson<{ files: EditorProjectFile[] }>(
          await fetch(`/api/editor/projects/${createdProjectDetails.project.id}/files`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(
              starterTemplate.files.map((file) => ({
                path: file.path,
                language: file.language,
                content: file.content,
                sort_order: file.sortOrder,
                is_entry: file.isEntry,
              })),
            ),
          }),
        );

        applyProjectDetails({
          project: createdProjectDetails.project,
          files: savedFilesResponse.files,
        });
        startTransition(() => {
          router.replace(`/editor?projectId=${createdProjectDetails.project.id}`);
        });
      } catch (error) {
        setCreatingStarterId(null);
        setStarterSelectionError(
          error instanceof Error ? error.message : `Unable to open the ${starterTemplate.title} starter.`,
        );
      }
    },
    [applyProjectDetails, authedUser.id, creatingStarterId, devBypass, router],
  );

  useEffect(() => {
    setResolvedProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    if (!initialProjectDetails) {
      return;
    }

    applyProjectDetails(initialProjectDetails);
  }, [applyProjectDetails, initialProjectDetails]);

  useEffect(() => {
    let isCancelled = false;

    async function loadWorkspace() {
      if (!resolvedProjectId) {
        setWorkspaceError(null);
        setWorkspaceStatus('ready');
        return;
      }

      setWorkspaceStatus((currentStatus) => (currentStatus === 'ready' ? currentStatus : 'loading'));
      setWorkspaceError(null);

      try {
        if (devBypass) {
          if (initialProjectDetails && resolvedProjectId === initialProjectDetails.project.id) {
            saveLocalEditorProject(initialProjectDetails);
          }

          const localProjectDetails = getLocalEditorProject(resolvedProjectId);

          if (!localProjectDetails) {
            if (collaborationSessionId) {
              if (!isCancelled) {
                setWorkspaceError(null);
                setWorkspaceStatus('ready');
              }

              return;
            }

            const created = saveLocalEditorProject(createLocalEditorProject('python-playground', authedUser.id));

            if (!isCancelled) {
              applyProjectDetails(created);
              startTransition(() => {
                router.replace(`/editor?projectId=${created.project.id}`);
              });
            }

            return;
          }

          if (!isCancelled) {
            applyProjectDetails(localProjectDetails);
          }

          return;
        }

        const projectDetails = await readJson<EditorProjectDetails>(
          await fetch(`/api/editor/projects/${resolvedProjectId}`, {
            method: 'GET',
            cache: 'no-store',
          }),
        );

        if (!isCancelled) {
          applyProjectDetails(projectDetails);
        }
      } catch (error) {
        if (!isCancelled) {
          if (collaborationSessionId) {
            setWorkspaceError(null);
            setWorkspaceStatus('ready');
            return;
          }

          setWorkspaceError(error instanceof Error ? error.message : 'Unable to load the editor workspace.');
          setWorkspaceStatus('error');
        }
      }
    }

    void loadWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [applyProjectDetails, authedUser.id, collaborationSessionId, devBypass, initialProjectDetails, resolvedProjectId, router]);

  useEffect(() => {
    if (!isPythonProject) {
      setPythonRuntimeProgress(null);
      return;
    }

    void warmPyodideRuntime({
      onProgress: (progress) => {
        setPythonRuntimeProgress(progress);
      },
    }).catch(() => {
      // Warmup is opportunistic; the first run will still surface real errors.
    });
  }, [isPythonProject, project?.id]);

  useEffect(() => {
    const handleJsRunnerMessage = (event: MessageEvent<JsRunnerMessage>) => {
      if (event.source !== jsRunnerIframeRef.current?.contentWindow) {
        return;
      }

      const message = event.data;

      if (!message || message.source !== 'yantra-js-runner' || message.runId !== jsRunnerRunIdRef.current) {
        return;
      }

      if (message.type === 'log') {
        setJsRunOutput((currentOutput) => {
          const stdout = appendExecutionText(currentOutput.stdout, message.payload ?? '');

          return {
            ...currentOutput,
            events: appendTerminalEvents(currentOutput.events, message.payload ?? '', 'stdout'),
            stdout,
            output: buildExecutionOutput(stdout, currentOutput.stderr, 'JavaScript finished without output.'),
          };
        });
        return;
      }

      if (message.type === 'error') {
        setJsRunOutput((currentOutput) => {
          const stderr = appendExecutionText(currentOutput.stderr, message.payload ?? '');

          return {
            ...currentOutput,
            events: appendTerminalEvents(currentOutput.events, message.payload ?? '', 'stderr'),
            status: 'error',
            stderr,
            output: buildExecutionOutput(currentOutput.stdout, stderr, 'JavaScript finished with an error.'),
          };
        });
        return;
      }

      if (message.type === 'done') {
        const durationMs =
          jsRunStartedAtRef.current === null ? null : Math.round(performance.now() - jsRunStartedAtRef.current);

        let completedOutput: PythonRunOutput | null = null;

        setJsRunOutput((currentOutput) => {
          const nextStatus = currentOutput.stderr.trim().length > 0 ? 'error' : 'success';
          const nextOutput =
            durationMs === null
              ? buildExecutionOutput(currentOutput.stdout, currentOutput.stderr, 'JavaScript finished without output.')
              : appendExecutionSummary(
                  buildExecutionOutput(currentOutput.stdout, currentOutput.stderr, 'JavaScript finished without output.'),
                  durationMs,
                );
          const summaryEvents =
            durationMs === null
              ? []
              : [
                  createTerminalEvent(
                    nextStatus === 'error'
                      ? `Run failed in ${formatExecutionTime(durationMs)}.`
                      : `Run completed in ${formatExecutionTime(durationMs)}.`,
                    nextStatus === 'error' ? 'stderr' : 'success',
                  ),
                ];

          completedOutput = {
            ...currentOutput,
            events: [...currentOutput.events, ...summaryEvents],
            status: nextStatus,
            output: nextOutput,
            durationMs,
          };

          return completedOutput;
        });

        const latestEntryFile = getEntryFile(filesRef.current);

        if (completedOutput && latestEntryFile) {
          recordRunSnapshot(completedOutput, {
            runtime: 'javascript',
            entryPath: latestEntryFile.path,
          });
        }

        jsRunStartedAtRef.current = null;
      }
    };

    window.addEventListener('message', handleJsRunnerMessage);

    return () => {
      window.removeEventListener('message', handleJsRunnerMessage);
    };
  }, [project?.id]);

  useEffect(() => {
    if (stdin.length > 0) {
      setIsStdinExpanded(true);
    }
  }, [stdin]);

  useEffect(() => {
    if (!explorerInlineError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setExplorerInlineError(null);
    }, 2800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [explorerInlineError]);

  useEffect(() => {
    if (!collaborationInviteCopied) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCollaborationInviteCopied(false);
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [collaborationInviteCopied]);

  useEffect(() => {
    if (saveStatus === 'error') {
      setIsSaveErrorBannerDismissed(false);
    }
  }, [saveStatus, workspaceError]);

  useEffect(() => {
    if (!project?.id || !areFilesDirty) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveProject({ includeTitle: false });
    }, PYTHON_AUTOSAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [areFilesDirty, filesSnapshot, project?.id]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  async function saveProject({ includeTitle }: { includeTitle: boolean }) {
    if (!project?.id) {
      return false;
    }

    setSaveStatus('saving');
    const titleToSave = projectTitle;
    const filesToSave = normalizeSaveFiles(files);
    const filesSnapshotToSave = serializeFiles(files);

    try {
      let nextProject = project;

      if (devBypass) {
        const timestamp = new Date().toISOString();
        const nextTitle = includeTitle && isTitleDirty ? titleToSave.trim() || project.title : project.title;
        const currentLocalProject = getLocalEditorProject(project.id);
        const localProjectDetails: EditorProjectDetails = {
          project: {
            ...project,
            title: nextTitle,
            updatedAt: timestamp,
          },
          files: filesToSave.map((file) => {
            const previousFile = currentLocalProject?.files.find((storedFile) => storedFile.path === file.path);

            return {
              id: previousFile?.id ?? `local-file-${project.id}-${file.path}`,
              projectId: project.id,
              path: file.path,
              language: file.language,
              content: file.content,
              sortOrder: file.sortOrder,
              isEntry: file.isEntry,
              createdAt: previousFile?.createdAt ?? timestamp,
              updatedAt: timestamp,
            };
          }),
        };

        saveLocalEditorProject(localProjectDetails);
        setProject(localProjectDetails.project);
        setProjectTitle(localProjectDetails.project.title);
        setSavedProjectTitle(localProjectDetails.project.title);
        setSavedFilesSnapshot(filesSnapshotToSave);
        setSaveStatus('saved');
        return true;
      }

      if (includeTitle && isTitleDirty) {
        const titleResponse = await readJson<{ project: EditorProjectSummary }>(
          await fetch(`/api/editor/projects/${project.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: projectTitle,
            }),
          }),
        );

        nextProject = titleResponse.project;
        setProject((currentProject) =>
          currentProject
            ? {
                ...currentProject,
                title: titleResponse.project.title,
                updatedAt: titleResponse.project.updatedAt,
              }
            : currentProject,
        );
        setProjectTitle((currentTitle) =>
          currentTitle.trim() === titleToSave.trim() ? titleResponse.project.title : currentTitle,
        );
        setSavedProjectTitle(titleResponse.project.title);
      }

      if (areFilesDirty) {
        await readJson<{ files: EditorProjectFile[] }>(
          await fetch(`/api/editor/projects/${project.id}/files`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(
              filesToSave.map((file) => ({
                path: file.path,
                language: file.language,
                content: file.content,
                sort_order: file.sortOrder,
                is_entry: file.isEntry,
              })),
            ),
          }),
        );

        setSavedFilesSnapshot(filesSnapshotToSave);
      }

      setProject(nextProject);
      setSaveStatus('saved');
      return true;
    } catch (error) {
      setSaveStatus('error');
      setWorkspaceError(error instanceof Error ? error.message : 'Unable to save the current project.');
      return false;
    }
  }

  function handleCompactTabSelect(nextTab: CompactWorkspaceTab) {
    setCompactActiveTab(nextTab);

    if (nextTab === 'output' && panelIsCollapsed) {
      reopenBottomPanel();
    }
  }

  function toggleExplorerVisibility() {
    if (isCompactLayout) {
      setCompactActiveTab((currentTab) => (currentTab === 'files' ? 'code' : 'files'));
      return;
    }

    setIsSidebarVisible((current) => !current);
  }

  function toggleAssistVisibility() {
    if (isCompactLayout) {
      setCompactActiveTab((currentTab) => (currentTab === 'assist' ? 'code' : 'assist'));
      return;
    }

    setAssistOpen((current) => !current);
  }

  function focusCommunitySnippets() {
    if (isCompactLayout) {
      setCompactActiveTab('files');
    }

    setIsSidebarVisible(true);
    setIsExplorerOpen(true);
    setIsSnippetLibraryOpen(true);

    window.requestAnimationFrame(() => {
      snippetSearchInputRef.current?.focus();
      snippetSearchInputRef.current?.select();
    });
  }

  async function handleCopyCollaborationInvite() {
    if (!collaborationSessionId) {
      return;
    }

    try {
      const inviteUrl = getCollaborationInviteUrl(collaborationSessionId);

      if (!inviteUrl) {
        throw new Error('Unable to build the collaboration link right now.');
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const temporaryInput = document.createElement('textarea');
        temporaryInput.value = inviteUrl;
        temporaryInput.setAttribute('readonly', 'true');
        temporaryInput.style.position = 'absolute';
        temporaryInput.style.left = '-9999px';
        document.body.appendChild(temporaryInput);
        temporaryInput.select();
        document.execCommand('copy');
        temporaryInput.remove();
      }

      setCollaborationInviteCopied(true);
      setCollaborationError(null);
    } catch (error) {
      setCollaborationError(error instanceof Error ? error.message : 'Unable to copy the collaboration link.');
      setCollaborationInviteCopied(false);
    }
  }

  function handleStartCollaboration() {
    if (!canStartCollaboration) {
      setCollaborationError('Open a project or starter template before inviting a collaborator.');
      return;
    }

    if (collaborationSessionId) {
      void handleCopyCollaborationInvite();
      return;
    }

    setCollaborationError(null);
    setCollaborationSessionId(createCollaborationSessionId());
  }

  function handleStopCollaboration() {
    setCollaborationInviteCopied(false);
    setCollaborationError(null);
    setCollaborationSessionId(null);
    setCollaborationReadyForSync(false);
    setCollaborationParticipants([]);
    replaceCollaborationUrl(null);
  }

  function startNewFileCreation() {
    if (!project?.id && !isCollaborationActive) {
      if (isCompactLayout) {
        setCompactActiveTab('files');
      }

      setIsSidebarVisible(true);
      setIsExplorerOpen(true);
      setExplorerInlineError('Choose a starter template first so Yantra can create your workspace.');
      return;
    }

    if (isCompactLayout) {
      setCompactActiveTab('files');
    }

    setIsSidebarVisible(true);
    setIsExplorerOpen(true);
    setIsCreatingFile(true);
    setNewFilePath('');
    setNewFileError(null);
  }

  function cancelNewFileCreation() {
    setIsCreatingFile(false);
    setNewFilePath('');
    setNewFileError(null);
  }

  function startRenameFile(path: string) {
    setExplorerInlineError(null);
    setPendingFileAction({ type: 'rename', path });
    setFileActionPath(path);
    setFileActionError(null);
  }

  function startDeleteFile(path: string) {
    setExplorerInlineError(null);

    if (files.length === 1) {
      setPendingFileAction(null);
      setFileActionPath('');
      setFileActionError(null);
      setExplorerInlineError('You need at least one file in the project.');
      return;
    }

    if (dirtyFilePaths.has(path)) {
      setPendingFileAction({ type: 'delete', path });
      setFileActionPath(path);
      setFileActionError(null);
      return;
    }

    cancelFileAction();
    void deleteFile(path);
  }

  function cancelFileAction() {
    setPendingFileAction(null);
    setFileActionPath('');
    setFileActionError(null);
  }

  function validateNewFilePath(candidatePath: string) {
    const normalizedPath = candidatePath.trim().replace(/\\/g, '/').replace(/^\/+/, '');

    if (!normalizedPath) {
      return { error: 'A filename is required.' } as const;
    }

    if (
      normalizedPath.endsWith('/') ||
      normalizedPath.split('/').some((segment) => segment.length === 0 || segment === '.' || segment === '..')
    ) {
      return { error: 'Use a valid relative file path.' } as const;
    }

    const extension = getFileExtension(normalizedPath);

    if (!SUPPORTED_NEW_FILE_EXTENSIONS.includes(extension as (typeof SUPPORTED_NEW_FILE_EXTENSIONS)[number])) {
      return {
        error: `Supported extensions: ${SUPPORTED_NEW_FILE_EXTENSIONS.join(', ')}`,
      } as const;
    }

    if (files.some((file) => file.path.toLowerCase() === normalizedPath.toLowerCase())) {
      return { error: 'A file with that name already exists.' } as const;
    }

    return {
      path: normalizedPath,
      language: getEditorLanguageFromPath(normalizedPath),
    } as const;
  }

  async function persistFileSet(nextFiles: WorkspaceFile[]) {
    if (!project?.id) {
      return isCollaborationActive;
    }

    setSaveStatus('saving');

    const filesToSave = normalizeSaveFiles(nextFiles);
    const nextSnapshot = serializeFiles(nextFiles);

    try {
      if (devBypass) {
        const timestamp = new Date().toISOString();
        const currentLocalProject = getLocalEditorProject(project.id);
        const localProjectDetails: EditorProjectDetails = {
          project: {
            ...project,
            updatedAt: timestamp,
          },
          files: filesToSave.map((file) => {
            const previousFile = currentLocalProject?.files.find((storedFile) => storedFile.path === file.path);

            return {
              id: previousFile?.id ?? `local-file-${project.id}-${file.path}`,
              projectId: project.id,
              path: file.path,
              language: file.language,
              content: file.content,
              sortOrder: file.sortOrder,
              isEntry: file.isEntry,
              createdAt: previousFile?.createdAt ?? timestamp,
              updatedAt: timestamp,
            };
          }),
        };

        saveLocalEditorProject(localProjectDetails);
        setProject(localProjectDetails.project);
      } else {
        await readJson<{ files: EditorProjectFile[] }>(
          await fetch(`/api/editor/projects/${project.id}/files`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(
              filesToSave.map((file) => ({
                path: file.path,
                language: file.language,
                content: file.content,
                sort_order: file.sortOrder,
                is_entry: file.isEntry,
              })),
            ),
          }),
        );
      }

      setSavedFilesSnapshot(nextSnapshot);
      setSaveStatus('saved');
      return true;
    } catch (error) {
      setSaveStatus('error');
      setWorkspaceError(error instanceof Error ? error.message : 'Unable to save the current project.');
      return false;
    }
  }

  async function deleteFile(path: string) {
    if (files.length === 1) {
      setExplorerInlineError('You need at least one file in the project.');
      return;
    }

    const fileIndex = files.findIndex((file) => file.path === path);

    if (fileIndex < 0) {
      return;
    }

    const nextFiles = files
      .filter((file) => file.path !== path)
      .map((file, index) => ({
        ...file,
        sortOrder: index,
      }));

    if (!nextFiles.some((file) => file.isEntry) && nextFiles[0]) {
      nextFiles[0] = { ...nextFiles[0], isEntry: true };
    }

    const nextPreferredActivePath =
      files[fileIndex + 1]?.path ?? files[fileIndex - 1]?.path ?? nextFiles[0]?.path ?? null;
    const nextActivePath = nextFiles.some((file) => file.path === nextPreferredActivePath)
      ? nextPreferredActivePath
      : nextFiles[0]?.path ?? null;

    const deletedOpenTabIndex = openFilePaths.indexOf(path);
    const nextOpenFilePaths = openFilePaths.filter((currentPath) => currentPath !== path);

    if (activeFilePath === path && nextActivePath && !nextOpenFilePaths.includes(nextActivePath)) {
      const insertionIndex = deletedOpenTabIndex >= 0 ? Math.min(deletedOpenTabIndex, nextOpenFilePaths.length) : nextOpenFilePaths.length;
      nextOpenFilePaths.splice(insertionIndex, 0, nextActivePath);
    }

    setFiles(nextFiles);
    setOpenFilePaths(nextOpenFilePaths);

    if (activeFilePath === path) {
      setActiveFilePath(nextActivePath);
    }

    await persistFileSet(nextFiles);
  }

  async function confirmNewFileCreation() {
    const validation = validateNewFilePath(newFilePath);

    if ('error' in validation) {
      if (!newFilePath.trim()) {
        cancelNewFileCreation();
        return;
      }

      setNewFileError(validation.error ?? 'Unable to create the file.');
      window.requestAnimationFrame(() => {
        newFileInputRef.current?.focus();
        newFileInputRef.current?.select();
      });
      return;
    }

    const nextSortOrder = files.reduce((highestSortOrder, file) => Math.max(highestSortOrder, file.sortOrder), -1) + 1;
    const nextFile: WorkspaceFile = {
      path: validation.path,
      language: validation.language,
      content: getDefaultNewFileContent(validation.language),
      sortOrder: nextSortOrder,
      isEntry: files.length === 0,
    };
    const nextFiles = [...files, nextFile].sort((left, right) => left.sortOrder - right.sortOrder);

    setFiles(nextFiles);
    setActiveFilePath(nextFile.path);
    setOpenFilePaths((currentPaths) =>
      currentPaths.includes(nextFile.path) ? currentPaths : [...currentPaths, nextFile.path],
    );
    if (isCompactLayout) {
      setCompactActiveTab('code');
    }
    cancelNewFileCreation();
    await persistFileSet(nextFiles);
  }

  async function handleImportCommunitySnippet(snippetId: string) {
    const snippet = getEditorCommunitySnippet(snippetId);

    if (!snippet) {
      setSnippetFeedback({
        tone: 'error',
        text: 'That snippet is no longer available.',
      });
      return;
    }

    if (!project?.id && !isCollaborationActive) {
      setSnippetFeedback({
        tone: 'error',
        text: 'Choose a starter template first so Yantra has a workspace to import into.',
      });
      focusCommunitySnippets();
      return;
    }

    setSnippetFeedback(null);
    setImportingSnippetId(snippet.id);
    setExplorerInlineError(null);

    const existingPaths = new Set(files.map((file) => file.path.toLowerCase()));
    let nextSortOrder = files.reduce((highestSortOrder, file) => Math.max(highestSortOrder, file.sortOrder), -1) + 1;

    const importedFiles: WorkspaceFile[] = snippet.files.map((file) => {
      const nextPath = buildUniqueImportedFilePath(file.path, existingPaths);
      existingPaths.add(nextPath.toLowerCase());

      return {
        path: nextPath,
        language: file.language,
        content: file.content,
        sortOrder: nextSortOrder++,
        isEntry: false,
      };
    });

    const nextFiles = [...files, ...importedFiles].sort((left, right) => left.sortOrder - right.sortOrder);
    const nextOpenFilePaths = [...openFilePaths];

    importedFiles.forEach((file) => {
      if (!nextOpenFilePaths.includes(file.path)) {
        nextOpenFilePaths.push(file.path);
      }
    });

    setFiles(nextFiles);
    setOpenFilePaths(nextOpenFilePaths);
    setActiveFilePath(importedFiles[0]?.path ?? activeFilePath);

    if (isCompactLayout) {
      setCompactActiveTab('code');
    }

    const didPersist = await persistFileSet(nextFiles);

    setImportingSnippetId(null);

    if (didPersist === false) {
      setSnippetFeedback({
        tone: 'error',
        text: `Imported ${snippet.title}, but Yantra could not save the project right away.`,
      });
      return;
    }

    setSnippetFeedback({
      tone: 'success',
      text:
        importedFiles.length === 1
          ? `Imported ${snippet.title} to ${importedFiles[0]?.path}.`
          : `Imported ${importedFiles.length} files from ${snippet.title}.`,
    });
  }

  async function handleLanguageChange(nextLanguage: EditorFileLanguage) {
    if (!activeFile) {
      return;
    }

    const nextFiles = files.map((file) =>
      file.path === activeFile.path
        ? {
            ...file,
            language: nextLanguage,
          }
        : file,
    );

    setFiles(nextFiles);
    await persistFileSet(nextFiles);
  }

  function openSearchReplace() {
    const activeEditor = editorRef.current ?? mountedEditor;

    if (!activeEditor) {
      return;
    }

    activeEditor.focus();
    activeEditor.getAction('editor.action.startFindReplaceAction')?.run();
  }

  function handleInsertAssistSuggestion(mode: 'replace-selection' | 'insert-at-cursor') {
    const activeEditor = editorRef.current ?? mountedEditor;
    const insertionText = extractAssistInsertionText(assistResponse);

    if (!activeEditor || !insertionText) {
      return;
    }

    const selection = activeEditor.getSelection();

    if (!selection) {
      return;
    }

    const targetRange =
      mode === 'replace-selection' && !selection.isEmpty()
        ? selection
        : {
            startLineNumber: selection.positionLineNumber,
            startColumn: selection.positionColumn,
            endLineNumber: selection.positionLineNumber,
            endColumn: selection.positionColumn,
          };

    activeEditor.executeEdits('yantra-ai-insert', [
      {
        range: targetRange,
        text: insertionText,
        forceMoveMarkers: true,
      },
    ]);
    activeEditor.focus();
  }

  function recordRunSnapshot(
    runOutput: PythonRunOutput,
    {
      entryPath,
      previewSrcDoc,
      runtime,
    }: {
      entryPath: string;
      previewSrcDoc?: string;
      runtime: RunSnapshotRuntime;
    },
  ) {
    if (
      runOutput.status === 'running' ||
      (runOutput.events.length === 0 &&
        runOutput.stdout.trim().length === 0 &&
        runOutput.stderr.trim().length === 0 &&
        runOutput.output.trim().length === 0)
    ) {
      return;
    }

    const nextSnapshot = createRunHistorySnapshot({
      entryPath,
      previewSrcDoc,
      runOutput,
      runtime,
    });

    setRunHistory((currentHistory) => {
      const nextHistory = [nextSnapshot, ...currentHistory].slice(0, MAX_RUN_HISTORY_ENTRIES);

      if (project?.id) {
        writeStoredRunHistory(project.id, nextHistory);
      }

      return nextHistory;
    });
  }

  async function handleRun() {
    if (!entryFile) {
      return;
    }

    if (isCompactLayout) {
      setCompactActiveTab('output');
    }

    if (panelIsCollapsed) {
      reopenBottomPanel();
    }

    if (isPythonProject) {
      jsRunnerRunIdRef.current = null;
      setJsRunnerSrcDoc('');
      setPythonRuntimeProgress({
        stage: 'running',
        message: 'Executing Python in-browser...',
      });
      setPythonRunOutput(
        createRunOutputState({
          status: 'running',
          output: 'Executing your Python file in-browser...',
          events: [createTerminalEvent('Executing your Python file in-browser...', 'info')],
        }),
      );
      setActiveBottomPanelTab('terminal');

      const result = await runPythonInBrowser(entryFile.content, stdin, {
        onProgress: (progress) => {
          setPythonRuntimeProgress(progress);
        },
      });

      const nextPythonRunOutput = createRunOutputState({
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        output: appendExecutionSummary(result.output, result.durationMs),
        durationMs: result.durationMs,
        events: buildExecutionEvents(result.stdout, result.stderr, {
          status: result.status,
          fallbackOutput: result.output,
          durationMs: result.durationMs,
        }),
      });

      setPythonRunOutput(nextPythonRunOutput);
      recordRunSnapshot(nextPythonRunOutput, {
        runtime: 'python',
        entryPath: entryFile.path,
      });
      setPythonRuntimeProgress(
        result.status === 'stopped'
          ? null
          : {
              stage: 'ready',
              message: 'Python runtime ready.',
            },
      );
      return;
    }

    if (isJsProject) {
      const nextRunId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `js-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let executableSource = entryFile.content;

      jsRunnerRunIdRef.current = null;
      setJsRunnerSrcDoc('');
      setPreviewSrcDoc('');

      if (entryFile.language === 'typescript') {
        try {
          const transpiled = await getExecutableJsSource(entryFile);

          if (transpiled.diagnostics) {
            const nextJsRunOutput = createRunOutputState({
              status: 'error',
              stderr: transpiled.diagnostics,
              output: transpiled.diagnostics,
              events: createTerminalEventsFromText(transpiled.diagnostics, 'stderr'),
            });

            setJsRunOutput(nextJsRunOutput);
            recordRunSnapshot(nextJsRunOutput, {
              runtime: 'javascript',
              entryPath: entryFile.path,
            });
            setActiveBottomPanelTab('terminal');
            return;
          }

          executableSource = transpiled.code;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to transpile this TypeScript file.';

          const nextJsRunOutput = createRunOutputState({
            status: 'error',
            stderr: message,
            output: message,
            events: createTerminalEventsFromText(message, 'stderr'),
          });

          setJsRunOutput(nextJsRunOutput);
          recordRunSnapshot(nextJsRunOutput, {
            runtime: 'javascript',
            entryPath: entryFile.path,
          });
          setActiveBottomPanelTab('terminal');
          return;
        }
      }

      jsRunnerRunIdRef.current = nextRunId;
      jsRunStartedAtRef.current = performance.now();
      setJsRunOutput(
        createRunOutputState({
          status: 'running',
          output: 'Running your JavaScript or TypeScript file in-browser...',
          events: [createTerminalEvent('Running your JavaScript or TypeScript file in-browser...', 'info')],
        }),
      );
      setActiveBottomPanelTab('terminal');
      setJsRunnerSrcDoc(buildJsRunnerDocument(executableSource, nextRunId));
      return;
    }

    if (isWebProject) {
      jsRunnerRunIdRef.current = null;
      setJsRunnerSrcDoc('');
      const nextPreviewSrcDoc = buildWebPreviewDocument(files);
      setPreviewSrcDoc(nextPreviewSrcDoc);
      setActiveBottomPanelTab('terminal');
      const nextPreviewRunOutput = createRunOutputState({
        status: 'idle',
        output: 'Preview refreshed.',
        events: [createTerminalEvent('Preview refreshed.', 'success')],
      });

      setJsRunOutput(nextPreviewRunOutput);
      recordRunSnapshot(nextPreviewRunOutput, {
        runtime: 'preview',
        entryPath: entryFile.path,
        previewSrcDoc: nextPreviewSrcDoc,
      });
      return;
    }

    const nextUnsupportedRunOutput = createRunOutputState({
      status: 'error',
      output: `Execution is not configured for ${entryFile.language} files yet.`,
      events: [createTerminalEvent(`Execution is not configured for ${entryFile.language} files yet.`, 'stderr')],
    });

    setPythonRunOutput(nextUnsupportedRunOutput);
    recordRunSnapshot(nextUnsupportedRunOutput, {
      runtime: 'unsupported',
      entryPath: entryFile.path,
    });
    setActiveBottomPanelTab('terminal');
  }

  function handleStopExecution() {
    if (!isPythonProject) {
      return;
    }

    const didStop = stopPythonInBrowserExecution();

    if (!didStop) {
      return;
    }

    setPythonRuntimeProgress(null);
  }

  function handleClearConsole() {
    if (!canClearConsole) {
      return;
    }

    setExpandedTraceIds({});

    if (isJsProject) {
      setJsRunOutput(createIdleRunOutput(defaultRunOutputText));
      return;
    }

    setPythonRunOutput(createIdleRunOutput(defaultRunOutputText));
  }

  function toggleTraceExpansion(traceId: string) {
    setExpandedTraceIds((current) => ({
      ...current,
      [traceId]: !current[traceId],
    }));
  }

  const handleManualSave = useCallback(async () => {
    await saveProject({ includeTitle: true });
  }, [project, projectTitle, files, isTitleDirty, areFilesDirty, devBypass]);

  function openCommandPalette() {
    setCommandPaletteOpen(true);
    setCommandPaletteQuery('');
    setCommandPaletteHighlightIndex(0);
  }

  function closeCommandPalette() {
    setCommandPaletteOpen(false);
    setCommandPaletteQuery('');
    setCommandPaletteHighlightIndex(0);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey;
      const isTitleRevertShortcut =
        isModifierPressed && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z';
      const eventTarget = event.target;
      const isEditableTarget =
        eventTarget instanceof HTMLElement &&
        (eventTarget.isContentEditable ||
          eventTarget.tagName === 'INPUT' ||
          eventTarget.tagName === 'TEXTAREA' ||
          eventTarget.tagName === 'SELECT');

      if (isModifierPressed && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        openCommandPalette();
        return;
      }

      if (isModifierPressed && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        openSearchReplace();
        return;
      }

      if (event.key === '?' && !isEditableTarget) {
        event.preventDefault();
        setShowShortcutSheet(true);
        return;
      }

      if (event.key.toLowerCase() === 'd' && event.altKey && event.shiftKey && !isEditableTarget) {
        event.preventDefault();
        if (editorViewMode === 'diff') {
          setEditorViewMode('code');
          return;
        }

        if (!hasChangesSinceLastSave) {
          return;
        }

        const nextDiffPath =
          canShowDiff || dirtyFilePaths.has(activeFilePath ?? '')
            ? activeFilePath
            : Array.from(dirtyFilePaths)[0] ?? null;

        if (!nextDiffPath) {
          return;
        }

        if (isCompactLayout) {
          setCompactActiveTab('code');
        }

        setActiveFilePath(nextDiffPath);
        setOpenFilePaths((currentPaths) => (currentPaths.includes(nextDiffPath) ? currentPaths : [...currentPaths, nextDiffPath]));
        setEditorViewMode('diff');
        return;
      }

      if (commandPaletteOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeCommandPalette();
        }

        return;
      }

      if (isTitleRevertShortcut && !isEditingTitle && isTitleDirty && !isEditableTarget) {
        event.preventDefault();
        revertProjectTitleToSaved();
        return;
      }

      if (isModifierPressed && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleManualSave();
        return;
      }

      if (isModifierPressed && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        startNewFileCreation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    activeFilePath,
    canShowDiff,
    commandPaletteOpen,
    dirtyFilePaths,
    editorViewMode,
    handleManualSave,
    hasChangesSinceLastSave,
    isCompactLayout,
    isEditingTitle,
    isTitleDirty,
    mountedEditor,
    savedProjectTitle,
  ]);

  useEffect(() => {
    if (!commandPaletteOpen) {
      return;
    }

    window.requestAnimationFrame(() => {
      commandPaletteInputRef.current?.focus();
      commandPaletteInputRef.current?.select();
    });
  }, [commandPaletteOpen]);

  async function confirmFileAction() {
    if (!pendingFileAction) {
      return;
    }

    const targetFile = files.find((file) => file.path === pendingFileAction.path);

    if (!targetFile) {
      cancelFileAction();
      return;
    }

    if (pendingFileAction.type === 'delete') {
      if (files.length === 1) {
        cancelFileAction();
        setExplorerInlineError('You need at least one file in the project.');
        return;
      }

      cancelFileAction();
      await deleteFile(pendingFileAction.path);
      return;
    }

    const normalizedPath = fileActionPath.trim().replace(/\\/g, '/').replace(/^\/+/, '');

    if (!normalizedPath) {
      setFileActionError('A filename is required.');
      return;
    }

    if (
      normalizedPath.endsWith('/') ||
      normalizedPath.split('/').some((segment) => segment.length === 0 || segment === '.' || segment === '..')
    ) {
      setFileActionError('Use a valid relative file path.');
      return;
    }

    const extension = getFileExtension(normalizedPath);

    if (!SUPPORTED_NEW_FILE_EXTENSIONS.includes(extension as (typeof SUPPORTED_NEW_FILE_EXTENSIONS)[number])) {
      setFileActionError(`Supported extensions: ${SUPPORTED_NEW_FILE_EXTENSIONS.join(', ')}`);
      return;
    }

    if (files.some((file) => file.path.toLowerCase() === normalizedPath.toLowerCase() && file.path !== pendingFileAction.path)) {
      setFileActionError('A file with that name already exists.');
      return;
    }

    const nextFiles = files.map((file) =>
      file.path === pendingFileAction.path
        ? {
            ...file,
            path: normalizedPath,
            language: getEditorLanguageFromPath(normalizedPath),
          }
        : file,
    );

    setFiles(nextFiles);
    setOpenFilePaths((currentPaths) =>
      currentPaths.map((path) => (path === pendingFileAction.path ? normalizedPath : path)),
    );
    if (activeFilePath === pendingFileAction.path) {
      setActiveFilePath(normalizedPath);
    }
    cancelFileAction();
    await persistFileSet(nextFiles);
  }

  async function handleShare() {
    if (!project?.id) {
      return;
    }

    setShareModalOpen(true);
    setShareLoading(true);
    setShareError(null);
    setShareUrl('');

    try {
      if (devBypass) {
        throw new Error('Share links are unavailable in local mode right now.');
      }

      if (isDirty) {
        const didSaveSucceed = await saveProject({ includeTitle: true });

        if (!didSaveSucceed) {
          throw new Error('Save failed before sharing. Please try again.');
        }
      }

      const response = await readJson<{ shareUrl: string }>(
        await fetch(`/api/editor/projects/${project.id}/share`, {
          method: 'POST',
        }),
      );

      setShareUrl(response.shareUrl);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Unable to create a share link.');
    } finally {
      setShareLoading(false);
    }
  }

  async function handleAssist() {
    if (!activeFile || !assistQuestion.trim()) {
      return;
    }

    if (devBypass) {
      setAssistError('AI assist is unavailable in local mode right now.');
      setAssistResponse('');
      return;
    }

    const model = editorRef.current?.getModel();
    const selection = editorRef.current?.getSelection();
    const selectedText = model && selection ? model.getValueInRange(selection).trim() : '';
    const nextUserMessage = createConversationMessage('user', assistQuestion.trim());

    setAssistLoading(true);
    setAssistError(null);
    setAssistResponse('');
    setAssistMessages((currentMessages) => [...currentMessages, nextUserMessage]);

    try {
      const response = await readJson<EditorAssistResponse>(
        await fetch('/api/editor/assist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            language: activeFile.language,
            fileContent: activeFile.content,
            selectedText,
            learnerLevel: profile.skillLevel,
            question: assistQuestion.trim(),
            history: assistMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          } satisfies EditorAssistRequest),
        }),
      );

      setAssistResponse(response.reply);
      setAssistMessages((currentMessages) => [
        ...currentMessages,
        createConversationMessage('assistant', response.reply),
      ]);
      setAssistQuestion('');
    } catch (error) {
      setAssistMessages((currentMessages) => currentMessages.filter((message) => message.id !== nextUserMessage.id));
      setAssistError(error instanceof Error ? error.message : 'Yantra assist is unavailable right now.');
    } finally {
      setAssistLoading(false);
    }
  }

  function handleFileChange(nextContent: string) {
    if (!activeFile) {
      return;
    }

    setFiles((currentFiles) =>
      currentFiles.map((file) =>
        file.path === activeFile.path
          ? {
              ...file,
              content: nextContent,
            }
          : file,
      ),
    );
  }

  const handleApplyFix = useCallback(
    (lineNumber: number, replacementLine: string) => {
      if (!activeFile) {
        return;
      }

      setFiles((currentFiles) =>
        currentFiles.map((file) => {
          if (file.path !== activeFile.path) {
            return file;
          }

          const lines = file.content.split('\n');

          if (lineNumber < 1 || lineNumber > lines.length) {
            return file;
          }

          lines[lineNumber - 1] = replacementLine;

          return {
            ...file,
            content: lines.join('\n'),
          };
        }),
      );

      editorRef.current?.focus();
    },
    [activeFile],
  );

  function handleFileSelect(path: string) {
    if (isCompactLayout) {
      setCompactActiveTab('code');
    }

    setActiveFilePath(path);
    setOpenFilePaths((currentPaths) => (currentPaths.includes(path) ? currentPaths : [...currentPaths, path]));
  }

  function openDiffView() {
    if (!hasChangesSinceLastSave) {
      return;
    }

    const nextDiffPath =
      canShowDiff || dirtyFilePaths.has(activeFilePath ?? '')
        ? activeFilePath
        : Array.from(dirtyFilePaths)[0] ?? null;

    if (!nextDiffPath) {
      return;
    }

    handleFileSelect(nextDiffPath);
    setEditorViewMode('diff');
    setShowViewControls(false);
  }

  function toggleDiffView() {
    if (editorViewMode === 'diff') {
      setEditorViewMode('code');
      setShowViewControls(false);
      return;
    }

    openDiffView();
  }

  function handleCloseTab(path: string) {
    setOpenFilePaths((currentPaths) => {
      const nextPaths = currentPaths.filter((currentPath) => currentPath !== path);

      if (activeFilePath === path) {
        setActiveFilePath(nextPaths[nextPaths.length - 1] ?? null);
      }

      return nextPaths;
    });
  }

  function revertProjectTitleToSaved() {
    setProjectTitle(savedProjectTitle);
    setIsEditingTitle(false);
  }

  function commitTitleEdit() {
    setIsEditingTitle(false);

    if (isTitleDirty) {
      void saveProject({ includeTitle: true });
    }
  }

  function reopenBottomPanel() {
    setBottomPanelHeight(lastExpandedPanelHeightRef.current || DEFAULT_BOTTOM_PANEL_HEIGHT);
  }

  function handleBottomPanelResizeStart(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();

    const startY = event.clientY;
    const startHeight = bottomPanelHeightRef.current || DEFAULT_BOTTOM_PANEL_HEIGHT;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const availableHeight = editorColumnRef.current?.getBoundingClientRect().height ?? window.innerHeight;
      const maxHeight = Math.max(MIN_BOTTOM_PANEL_HEIGHT, availableHeight - 140);
      const nextHeight = Math.max(0, Math.min(maxHeight, startHeight + delta));

      setBottomPanelHeight(nextHeight < MIN_BOTTOM_PANEL_HEIGHT / 2 ? 0 : nextHeight);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleSidebarResizeStart(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = sidebarWidthRef.current;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const layoutWidth = layoutRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      const reservedWidth = (assistOpen ? AI_PANEL_WIDTH : 0) + MIN_CENTER_COLUMN_WIDTH;
      const maxWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, layoutWidth - reservedWidth));

      setSidebarWidth(Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxWidth, startWidth + delta)));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handlePanelTabSelect(nextTab: BottomPanelTab) {
    setActiveBottomPanelTab(nextTab);

    if (isCompactLayout) {
      setCompactActiveTab('output');
      return;
    }

    if (panelIsCollapsed) {
      reopenBottomPanel();
    }
  }

  function handleProblemSelect(problem: ProblemEntry) {
    handleFileSelect(problem.filePath);

    if (!problem.lineNumber) {
      return;
    }

    window.requestAnimationFrame(() => {
      editorRef.current?.revealLineInCenter(problem.lineNumber ?? 1);
      editorRef.current?.setPosition({
        lineNumber: problem.lineNumber ?? 1,
        column: 1,
      });
      editorRef.current?.focus();
    });
  }

  function executeCommandPaletteItem(item: CommandPaletteItem | undefined) {
    if (!item) {
      return;
    }

    closeCommandPalette();
    void item.onSelect();
  }

  const themeCommandPaletteItems: CommandPaletteItem[] = THEME_OPTIONS.map((themeOption) => ({
    id: `theme-${themeOption.value}`,
    label: `Change Theme: ${themeOption.label}`,
    description:
      editorTheme === themeOption.value
        ? `${themeOption.label} is currently active.`
        : `Switch the editor to the ${themeOption.label.toLowerCase()} theme.`,
    keywords: `theme appearance color mode ${themeOption.value} ${themeOption.label.toLowerCase()} ${themeOption.description.toLowerCase()}`,
    onSelect: () => setEditorTheme(themeOption.value),
  }));

  const languageCommandPaletteItems: CommandPaletteItem[] = activeFile
    ? LANGUAGE_OPTIONS.map((languageOption) => ({
        id: `language-${languageOption.value}`,
        label: `Switch Language: ${languageOption.label}`,
        description:
          activeFile.language === languageOption.value
            ? `${activeFileName} already uses ${languageOption.label}.`
            : `Set ${activeFileName} to ${languageOption.label}.`,
        keywords: `language syntax mode active file ${languageOption.value} ${languageOption.label.toLowerCase()} ${activeFile.path.toLowerCase()}`,
        onSelect: () =>
          activeFile.language === languageOption.value ? undefined : handleLanguageChange(languageOption.value),
      }))
    : [];

  const commandPaletteItems: CommandPaletteItem[] = showStarterEmptyState
    ? [
        ...starterTemplates.map((template) => ({
          id: `start-${template.id}`,
          label: `Start with ${template.title}`,
          description: template.description,
          keywords: `starter template ${template.title.toLowerCase()} ${template.eyebrow.toLowerCase()}`,
          onSelect: () => handleSelectStarterTemplate(template.id),
        })),
        {
          id: 'toggle-explorer',
          label: 'Toggle Explorer',
          description: showExplorerPanel ? 'Hide the explorer sidebar.' : 'Show the explorer sidebar.',
          keywords: 'toggle explorer sidebar files',
          onSelect: () => toggleExplorerVisibility(),
        },
        {
          id: 'toggle-ai-assist',
          label: 'Toggle AI Panel',
          description: showAssistPanel ? 'Close the AI assist panel.' : 'Open the AI assist panel.',
          keywords: 'toggle ai assist assistant copilot chat panel',
          onSelect: () => toggleAssistVisibility(),
        },
        ...themeCommandPaletteItems,
        {
          id: 'open-shortcuts',
          label: 'Keyboard Shortcuts',
          description: 'Open the shortcut cheat sheet.',
          keywords: 'keyboard shortcuts help cheat sheet',
          onSelect: () => setShowShortcutSheet(true),
        },
        {
          id: collaborationSessionId ? 'copy-live-link' : 'start-live-session',
          label: collaborationSessionId ? 'Copy Live Session Link' : 'Start Live Session',
          description: collaborationSessionId ? 'Copy the invite link for the current collaboration room.' : 'Create a collaboration room for this editor.',
          keywords: 'live collaborate collaboration peer session room invite',
          onSelect: () => (collaborationSessionId ? handleCopyCollaborationInvite() : handleStartCollaboration()),
        },
      ]
    : [
        {
          id: 'run',
          label: 'Run',
          description: isWebProject
            ? 'Refresh the live preview for this project.'
            : isJsProject
              ? 'Execute the current JavaScript or TypeScript entry file.'
              : 'Execute the current project.',
          keywords: `run execute ${isWebProject ? 'preview web' : isJsProject ? 'javascript js typescript ts console terminal' : 'python terminal'}`,
          onSelect: () => handleRun(),
        },
        {
          id: 'save',
          label: 'Save',
          description: 'Persist the current project changes.',
          keywords: 'save sync persist project',
          onSelect: () => handleManualSave(),
        },
        ...(isPythonProject && isRunning
          ? [
              {
                id: 'stop-python',
                label: 'Stop Python execution',
                description: 'Terminate the current Python run.',
                keywords: 'stop python cancel execution runtime',
                onSelect: () => handleStopExecution(),
              },
            ]
          : []),
        {
          id: 'share',
          label: 'Open Share Dialog',
          description: 'Open the share dialog for this project.',
          keywords: 'share publish link',
          onSelect: () => handleShare(),
        },
        {
          id: collaborationSessionId ? 'copy-live-link' : 'start-live-session',
          label: collaborationSessionId ? 'Copy Live Session Link' : 'Start Live Session',
          description: collaborationSessionId ? 'Copy the invite link for the current collaboration room.' : 'Create a collaboration room for this editor.',
          keywords: 'live collaborate collaboration peer session room invite',
          onSelect: () => (collaborationSessionId ? handleCopyCollaborationInvite() : handleStartCollaboration()),
        },
        {
          id: 'new-file',
          label: 'New File',
          description: 'Create a new file in the project.',
          keywords: 'new file create add',
          onSelect: () => startNewFileCreation(),
        },
        {
          id: 'browse-snippets',
          label: 'Browse Snippets',
          description: 'Open the community snippets panel in the explorer.',
          keywords: 'snippets marketplace boilerplate import starter examples',
          onSelect: () => focusCommunitySnippets(),
        },
        {
          id: 'toggle-explorer',
          label: 'Toggle Explorer',
          description: showExplorerPanel ? 'Hide the explorer sidebar.' : 'Show the explorer sidebar.',
          keywords: 'toggle explorer sidebar files',
          onSelect: () => toggleExplorerVisibility(),
        },
        {
          id: 'toggle-ai-assist',
          label: 'Toggle AI Panel',
          description: showAssistPanel ? 'Close the AI assist panel.' : 'Open the AI assist panel.',
          keywords: 'toggle ai assist assistant copilot chat panel',
          onSelect: () => toggleAssistVisibility(),
        },
        ...themeCommandPaletteItems,
        ...languageCommandPaletteItems,
        {
          id: 'search-replace',
          label: 'Search and Replace',
          description: 'Open Monaco search and replace.',
          keywords: 'search replace find ctrl h',
          onSelect: () => openSearchReplace(),
        },
        {
          id: 'toggle-diff',
          label: editorViewMode === 'diff' ? 'Hide Changes' : 'View Changes',
          description: !hasChangesSinceLastSave
            ? 'No changes since the last save.'
            : canShowDiff
              ? 'Open a split diff against the saved version of the active file.'
              : changedFileCount === 1
                ? 'Open a split diff for the changed file.'
                : `Open a split diff for one of ${changedFileCount} changed files.`,
          keywords: 'diff compare changes modified saved live split last save',
          onSelect: () => toggleDiffView(),
        },
        {
          id: 'open-shortcuts',
          label: 'Keyboard Shortcuts',
          description: 'Open the shortcut cheat sheet.',
          keywords: 'keyboard shortcuts help cheat sheet',
          onSelect: () => setShowShortcutSheet(true),
        },
        ...files.map((file) => ({
          id: `open-file-${file.path}`,
          label: `Open file: ${getFileName(file.path)}`,
          description: file.path,
          keywords: `open file ${file.path.toLowerCase()} ${getFileName(file.path).toLowerCase()}`,
          onSelect: () => handleFileSelect(file.path),
        })),
        {
          id: 'switch-terminal',
          label: `Switch to ${outputPanelButtonLabel}`,
          description: `Open the ${isWebProject ? 'preview' : 'output'} panel.`,
          keywords: `switch ${isWebProject ? 'preview' : 'output'} terminal logs run`,
          onSelect: () => handlePanelTabSelect('terminal'),
        },
        {
          id: 'switch-problems',
          label: 'Switch to Errors',
          description: 'Open the errors panel.',
          keywords: 'switch problems errors diagnostics',
          onSelect: () => handlePanelTabSelect('problems'),
        },
      ];

  const normalizedCommandPaletteQuery = commandPaletteQuery.trim().toLowerCase();
  const filteredCommandPaletteItems = normalizedCommandPaletteQuery
    ? commandPaletteItems.filter((item) => {
        const searchableText = `${item.label} ${item.description ?? ''} ${item.keywords}`.toLowerCase();
        return searchableText.includes(normalizedCommandPaletteQuery);
      })
    : commandPaletteItems;

  function renderRunSnapshotComparisonCard(snapshot: RunHistorySnapshot, label: string) {
    const outputText = getRunSnapshotOutputText(snapshot);

    return (
      <article
        className="overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[var(--bg-panel)]"
        style={{ boxShadow: 'inset 0 1px 0 var(--chrome-highlight)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--border-subtle)] px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
            <div className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">{getFileName(snapshot.entryPath)}</div>
            <div className="mt-1 text-[11px] text-[var(--text-muted)]">
              {getRunSnapshotRuntimeLabel(snapshot)} | {formatRunHistoryTimestamp(snapshot.capturedAt)}
              {snapshot.durationMs !== null ? ` | ${formatExecutionTime(snapshot.durationMs)}` : ''}
            </div>
          </div>
          <span
            className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getRunSnapshotBadgeClasses(snapshot)}`}
          >
            {getRunSnapshotStatusLabel(snapshot)}
          </span>
        </div>

        {snapshot.runtime === 'preview' && snapshot.previewSrcDoc ? (
          <div className="p-4">
            <iframe
              title={`${label} preview`}
              className="h-48 w-full rounded-lg border border-[color:var(--border-subtle)] bg-white"
              sandbox="allow-scripts"
              srcDoc={snapshot.previewSrcDoc}
            />
          </div>
        ) : (
          <pre className="max-h-56 overflow-auto px-4 py-4 font-mono text-[11px] leading-6 text-[var(--text-primary)] whitespace-pre-wrap">
            {outputText}
          </pre>
        )}
      </article>
    );
  }

  function renderRunHistorySidebar(compact = false) {
    return (
      <aside
        className={`shrink-0 border-[color:var(--border-subtle)] bg-[var(--bg-panel)] ${
          compact ? 'border-b' : 'border-b lg:w-[18.5rem] lg:border-b-0 lg:border-r'
        }`}
        style={{ boxShadow: 'inset 0 1px 0 var(--chrome-highlight)' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border-subtle)] px-4 py-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
              <History className="h-3.5 w-3.5" />
              Run History
            </div>
            <div className="mt-1 text-[11px] text-[var(--text-muted)]">Every run keeps its timestamp and captured output.</div>
          </div>
          <span className="rounded-full border border-[color:var(--border-subtle)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            {runHistory.length}
          </span>
        </div>

        {runHistory.length > 0 ? (
          <div className={`overflow-auto px-3 py-3 ${compact ? 'max-h-56' : 'max-h-60 lg:h-full lg:max-h-none'}`}>
            <div className="space-y-2">
              {runHistory.map((snapshot, index) => {
                const isLatest = index === 0;
                const isActive = isLatest ? !comparisonRunSnapshot : comparisonRunSnapshot?.id === snapshot.id;
                const previewText = getRunSnapshotOutputText(snapshot);

                return (
                  <button
                    key={snapshot.id}
                    type="button"
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      isActive
                        ? 'border-[rgba(99,102,241,0.4)] bg-[rgba(99,102,241,0.12)] shadow-[0_0_0_1px_rgba(99,102,241,0.18)]'
                        : 'border-[color:var(--border-subtle)] bg-[var(--bg-panel-alt)] hover:border-[rgba(99,102,241,0.28)] hover:bg-[rgba(99,102,241,0.08)]'
                    }`}
                    onClick={() => setSelectedRunHistoryId(isLatest ? null : snapshot.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {isLatest ? 'Latest run' : 'Compare snapshot'}
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getRunSnapshotBadgeClasses(snapshot)}`}
                      >
                        {getRunSnapshotStatusLabel(snapshot)}
                      </span>
                    </div>

                    <div className="mt-2 truncate text-[13px] font-semibold text-[var(--text-primary)]">{getFileName(snapshot.entryPath)}</div>
                    <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                      {getRunSnapshotRuntimeLabel(snapshot)}
                      {snapshot.durationMs !== null ? ` | ${formatExecutionTime(snapshot.durationMs)}` : ''}
                    </div>
                    <div
                      className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[var(--text-secondary)]"
                      style={{
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden',
                      }}
                    >
                      {previewText}
                    </div>
                    <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      {formatRunHistoryTimestamp(snapshot.capturedAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 text-[12px] leading-6 text-[var(--text-muted)]">
            Run the project once and Yantra will keep a lightweight history here. Clearing the console only resets the live output.
          </div>
        )}
      </aside>
    );
  }

  function renderOutputPanel(compact = false) {
    return (
      <section
        className={`yantra-bottom-panel ${compact ? 'flex min-h-0 flex-1 flex-col' : 'relative shrink-0'}`}
        style={compact ? undefined : { height: bottomPanelHeight }}
      >
        {!compact ? (
          <div
            className="absolute inset-x-0 top-0 h-1 cursor-row-resize bg-transparent hover:bg-[rgba(99,102,241,0.35)]"
            onMouseDown={handleBottomPanelResizeStart}
          />
        ) : null}

        <div className={`flex h-full flex-col ${compact ? '' : 'pt-1'}`}>
          <div className="flex h-10 items-center justify-between border-b border-[color:var(--border-subtle)] bg-[var(--bg-terminal)] px-3">
            <div className="flex h-full items-stretch">
              {panelTabs.map((tab) => {
                const isActive = activeBottomPanelTab === tab.id;
                const TabIcon = tab.icon;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`yantra-panel-tab inline-flex items-center gap-2 px-3 ${isActive ? 'is-active' : ''}`}
                    onClick={() => handlePanelTabSelect(tab.id)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <TabIcon className="h-3.5 w-3.5" />
                      <span>{tab.label}</span>
                    </span>
                    {tab.count ? (
                      <span className="rounded-full border border-[color:var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                        {tab.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              {activeBottomPanelTab === 'terminal' && !isWebProject ? (
                <button
                  type="button"
                  className="yantra-terminal-action inline-flex items-center gap-1.5"
                  onClick={handleClearConsole}
                  disabled={!canClearConsole}
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </button>
              ) : null}
              <span className={compact ? 'block' : 'hidden md:block'}>{panelStatusLabel}</span>
              {compact ? (
                <button
                  type="button"
                  className="yantra-icon-button inline-flex h-7 w-7 items-center justify-center"
                  onClick={() => handleCompactTabSelect('code')}
                  aria-label="Return to code"
                  title="Return to code"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  className="yantra-icon-button inline-flex h-7 w-7 items-center justify-center"
                  onClick={() => setBottomPanelHeight(0)}
                  aria-label="Collapse bottom panel"
                  title="Collapse bottom panel"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {activeBottomPanelTab === 'terminal' ? (
              isWebProject ? (
                <div className={`flex h-full min-h-0 flex-col bg-[var(--bg-terminal)] ${compact ? '' : 'lg:flex-row'}`}>
                  {renderRunHistorySidebar(compact)}

                  <div className="min-h-0 flex-1 flex-col">
                    {comparisonRunSnapshot && latestRunSnapshot ? (
                      <section className="shrink-0 border-b border-[color:var(--border-subtle)] bg-[var(--bg-panel-alt)] px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
                              <Diff className="h-3.5 w-3.5" />
                              Compare Results
                            </div>
                            <div className="mt-1 text-sm text-[var(--text-primary)]">{runHistoryComparisonSummary}</div>
                          </div>
                          <button
                            type="button"
                            className="rounded-full border border-[color:var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:border-[rgba(99,102,241,0.28)] hover:text-[var(--text-primary)]"
                            onClick={() => setSelectedRunHistoryId(null)}
                          >
                            Back to latest
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 xl:grid-cols-2">
                          {renderRunSnapshotComparisonCard(latestRunSnapshot, 'Latest run')}
                          {renderRunSnapshotComparisonCard(comparisonRunSnapshot, 'Selected snapshot')}
                        </div>
                      </section>
                    ) : runHistory.length > 1 ? (
                      <div className="shrink-0 border-b border-[color:var(--border-subtle)] bg-[var(--bg-panel-alt)] px-4 py-3 text-[12px] text-[var(--text-muted)]">
                        Select an older run from history to compare it against the latest preview refresh.
                      </div>
                    ) : null}

                    <div className="min-h-0 flex-1 bg-[var(--bg-terminal)]">
                      {previewSrcDoc ? (
                        <iframe
                          title="Yantra web playground preview"
                          className="h-full w-full border-0 bg-white"
                          sandbox="allow-scripts"
                          srcDoc={previewSrcDoc}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[var(--bg-terminal)] px-6 text-[13px] text-[var(--text-muted)]">
                          Run the web playground to generate the live preview.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-col bg-[var(--bg-terminal)]">
                  <div className="shrink-0 border-b border-[color:var(--border-subtle)] px-4 py-3">
                    {isPythonProject && pythonRuntimeProgress ? (
                      <div
                        className="mb-3 overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-3"
                        style={{ boxShadow: 'inset 0 1px 0 var(--chrome-highlight)' }}
                      >
                        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                          <span>Pyodide status</span>
                          <span>{pythonRuntimeProgress.message}</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                          <div
                            className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-300"
                            style={{ width: `${pythonProgressPercent}%` }}
                          />
                        </div>
                      </div>
                    ) : null}

                    <section
                      className="overflow-hidden rounded-md border border-[color:var(--border-subtle)] bg-[var(--bg-panel)]"
                      style={{ boxShadow: 'inset 0 1px 0 var(--chrome-highlight)' }}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        onClick={() => setIsStdinExpanded((current) => !current)}
                      >
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                          <TerminalSquare className="h-4 w-4 text-[var(--accent-primary)]" />
                          Program input (stdin)
                        </span>
                        <span className="inline-flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                          {stdin.length > 0 ? stdinCharacterCountLabel : 'Optional'}
                          {isStdinExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </span>
                      </button>

                      {isStdinExpanded ? (
                        <div className="border-t border-[color:var(--border-subtle)] px-4 pb-4 pt-3">
                          <div className="mb-2 text-[11px] leading-5 text-[var(--text-muted)]">
                            Type the lines your program should read from <code>stdin</code>. Each new line is sent as the next input value.
                          </div>
                          <textarea
                            value={stdin}
                            onChange={(event) => setStdin(event.target.value)}
                            rows={3}
                            placeholder={'Example:\nAlice\n42'}
                            className="w-full resize-none rounded-md border border-[color:var(--border-subtle)] bg-[var(--bg-panel-alt)] px-3 py-3 font-mono text-sm text-[var(--text-primary)] outline-none transition focus:border-[color:var(--border-strong)]"
                          />
                          {stdin.length > 0 ? (
                            <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                              {stdinCharacterCountLabel} will be sent to stdin on the next Python run.
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </section>
                  </div>

                  <div className={`min-h-0 flex-1 ${compact ? 'flex-col' : 'lg:flex lg:flex-row'}`}>
                    {renderRunHistorySidebar(compact)}

                    <div className="min-h-0 flex-1 flex-col">
                      {comparisonRunSnapshot && latestRunSnapshot ? (
                        <section className="shrink-0 border-b border-[color:var(--border-subtle)] bg-[var(--bg-panel-alt)] px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
                                <Diff className="h-3.5 w-3.5" />
                                Compare Results
                              </div>
                              <div className="mt-1 text-sm text-[var(--text-primary)]">{runHistoryComparisonSummary}</div>
                            </div>
                            <button
                              type="button"
                              className="rounded-full border border-[color:var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:border-[rgba(99,102,241,0.28)] hover:text-[var(--text-primary)]"
                              onClick={() => setSelectedRunHistoryId(null)}
                            >
                              Back to latest
                            </button>
                          </div>

                          <div className="mt-4 grid gap-3 xl:grid-cols-2">
                            {renderRunSnapshotComparisonCard(latestRunSnapshot, 'Latest run')}
                            {renderRunSnapshotComparisonCard(comparisonRunSnapshot, 'Selected snapshot')}
                          </div>
                        </section>
                      ) : runHistory.length > 1 ? (
                        <div className="shrink-0 border-b border-[color:var(--border-subtle)] bg-[var(--bg-panel-alt)] px-4 py-3 text-[12px] text-[var(--text-muted)]">
                          Select an older run from history to compare it against the latest output.
                        </div>
                      ) : null}

                      <div className="yantra-terminal min-h-0 flex-1 overflow-auto px-4 py-3">
                        {terminalEntries.map((entry, index) => {
                          const isLastEntry = index === terminalEntries.length - 1;

                          if (entry.type === 'empty') {
                            return (
                              <div
                                key={entry.id}
                                className={`yantra-terminal-empty ${
                                  entry.tone === 'stderr' ? 'yantra-terminal-empty--stderr' : 'yantra-terminal-empty--info'
                                }`}
                              >
                                {entry.text}
                              </div>
                            );
                          }

                          if (entry.type === 'trace') {
                            const isExpanded = Boolean(expandedTraceIds[entry.id]);
                            const summaryIndex = entry.details.findIndex((detail) => detail.text.trim() === entry.summary.trim());
                            const detailLines =
                              summaryIndex >= 0
                                ? entry.details.filter((_, detailIndex) => detailIndex !== summaryIndex)
                                : entry.details;

                            return (
                              <div
                                key={entry.id}
                                className={`yantra-terminal-trace ${getTerminalToneClassName(entry.tone)}`}
                              >
                                <div className="yantra-terminal-entry">
                                  <span className="yantra-terminal-timestamp">{formatTerminalTimestamp(entry.timestamp)}</span>
                                  <span className="yantra-terminal-prefix select-none">{getTerminalPrefix(entry.tone)}</span>
                                  <button
                                    type="button"
                                    className="yantra-terminal-trace-toggle"
                                    onClick={() => toggleTraceExpansion(entry.id)}
                                    aria-expanded={isExpanded}
                                  >
                                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                                    <span className="yantra-terminal-trace-summary">{entry.summary}</span>
                                    <span className="yantra-terminal-trace-meta">
                                      {isExpanded ? 'Hide stack trace' : `Show stack trace (${entry.details.length} lines)`}
                                    </span>
                                    {isLastEntry ? <span className="yantra-editor-cursor">|</span> : null}
                                  </button>
                                </div>

                                {isExpanded && detailLines.length > 0 ? (
                                  <div className="yantra-terminal-trace-details">
                                    {detailLines.map((detail) => (
                                      <div key={detail.id} className="yantra-terminal-entry yantra-terminal-entry--detail yantra-terminal-entry--stderr">
                                        <span className="yantra-terminal-timestamp">{formatTerminalTimestamp(detail.timestamp)}</span>
                                        <span className="yantra-terminal-prefix select-none">  </span>
                                        <span className="yantra-terminal-text">{detail.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            );
                          }

                          return (
                            <div key={entry.id} className={`yantra-terminal-entry ${getTerminalToneClassName(entry.tone)}`}>
                              <span className="yantra-terminal-timestamp">{formatTerminalTimestamp(entry.timestamp)}</span>
                              <span className="yantra-terminal-prefix select-none">{getTerminalPrefix(entry.tone)}</span>
                              <span className="yantra-terminal-text">{entry.text}</span>
                              {isLastEntry ? <span className="yantra-editor-cursor">|</span> : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="h-full overflow-auto bg-[var(--bg-terminal)] py-2">
                {problemEntries.length > 0 ? (
                  problemEntries.map((problem) => (
                    <button
                      key={problem.id}
                      type="button"
                      className="yantra-problem-row flex w-full items-start gap-3 px-4 py-2.5 text-left"
                      onClick={() => handleProblemSelect(problem)}
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--red)]" />
                      <div className="min-w-0">
                        <div className="truncate text-[12px] text-[var(--text-primary)]">
                          {problem.fileName}
                          {problem.lineNumber ? `:${problem.lineNumber}` : ''}
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-[var(--text-secondary)]">
                          {problem.message}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-[12px] text-[var(--text-muted)]">No problems detected.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  useEffect(() => {
    if (!commandPaletteOpen) {
      return;
    }

    setCommandPaletteHighlightIndex((currentIndex) => {
      if (filteredCommandPaletteItems.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, filteredCommandPaletteItems.length - 1);
    });
  }, [commandPaletteOpen, filteredCommandPaletteItems.length]);

  if (workspaceStatus === 'loading') {
    return (
      <main
        className="flex min-h-[100dvh] items-center justify-center px-6"
        style={{ backgroundColor: '#04070d', color: '#e8edf8', fontFamily: 'Inter, Geist, system-ui, sans-serif' }}
      >
        <div
          className="w-full max-w-5xl overflow-hidden rounded-[2rem] border shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
          style={{ borderColor: '#192131', background: 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent), #090d14' }}
        >
          <div className="flex h-11 items-center justify-between border-b px-5" style={{ borderColor: '#192131' }}>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em]" style={{ color: '#c7d0ff' }}>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading editor workspace
            </div>
            <div className="h-2 w-24 rounded-full bg-[#192131]" />
          </div>
          <div className="grid min-h-[32rem] md:grid-cols-[220px_1fr]">
            <div className="border-r p-4" style={{ borderColor: '#192131' }}>
              <div className="h-3 w-20 rounded-full bg-[#192131]" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-9 rounded-xl bg-[#0f1520]" />
                ))}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="border-b p-4" style={{ borderColor: '#192131' }}>
                <div className="h-3 w-40 rounded-full bg-[#192131]" />
              </div>
              <div className="flex-1 p-4">
                <div className="h-full rounded-[1.5rem] bg-[#05070c] p-4">
                  <div className="space-y-3 font-mono text-[12px]">
                    {Array.from({ length: 12 }).map((_, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="h-3 w-5 rounded-full bg-[#192131]" />
                        <div className="h-3 rounded-full bg-[#0f1520]" style={{ width: `${40 + (index % 5) * 10}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (workspaceStatus === 'error') {
    return (
      <main
        className="flex min-h-[100dvh] items-center justify-center px-6"
        style={{ backgroundColor: '#04070d', color: '#e8edf8', fontFamily: 'Inter, Geist, system-ui, sans-serif' }}
      >
        <div className="w-full max-w-xl rounded-2xl border p-6 shadow-[0_28px_90px_rgba(0,0,0,0.52)]" style={{ borderColor: '#192131', background: 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent), #090d14' }}>
          <div className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: '#c7d0ff' }}>Editor unavailable</div>
          <p className="mt-4 text-sm leading-6" style={{ color: '#e8edf8' }}>{workspaceError || 'Unable to load the editor.'}</p>
          <button
            type="button"
            className="mt-6 inline-flex h-9 items-center rounded-full px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-white"
            style={{ background: 'linear-gradient(135deg, #7280f4 0%, #6270dd 100%)' }}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </main>
    );
  }

  return (
    <div
      ref={layoutRef}
      className="yantra-shell flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden selection:text-white"
      style={{ fontFamily: 'Inter, Geist, system-ui, sans-serif', ...editorThemeVariables } as CSSProperties}
    >
      <header
        className={`yantra-header flex shrink-0 ${
          isCompactLayout ? 'flex-wrap items-center gap-2 px-3 py-2' : 'h-11 items-stretch'
        }`}
      >
        <div className={`flex min-w-0 items-center gap-2 ${isCompactLayout ? 'flex-1 px-0' : 'shrink-0 px-4'}`}>
          <Link
            href="/"
            className="yantra-back-link inline-flex items-center gap-1"
            aria-label="Back to site"
            title="Back to site"
          >
            <span aria-hidden="true">←</span>
            <span className="hidden sm:inline">Back to site</span>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="yantra-brand-pill hidden sm:inline-flex">YANTRA</span>
            <span className="yantra-crumb-sep hidden sm:inline">/</span>

            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                value={projectTitle}
                onChange={(event) => setProjectTitle(event.target.value)}
                onBlur={commitTitleEdit}
                onKeyDown={(event) => {
                  const isTitleRevertShortcut =
                    (event.metaKey || event.ctrlKey) &&
                    !event.shiftKey &&
                    !event.altKey &&
                    event.key.toLowerCase() === 'z';

                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitTitleEdit();
                  }

                  if (isTitleRevertShortcut) {
                    event.preventDefault();
                    revertProjectTitleToSaved();
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    revertProjectTitleToSaved();
                  }
                }}
                className="yantra-title-input h-8 min-w-[10rem] max-w-[18rem] px-3"
                aria-label="Project title"
              />
            ) : canEditProjectTitle ? (
              <button
                type="button"
                className="yantra-title-button max-w-[18rem] truncate text-left"
                onClick={() => setIsEditingTitle(true)}
                title={titleLabel}
              >
                {titleLabel}
              </button>
            ) : (
              <span className="max-w-[18rem] truncate text-[12px] font-medium text-[var(--text-primary)]" title={titleLabel}>
                {titleLabel}
              </span>
            )}

            {activeFile ? (
              <>
                <span className="yantra-crumb-sep hidden sm:inline">/</span>
                <span
                  className="yantra-language-dot hidden sm:inline-flex h-1.5 w-1.5"
                  style={{ backgroundColor: activeFileIndicator?.color }}
                  title={getFileExtension(activeFile.path).slice(1).toUpperCase() || 'FILE'}
                />
                <span className="hidden max-w-[10rem] truncate text-[12px] font-medium text-[var(--text-primary)] sm:inline">
                  {activeFileName}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {!isCompactLayout ? (
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex h-full min-w-max items-stretch">
            {openTabs.map((file) => {
              const indicator = getEditorFileIndicator(file.path);
              const isActive = activeFile?.path === file.path;
              const isDirtyTab = dirtyFilePaths.has(file.path);

              return (
                <div
                  key={file.path}
                  className={`yantra-top-tab group flex h-8 self-center items-center gap-2 px-3.5 text-[12px] ${isActive ? 'is-active' : ''}`}
                  onClick={() => handleFileSelect(file.path)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleFileSelect(file.path);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span
                    className="yantra-language-dot h-1.5 w-1.5"
                    style={{ backgroundColor: indicator.color }}
                    title={getFileExtension(file.path).slice(1).toUpperCase() || 'FILE'}
                  />
                  <span className="max-w-[14rem] truncate">{getFileName(file.path)}</span>
                  {isDirtyTab ? <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#facc15]" /> : null}
                  <button
                    type="button"
                    className="yantra-tab-close inline-flex h-4 w-4 items-center justify-center"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCloseTab(file.path);
                    }}
                    aria-label={`Close ${getFileName(file.path)} tab`}
                    title={`Close ${getFileName(file.path)} tab`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        ) : null}

        <div
          className={`flex shrink-0 items-center gap-2 ${
            isCompactLayout
              ? 'w-full flex-wrap justify-between border-t border-[color:var(--border-subtle)] pt-2'
              : 'border-l border-[color:var(--border-subtle)] px-3'
          }`}
        >
          <div className="yantra-toolbar-cluster hidden xl:flex">
            <span
              className={`yantra-toolbar-badge inline-flex items-center gap-1.5 ${
                saveStatus === 'error'
                  ? 'text-[var(--red)]'
                  : saveStatus === 'saving'
                    ? 'text-[var(--accent-glow)]'
                    : isDirty
                      ? 'text-[var(--yellow)]'
                      : 'text-[var(--green)]'
              }`}
            >
              {saveStatus === 'error' ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : saveStatus === 'saving' ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : isDirty ? (
                <span className="inline-flex h-[6px] w-[6px] rounded-full bg-[var(--yellow)] animate-pulse" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {saveStatusLabel}
            </span>
            <span className="yantra-toolbar-badge inline-flex items-center gap-1.5">
              <span className="inline-flex h-[5px] w-[5px] rounded-full" style={{ backgroundColor: panelStatusDotColor }} />
              {panelStatusLabel}
            </span>
            {executionTimeLabel ? (
              <span className="yantra-toolbar-badge">{executionTimeLabel}</span>
            ) : null}
          </div>
          {devBypass ? (
            <div className="yantra-local-badge hidden sm:block">
              LOCAL
            </div>
          ) : null}

          {!isCompactLayout && activeFile ? (
            <label className="yantra-toolbar-cluster hidden items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--text-secondary)] md:flex">
              <Languages className="h-3.5 w-3.5 text-[var(--accent-glow)]" />
              <select
                value={activeFile.language}
                onChange={(event) => {
                  void handleLanguageChange(event.target.value as EditorFileLanguage);
                }}
                className="yantra-toolbar-select"
                aria-label="Change active file language"
                title={`Current language: ${currentLanguageLabel}`}
              >
                {LANGUAGE_OPTIONS.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="yantra-toolbar-cluster">
            <div ref={viewControlsRef} className="relative">
              <button
                type="button"
                className="yantra-icon-button inline-flex h-8 w-8 items-center justify-center"
                onClick={() => setShowViewControls((current) => !current)}
                aria-label="Open editor view controls"
                title="Editor view controls"
              >
                <Settings2 className="h-4 w-4" />
              </button>

              {showViewControls ? (
                <div
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[20rem] rounded-[1.25rem] border border-[color:var(--border-strong)] bg-[var(--bg-surface)] p-4"
                  style={{ boxShadow: 'var(--panel-shadow)' }}
                >
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Quick Settings</div>
                  <div className="mt-3 grid gap-2">
                    <button
                      type="button"
                      className="yantra-settings-row"
                      onClick={() =>
                        setEditorSettings((current) => ({
                          ...current,
                          wordWrap: current.wordWrap === 'on' ? 'off' : 'on',
                        }))
                      }
                    >
                      <span className="inline-flex items-center gap-2">
                        <WrapText className="h-3.5 w-3.5" />
                        Wrap lines
                      </span>
                      <span>{editorSettings.wordWrap === 'on' ? 'On' : 'Off'}</span>
                    </button>

                    <button
                      type="button"
                      className="yantra-settings-row"
                      onClick={() =>
                        setEditorSettings((current) => ({
                          ...current,
                          minimapEnabled: !current.minimapEnabled,
                        }))
                      }
                    >
                      <span>Minimap</span>
                      <span>{editorSettings.minimapEnabled ? 'On' : 'Off'}</span>
                    </button>

                    <div className="yantra-settings-row">
                      <span>Font size</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="yantra-icon-button inline-flex h-7 w-7 items-center justify-center"
                          onClick={() =>
                            setEditorSettings((current) => ({
                              ...current,
                              fontSize: Math.max(11, current.fontSize - 1),
                            }))
                          }
                          aria-label="Decrease font size"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[2rem] text-center">{editorSettings.fontSize}</span>
                        <button
                          type="button"
                          className="yantra-icon-button inline-flex h-7 w-7 items-center justify-center"
                          onClick={() =>
                            setEditorSettings((current) => ({
                              ...current,
                              fontSize: Math.min(22, current.fontSize + 1),
                            }))
                          }
                          aria-label="Increase font size"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Themes</div>
                  <div className="mt-3 grid gap-2">
                    {THEME_OPTIONS.map((themeOption) => (
                      <button
                        key={themeOption.value}
                        type="button"
                        className={`yantra-settings-row ${editorTheme === themeOption.value ? 'is-active' : ''}`}
                        onClick={() => setEditorTheme(themeOption.value)}
                      >
                        <span>{themeOption.label}</span>
                        <span>{themeOption.description}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      className={`yantra-settings-row ${editorViewMode === 'diff' ? 'is-active' : ''}`}
                      onClick={toggleDiffView}
                      disabled={!hasChangesSinceLastSave}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Diff className="h-3.5 w-3.5" />
                        Diff view
                      </span>
                      <span>
                        {!hasChangesSinceLastSave
                          ? 'No changes'
                          : editorViewMode === 'diff'
                            ? 'On'
                            : changedFileCount === 1
                              ? '1 file'
                              : `${changedFileCount} files`}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="yantra-settings-row"
                      onClick={() => {
                        setShowShortcutSheet(true);
                        setShowViewControls(false);
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Keyboard className="h-3.5 w-3.5" />
                        Keyboard shortcuts
                      </span>
                      <span>Open</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={`yantra-diff-button inline-flex h-8 items-center gap-2 px-3 text-[11px] font-semibold ${
                editorViewMode === 'diff' ? 'is-active' : ''
              }`}
              onClick={toggleDiffView}
              aria-label={editorViewMode === 'diff' ? 'Hide changes and return to the editor' : 'View changes since the last save'}
              aria-pressed={editorViewMode === 'diff'}
              title={
                editorViewMode === 'diff'
                  ? 'Hide changes and return to the editor'
                  : !hasChangesSinceLastSave
                  ? 'No changes since the last save'
                  : canShowDiff
                    ? 'Open a split diff against the last saved version of this file'
                    : changedFileCount === 1
                      ? 'Open a split diff for the changed file'
                      : `Open a split diff for one of ${changedFileCount} changed files`
              }
              disabled={!hasChangesSinceLastSave || creatingStarterId !== null}
            >
              <Diff className="h-4 w-4" />
              <span>View Changes</span>
              {changedFileCount > 0 ? <span className="yantra-diff-count">{changedFileCount}</span> : null}
            </button>

            <button
              type="button"
              className="yantra-icon-button inline-flex h-8 w-8 items-center justify-center"
              onClick={() => {
                void handleManualSave();
              }}
              aria-label="Save project"
              title="Save project"
              disabled={!canSaveProject || creatingStarterId !== null}
            >
              <Save className="h-4 w-4" />
            </button>

            <button
              type="button"
              className="yantra-icon-button inline-flex h-8 w-8 items-center justify-center"
              onClick={() => {
                void handleShare();
              }}
              aria-label="Share project"
              title="Share project"
              disabled={!canShareProject || creatingStarterId !== null}
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          <div className="yantra-toolbar-cluster">
            <button
              type="button"
              className={`yantra-collab-button inline-flex h-8 items-center gap-2 px-3 text-[11px] font-semibold ${
                isCollaborationActive ? 'is-active' : ''
              }`}
              onClick={handleStartCollaboration}
              disabled={creatingStarterId !== null || (!canStartCollaboration && !isCollaborationActive)}
              aria-label={isCollaborationActive ? 'Copy collaboration invite link' : 'Start live collaboration'}
              title={isCollaborationActive ? 'Copy collaboration invite link' : 'Start live collaboration'}
            >
              <Users className="h-4 w-4" />
              <span>{isCollaborationActive ? (isCompactLayout ? 'Live' : collaborationStatusLabel) : isCompactLayout ? 'Live' : 'Collaborate'}</span>
            </button>

            {isCollaborationActive ? (
              <button
                type="button"
                className="yantra-icon-button inline-flex h-8 w-8 items-center justify-center"
                onClick={() => {
                  void handleCopyCollaborationInvite();
                }}
                aria-label="Copy collaboration link"
                title="Copy collaboration link"
              >
                {collaborationInviteCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            ) : null}

            <button
              type="button"
              className={`yantra-run-button inline-flex items-center gap-2 px-4 text-[12px] font-semibold text-white ${
                isRunning ? 'yantra-run-button--running' : ''
              }`}
              onClick={() => {
                void handleRun();
              }}
              disabled={!canRunProject || isRunning || creatingStarterId !== null}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {runButtonLabel}
            </button>

            {isPythonProject && isRunning ? (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-2 rounded-full border border-[rgba(240,139,139,0.24)] bg-[rgba(68,20,26,0.6)] px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--red)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                onClick={handleStopExecution}
              >
                <Pause className="h-3.5 w-3.5 fill-current" />
                Stop
              </button>
            ) : null}
          </div>

          {!isCompactLayout ? (
            <button
              type="button"
              className={`yantra-ai-button inline-flex h-8 items-center gap-2 px-3 text-[11px] font-medium ${
                assistOpen ? 'is-active' : ''
              }`}
              onClick={toggleAssistVisibility}
              aria-label="Toggle assist panel"
              title="Toggle assist panel"
            >
              <Sparkles className="h-4 w-4" />
              <span>{assistPanelLabel}</span>
            </button>
          ) : null}
        </div>
      </header>

      {isCollaborationActive ? (
        <div className="yantra-collab-banner flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border-subtle)] px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
              <span className={`yantra-collab-status inline-flex items-center gap-2 ${collaborationConnected ? 'is-connected' : ''}`}>
                <span className="yantra-collab-dot inline-flex h-2 w-2 rounded-full" />
                {collaborationStatusLabel}
              </span>
              <span className="text-[var(--text-muted)]">{collaborationPresenceLabel}</span>
            </div>
            <div className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
              Share the live session link and Yantra will sync file edits, selections, and cursors in real time.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {collaborationParticipants.map((participant) => (
              <span
                key={participant.clientId}
                className={`yantra-collab-pill inline-flex items-center gap-2 px-3 py-1.5 text-[11px] ${participant.isSelf ? 'is-self' : ''}`}
              >
                <span
                  className="inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: participant.color }}
                />
                <span className="max-w-[8rem] truncate">{participant.name}</span>
                <span className="text-[var(--text-muted)]">
                  {participant.filePath ? getFileName(participant.filePath) : 'workspace'}
                </span>
              </span>
            ))}

            <button
              type="button"
              className="yantra-collab-inline-action inline-flex h-8 items-center gap-2 px-3 text-[11px] font-semibold"
              onClick={() => {
                void handleCopyCollaborationInvite();
              }}
            >
              {collaborationInviteCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {collaborationInviteCopied ? 'Copied' : 'Copy link'}
            </button>
            <button
              type="button"
              className="yantra-collab-inline-action inline-flex h-8 items-center gap-2 px-3 text-[11px] font-semibold"
              onClick={handleStopCollaboration}
            >
              <X className="h-3.5 w-3.5" />
              Stop
            </button>
          </div>
        </div>
      ) : null}

      {collaborationError ? (
        <div className="yantra-save-banner flex items-center justify-between gap-3 px-4 py-3" role="alert">
          <div className="flex min-w-0 items-center gap-2 text-[12px]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">{collaborationError}</span>
          </div>
          <button
            type="button"
            className="yantra-icon-button inline-flex h-8 w-8 items-center justify-center"
            onClick={() => setCollaborationError(null)}
            aria-label="Dismiss collaboration message"
            title="Dismiss collaboration message"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {showSaveErrorBanner ? (
        <div className="yantra-save-banner flex items-center justify-between gap-3 px-4 py-3" role="alert">
          <div className="flex min-w-0 items-center gap-2 text-[12px]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">{workspaceError}</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="yantra-save-banner-button inline-flex h-8 items-center px-3 text-[11px] font-semibold uppercase tracking-[0.08em]"
              onClick={() => {
                void handleManualSave();
              }}
            >
              Retry
            </button>
            <button
              type="button"
              className="yantra-icon-button inline-flex h-8 w-8 items-center justify-center"
              onClick={() => setIsSaveErrorBannerDismissed(true)}
              aria-label="Dismiss save error"
              title="Dismiss save error"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <div className={`flex min-h-0 flex-1 ${isCompactLayout ? 'flex-col' : ''}`}>
        {isCompactLayout ? (
          <div className="yantra-compact-switcher border-b border-[color:var(--border-subtle)] px-3 py-2">
            <div className="flex gap-2 overflow-x-auto">
              {compactTabItems.map((tab) => {
                const isActive = compactActiveTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`yantra-compact-tab inline-flex items-center gap-2 whitespace-nowrap px-3 py-2 text-[12px] ${
                      isActive ? 'is-active' : ''
                    }`}
                    onClick={() => handleCompactTabSelect(tab.id)}
                  >
                    <span>{tab.label}</span>
                    {tab.badge ? (
                      <span className="rounded-full border border-[color:var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                        {tab.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
        <nav className="yantra-rail flex w-[5.75rem] shrink-0 flex-col items-center justify-between px-2 py-2">
          <div className="flex w-full flex-col gap-1">
            <button
              type="button"
              className={`yantra-rail-button relative flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 px-2 py-2 ${isSidebarVisible ? 'is-active' : ''}`}
              onClick={toggleExplorerVisibility}
              aria-label="Toggle explorer"
              title="Toggle explorer"
            >
              {isSidebarVisible ? <span className="yantra-rail-indicator" /> : null}
              <Files className="h-4 w-4" />
              <span className="yantra-rail-button-label">Explorer</span>
            </button>
            <button
              type="button"
              className={`yantra-rail-button relative flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 px-2 py-2 ${
                !panelIsCollapsed && activeBottomPanelTab === 'terminal' ? 'is-active' : ''
              }`}
              onClick={() => handlePanelTabSelect('terminal')}
              aria-label={`Open ${outputPanelButtonLabel.toLowerCase()} panel`}
              title={`Open ${outputPanelButtonLabel.toLowerCase()} panel`}
            >
              {!panelIsCollapsed && activeBottomPanelTab === 'terminal' ? <span className="yantra-rail-indicator" /> : null}
              <TerminalSquare className="h-4 w-4" />
              <span className="yantra-rail-button-label">{outputPanelButtonLabel}</span>
            </button>
            <button
              type="button"
              className={`yantra-rail-button relative flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 px-2 py-2 ${assistOpen ? 'is-active' : ''}`}
              onClick={toggleAssistVisibility}
              aria-label="Toggle assist panel"
              title="Toggle assist panel"
            >
              {assistOpen ? <span className="yantra-rail-indicator" /> : null}
              <Sparkles className="h-4 w-4" />
              <span className="yantra-rail-button-label">{assistPanelLabel}</span>
            </button>
          </div>

          <button
            type="button"
            className={`yantra-rail-button relative flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1 px-2 py-2 ${
              !panelIsCollapsed && activeBottomPanelTab === 'problems' ? 'is-active' : ''
            }`}
            onClick={() => handlePanelTabSelect('problems')}
            aria-label="Open errors panel"
            title="Open errors panel"
          >
            {!panelIsCollapsed && activeBottomPanelTab === 'problems' ? <span className="yantra-rail-indicator" /> : null}
            <AlertCircle className="h-4 w-4" />
            <span className="yantra-rail-button-label">{problemsPanelLabel}</span>
          </button>
        </nav>
        )}

        {showExplorerPanel ? (
        <aside
          className={`yantra-sidebar ${isCompactLayout ? 'min-h-0 flex-1 overflow-hidden' : 'relative shrink-0 overflow-hidden'}`}
          style={isCompactLayout ? undefined : { width: sidebarWidth }}
        >
          <div className="flex h-full flex-col">
            <div className="flex h-10 items-center justify-between border-b border-[color:var(--border-subtle)] px-3.5">
              <div className="yantra-section-label">EXPLORER</div>
              <button
                type="button"
                className="yantra-icon-button inline-flex h-7 w-7 items-center justify-center"
                onClick={() => {
                  if (isCompactLayout) {
                    handleCompactTabSelect('code');
                    return;
                  }

                  setIsSidebarVisible(false);
                }}
                aria-label={isCompactLayout ? 'Return to code' : 'Hide explorer'}
                title={isCompactLayout ? 'Return to code' : 'Hide explorer'}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              <div className="border-b border-[color:var(--border-subtle)] pb-3">
                <div className="px-3 py-1">
                  <div className="yantra-section-label">OPEN EDITORS</div>
                </div>
                {openTabs.length > 0 ? (
                  openTabs.map((file) => {
                    const indicator = getEditorFileIndicator(file.path);
                    const isActive = activeFile?.path === file.path;
                    const isDirtyFile = dirtyFilePaths.has(file.path);

                    return (
                      <button
                        key={`open-${file.path}`}
                        type="button"
                        className={`yantra-file-item flex w-full items-center gap-2 text-left ${isActive ? 'is-active' : ''}`}
                        onClick={() => handleFileSelect(file.path)}
                      >
                        <span
                          className="yantra-language-dot h-[7px] w-[7px]"
                          style={{ backgroundColor: indicator.color }}
                          title={getFileExtension(file.path).slice(1).toUpperCase() || 'FILE'}
                        />
                        <span className="min-w-0 flex-1 truncate">{getFileName(file.path)}</span>
                        {isDirtyFile ? <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#facc15]" /> : null}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-2">
                    <div className="yantra-empty-note">
                      {showStarterEmptyState ? 'Choose a starter below to open your first workspace.' : 'No open editors yet.'}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="yantra-sidebar-group flex w-full items-center gap-2 px-3 py-2 text-left"
                onClick={() => setIsExplorerOpen((current) => !current)}
              >
                {isExplorerOpen ? <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" /> : <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />}
                <span className="truncate">{titleLabel}</span>
              </button>

              {isExplorerOpen ? (
                <div className="mt-1">
                  <div className="px-3 pb-2">
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="yantra-title-input h-9 w-full px-3"
                      placeholder="Search files..."
                      aria-label="Search files"
                    />
                    <div className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
                      Ctrl/Cmd+Shift+P opens the palette. Ctrl/Cmd+H opens replace.
                    </div>
                  </div>

                  {explorerInlineError ? (
                    <div className="mx-3 mb-2 rounded-md border border-[rgba(248,113,113,0.35)] bg-[rgba(127,29,29,0.24)] px-3 py-2 text-[11px] leading-5 text-[var(--red)]">
                      {explorerInlineError}
                    </div>
                  ) : null}

                  {filteredFiles.map((file) => {
                    const indicator = getEditorFileIndicator(file.path);
                    const isActive = activeFile?.path === file.path;
                    const isDirtyFile = dirtyFilePaths.has(file.path);

                    return (
                      <div
                        key={file.path}
                        className={`yantra-file-item group flex w-full items-center gap-2 text-left ${isActive ? 'is-active' : ''}`}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => handleFileSelect(file.path)}
                        >
                          <span
                            className="yantra-language-dot h-[7px] w-[7px]"
                            style={{ backgroundColor: indicator.color }}
                            title={getFileExtension(file.path).slice(1).toUpperCase() || 'FILE'}
                          />
                          <span className="min-w-0 flex-1 truncate">{getFileName(file.path)}</span>
                          {isDirtyFile ? <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#facc15]" /> : null}
                        </button>
                        <div className="flex items-center gap-1 pr-2">
                          <button
                            type="button"
                            className="yantra-icon-button inline-flex h-6 w-6 items-center justify-center text-[10px]"
                            onClick={() => startRenameFile(file.path)}
                            title="Rename file"
                            aria-label={`Rename ${getFileName(file.path)}`}
                          >
                            R
                          </button>
                          <button
                            type="button"
                            className="yantra-icon-button inline-flex h-6 w-6 items-center justify-center opacity-0 pointer-events-none transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              startDeleteFile(file.path);
                            }}
                            title="Delete file"
                            aria-label={`Delete ${getFileName(file.path)}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {pendingFileAction ? (
                    <div className="px-6 py-2">
                      {pendingFileAction.type === 'rename' ? (
                        <>
                          <input
                            ref={fileActionInputRef}
                            value={fileActionPath}
                            onChange={(event) => {
                              setFileActionPath(event.target.value);
                              setFileActionError(null);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                void confirmFileAction();
                              }

                              if (event.key === 'Escape') {
                                event.preventDefault();
                                cancelFileAction();
                              }
                            }}
                            className="yantra-title-input h-9 w-full px-3"
                            aria-label="Rename file"
                          />
                          <div className="mt-2 flex items-center gap-2">
                            <button type="button" className="yantra-new-file-button flex h-8 items-center gap-2 px-2.5" onClick={() => void confirmFileAction()}>
                              Rename
                            </button>
                            <button type="button" className="yantra-icon-button inline-flex h-8 items-center justify-center px-3" onClick={cancelFileAction}>
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-[12px] text-[var(--text-primary)]">Delete {getFileName(pendingFileAction.path)}?</div>
                          <div className="mt-2 flex items-center gap-2">
                            <button type="button" className="yantra-new-file-button flex h-8 items-center gap-2 px-2.5" onClick={() => void confirmFileAction()}>
                              Delete
                            </button>
                            <button type="button" className="yantra-icon-button inline-flex h-8 items-center justify-center px-3" onClick={cancelFileAction}>
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                      {fileActionError ? <div className="mt-2 text-[11px] leading-5 text-[var(--red)]">{fileActionError}</div> : null}
                    </div>
                  ) : null}

                  {isCreatingFile ? (
                    <div className="px-6 py-2">
                      <input
                        ref={newFileInputRef}
                        value={newFilePath}
                        onChange={(event) => {
                          setNewFilePath(event.target.value);
                          setNewFileError(null);
                        }}
                        onBlur={() => {
                          void confirmNewFileCreation();
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void confirmNewFileCreation();
                          }

                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelNewFileCreation();
                          }
                        }}
                        className="yantra-title-input h-9 w-full px-3"
                        placeholder="new-file.ts"
                        aria-label="New file name"
                      />
                      {newFileError ? (
                        <div className="mt-2 text-[11px] leading-5 text-[var(--red)]">{newFileError}</div>
                      ) : (
                        <div className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
                          Enter a filename like `utils.ts`, `notes.md`, or `style.css`.
                        </div>
                      )}
                    </div>
                  ) : null}

                  <EditorCommunitySnippetsPanel
                    activeRuntime={activeSnippetRuntime}
                    feedback={snippetFeedback}
                    importingSnippetId={importingSnippetId}
                    inputRef={snippetSearchInputRef}
                    isOpen={isSnippetLibraryOpen}
                    onImportSnippet={(snippetId) => {
                      void handleImportCommunitySnippet(snippetId);
                    }}
                    onSearchChange={setSnippetSearchQuery}
                    onToggleOpen={() => setIsSnippetLibraryOpen((current) => !current)}
                    searchQuery={snippetSearchQuery}
                    snippets={filteredCommunitySnippets}
                  />
                </div>
              ) : null}
            </div>

            <div className="border-t border-[color:var(--border-subtle)] p-1.5">
              <button
                type="button"
                className="yantra-new-file-button flex h-8 w-full items-center gap-2 px-2.5"
                onClick={startNewFileCreation}
                title={hasProject ? 'Create new file' : 'Choose a starter template first'}
                aria-label={hasProject ? 'Create new file' : 'Choose a starter template first'}
                disabled={!hasProject}
              >
                <Plus className="h-4 w-4" />
                <span>{hasProject ? 'New File' : 'Pick a Starter First'}</span>
              </button>
            </div>
          </div>

          {!isCompactLayout ? (
            <div
              className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-[rgba(99,102,241,0.35)]"
              onMouseDown={handleSidebarResizeStart}
            />
          ) : null}
        </aside>
        ) : null}

        {showEditorWorkspacePanel ? (
        <div className="flex min-w-0 flex-1">
          <div ref={editorColumnRef} className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-base)]">
            <div className="yantra-editor-crumbbar flex h-8 items-center justify-between px-4 text-[11px]">
              <div className="flex min-w-0 items-center gap-2 text-[var(--text-muted)]">
                <span>workspace</span>
                <span className="text-[var(--border-accent)]">{'>'}</span>
                <span className="truncate text-[var(--text-primary)]">{titleLabel}</span>
                {activeFile ? (
                  <>
                    <span className="text-[var(--border-accent)]">{'>'}</span>
                    {activeFileIndicator ? (
                      <span
                        className="yantra-language-dot h-1.5 w-1.5"
                        style={{ backgroundColor: activeFileIndicator.color }}
                        title={getFileExtension(activeFile.path).slice(1).toUpperCase() || 'FILE'}
                      />
                    ) : null}
                    <span className="truncate text-[var(--text-primary)]">{activeFile.path}</span>
                  </>
                ) : null}
              </div>

              <div className={`${isCompactLayout ? 'flex items-center gap-2 text-[11px] text-[var(--text-muted)]' : 'hidden items-center gap-3 text-[11px] text-[var(--text-muted)] lg:flex'}`}>
                <button
                  type="button"
                  className="hover:text-[var(--text-primary)]"
                  onClick={() => handlePanelTabSelect('terminal')}
                >
                  {isWebProject ? 'Preview' : 'Terminal'}
                </button>
                <button
                  type="button"
                  className="hover:text-[var(--text-primary)]"
                  onClick={() => handlePanelTabSelect('problems')}
                >
                  {problemEntries.length > 0
                    ? `${problemEntries.length} Problem${problemEntries.length === 1 ? '' : 's'}`
                    : 'No Problems'}
                </button>
                <span className="yantra-kind-badge">{projectKindLabel}</span>
              </div>
            </div>

            {showCompactOutputPanel ? (
              renderOutputPanel(true)
            ) : (
              <>
                {isCompactLayout && openTabs.length > 1 ? (
                  <div className="border-b border-[color:var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                    <div className="flex gap-2 overflow-x-auto">
                      {openTabs.map((file) => {
                        const indicator = getEditorFileIndicator(file.path);
                        const isActive = activeFile?.path === file.path;

                        return (
                          <button
                            key={`compact-open-${file.path}`}
                            type="button"
                            className={`yantra-compact-file-pill inline-flex items-center gap-2 whitespace-nowrap px-3 py-2 text-[12px] ${
                              isActive ? 'is-active' : ''
                            }`}
                            onClick={() => handleFileSelect(file.path)}
                          >
                            <span
                              className="yantra-language-dot h-1.5 w-1.5"
                              style={{ backgroundColor: indicator.color }}
                              title={getFileExtension(file.path).slice(1).toUpperCase() || 'FILE'}
                            />
                            <span>{getFileName(file.path)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="relative min-h-0 flex-1">
                  {showCollaborationWaitingState ? (
                    <div className="flex h-full min-h-[28rem] items-center justify-center bg-[var(--bg-base)] px-6">
                      <div className="yantra-collab-waiting-card w-full max-w-2xl rounded-[1.75rem] border border-[color:var(--border-subtle)] px-6 py-8 text-center shadow-[var(--panel-shadow)]">
                        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(129,140,248,0.28)] bg-[rgba(99,102,241,0.12)] text-[var(--accent-glow)]">
                          <Users className="h-5 w-5" />
                        </div>
                        <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                          Waiting for the live session to send its workspace
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                          Keep this tab open while the other collaborator joins. As soon as Yantra sees shared files in the room, the editor will appear automatically.
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                          <button
                            type="button"
                            className="yantra-collab-inline-action inline-flex h-10 items-center gap-2 px-4 text-[12px] font-semibold"
                            onClick={() => {
                              void handleCopyCollaborationInvite();
                            }}
                          >
                            {collaborationInviteCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {collaborationInviteCopied ? 'Invite link copied' : 'Copy invite link'}
                          </button>
                          <button
                            type="button"
                            className="yantra-collab-inline-action inline-flex h-10 items-center gap-2 px-4 text-[12px] font-semibold"
                            onClick={handleStopCollaboration}
                          >
                            <X className="h-4 w-4" />
                            Leave session
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : showStarterEmptyState ? (
                    <EditorStarterEmptyState
                      templates={starterTemplates}
                      creatingStarterId={creatingStarterId}
                      error={starterSelectionError}
                      onSelectStarter={handleSelectStarterTemplate}
                    />
                  ) : editorViewMode === 'diff' && activeFile ? (
                    <ProjectCodeDiffEditor
                      filePath={activeFile.path}
                      language={activeFile.language}
                      original={savedActiveFile?.content ?? ''}
                      modified={activeFile.content}
                      theme={editorTheme}
                      settings={editorSettings}
                    />
                  ) : (
                    <>
                      <ProjectCodeEditor
                        file={activeFile}
                        theme={editorTheme}
                        settings={editorSettings}
                        errorText={runErrorText}
                        onChange={handleFileChange}
                        onEditorReady={handleEditorReady}
                        onMonacoReady={handleMonacoReady}
                      />
                      <HoverExplain
                        editor={editorRef.current ?? mountedEditor}
                        monaco={monacoInstance}
                        file={activeOverlayFile}
                        stderr={pythonRunOutput.stderr}
                        theme={overlayTheme}
                      />
                      <InlineErrorFix
                        editor={editorRef.current ?? mountedEditor}
                        monaco={monacoInstance}
                        file={activeOverlayFile}
                        stderr={pythonRunOutput.stderr}
                        theme={overlayTheme}
                        onApplyFix={handleApplyFix}
                      />
                    </>
                  )}
                </div>

                {!isCompactLayout ? (
                  panelIsCollapsed ? (
                    <button
                      type="button"
                      className="yantra-collapsed-panel absolute bottom-3 left-3 z-10 inline-flex h-8 items-center gap-2 px-3 text-[11px] uppercase tracking-[0.08em]"
                      onClick={reopenBottomPanel}
                    >
                      {activePanelLabel}
                    </button>
                  ) : (
                    renderOutputPanel(false)
                  )
                ) : null}
              </>
            )}
          </div>
        </div>
        ) : null}

          {showAssistPanel ? (
            <aside className={`yantra-ai-panel flex ${isCompactLayout ? 'min-h-0 flex-1' : 'w-[320px] shrink-0'} flex-col`}>
              <div className="flex h-11 items-center justify-between border-b border-[color:var(--border-subtle)] px-4">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text-primary)]">Yantra Assist</div>
                  <div className="truncate text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{activeFileName}</div>
                </div>
                <button
                  type="button"
                  className="yantra-icon-button inline-flex h-7 w-7 items-center justify-center"
                  onClick={() => {
                    if (isCompactLayout) {
                      handleCompactTabSelect('code');
                      return;
                    }

                    setAssistOpen(false);
                  }}
                  aria-label={isCompactLayout ? 'Return to code' : 'Close AI assist'}
                  title={isCompactLayout ? 'Return to code' : 'Close AI assist'}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="border-b border-[color:var(--border-subtle)] px-4 py-4">
                <div className="yantra-context-card">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Context</div>
                  <div className="mt-2 truncate text-[13px] font-medium text-[var(--text-primary)]">{activeFileName}</div>
                  <div className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{assistSelectionSummary}</div>
                  <div className="mt-3 text-[12px] leading-6 text-[var(--text-secondary)]">
                    {devBypass
                      ? 'AI assist is currently unavailable while the editor is running in local mode.'
                      : `Ask for explanation, fixes, cleanup, or optimization. Use Ctrl/Cmd + Enter to send.`}
                  </div>
                </div>
              </div>

              <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
                <div className="mb-2 text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Quick prompts</div>
                <div className="grid grid-cols-2 gap-2">
                  {ASSIST_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      className="yantra-prompt-chip"
                      onClick={() => setAssistQuestion(suggestion.value)}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-[12px] leading-6">
                {assistMessages.length > 0 ? (
                  <div className="space-y-3">
                    {assistMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`yantra-assist-message ${message.role === 'assistant' ? 'is-assistant' : 'is-user'}`}
                      >
                        <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                          {message.role === 'assistant' ? 'Yantra' : 'You'}
                        </div>
                        <pre className="mt-2 whitespace-pre-wrap font-mono text-[12px] text-[var(--text-primary)]">
                          {message.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : assistLoading ? (
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Thinking through your code...
                  </div>
                ) : assistError ? (
                  <div className="rounded-xl border border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.08)] px-3 py-2 text-[var(--red)]">
                    {assistError}
                  </div>
                ) : (
                  <div className="yantra-empty-note">
                    {devBypass
                      ? 'Local mode keeps editing and execution available, but AI assist is still turned off.'
                      : 'Start with a quick prompt or ask a focused question about the active file.'}
                  </div>
                )}

                {assistError && assistMessages.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.08)] px-3 py-2 text-[var(--red)]">
                    {assistError}
                  </div>
                ) : null}

                {assistLoading ? (
                  <div className="mt-3 flex items-center gap-2 text-[var(--text-secondary)]">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Thinking through your code...
                  </div>
                ) : null}
              </div>

              <div className="border-t border-[color:var(--border-subtle)] p-4">
                {assistResponse ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="yantra-prompt-chip"
                      onClick={() => handleInsertAssistSuggestion('insert-at-cursor')}
                    >
                      Insert at cursor
                    </button>
                    <button
                      type="button"
                      className="yantra-prompt-chip"
                      onClick={() => handleInsertAssistSuggestion('replace-selection')}
                    >
                      Replace selection
                    </button>
                  </div>
                ) : null}

                <textarea
                  value={assistQuestion}
                  onChange={(event) => setAssistQuestion(event.target.value)}
                  onKeyDown={(event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void handleAssist();
                    }
                  }}
                  rows={6}
                  className="yantra-ai-input w-full resize-none px-3 py-2 text-[13px]"
                  placeholder="Ask Yantra about the active file..."
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 text-[11px] text-[var(--text-muted)]">
                    <div className="truncate">{activeFileName}</div>
                    <div className="truncate">{assistSelectionSummary}</div>
                  </div>
                  <button
                    type="button"
                    className="yantra-ai-submit inline-flex h-8 items-center justify-center px-4 text-[12px] text-white"
                    onClick={() => {
                      void handleAssist();
                    }}
                    disabled={assistLoading || !assistQuestion.trim() || !activeFile}
                  >
                    Send
                  </button>
                </div>
              </div>
            </aside>
          ) : null}
      </div>

      {!isCompactLayout ? (
      <footer className="yantra-status-bar flex shrink-0 items-center justify-between px-3">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <button
            type="button"
            className="yantra-status-link truncate"
            onClick={toggleExplorerVisibility}
          >
            {isSidebarVisible ? 'Explorer' : 'Show Explorer'}
          </button>
          <div className="truncate text-[var(--accent-glow)]">{activeFile ? activeFile.path : 'No file open'}</div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className={`yantra-status-link inline-flex items-center gap-1.5 ${
              problemEntries.length > 0 ? 'text-[var(--yellow)]' : 'text-[var(--green)]'
            }`}
            onClick={() => handlePanelTabSelect('problems')}
          >
            {problemEntries.length > 0 ? null : <span className="inline-flex h-[5px] w-[5px] rounded-full bg-[var(--green)]" />}
            {problemEntries.length > 0
              ? `${problemEntries.length} Error${problemEntries.length === 1 ? '' : 's'}`
              : 'No Errors'}
          </button>
          <button
            type="button"
            className="yantra-status-link"
            onClick={() => handlePanelTabSelect('terminal')}
          >
            {panelIsCollapsed ? `Open ${outputPanelButtonLabel}` : terminalPanelTabLabel}
          </button>
          <span className="yantra-kind-badge">{projectKindLabel}</span>
        </div>
      </footer>
      ) : null}

      <ShareModal
        open={shareModalOpen}
        isLoading={shareLoading}
        shareUrl={shareUrl}
        error={shareError}
        onClose={() => setShareModalOpen(false)}
      />

      <ShortcutCheatSheet
        open={showShortcutSheet}
        onClose={() => setShowShortcutSheet(false)}
        shortcuts={[...SHORTCUTS]}
      />

      <iframe
        ref={jsRunnerIframeRef}
        title="Yantra JavaScript runner"
        sandbox="allow-scripts"
        srcDoc={jsRunnerSrcDoc}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      {commandPaletteOpen ? (
        <div
          className="yantra-command-palette-backdrop fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[10vh]"
          onMouseDown={closeCommandPalette}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="yantra-command-palette w-full max-w-2xl overflow-hidden rounded-[24px] border"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[color:var(--border-subtle)] px-4 py-4">
              <input
                ref={commandPaletteInputRef}
                value={commandPaletteQuery}
                onChange={(event) => {
                  setCommandPaletteQuery(event.target.value);
                  setCommandPaletteHighlightIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();

                    if (filteredCommandPaletteItems.length === 0) {
                      return;
                    }

                    setCommandPaletteHighlightIndex((currentIndex) =>
                      currentIndex >= filteredCommandPaletteItems.length - 1 ? 0 : currentIndex + 1,
                    );
                    return;
                  }

                  if (event.key === 'ArrowUp') {
                    event.preventDefault();

                    if (filteredCommandPaletteItems.length === 0) {
                      return;
                    }

                    setCommandPaletteHighlightIndex((currentIndex) =>
                      currentIndex <= 0 ? filteredCommandPaletteItems.length - 1 : currentIndex - 1,
                    );
                    return;
                  }

                  if (event.key === 'Enter') {
                    event.preventDefault();
                    executeCommandPaletteItem(filteredCommandPaletteItems[commandPaletteHighlightIndex]);
                    return;
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeCommandPalette();
                  }
                }}
                className="yantra-command-palette-input w-full"
                placeholder="Type a command, theme, language, or file..."
                aria-label="Search commands"
              />
            </div>

            <div className="max-h-[24rem] overflow-y-auto py-2">
              {filteredCommandPaletteItems.length > 0 ? (
                filteredCommandPaletteItems.map((item, index) => {
                  const isActive = index === commandPaletteHighlightIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`yantra-command-item flex w-full items-start justify-between gap-4 px-4 py-3 text-left ${
                        isActive ? 'is-active' : ''
                      }`}
                      onMouseEnter={() => setCommandPaletteHighlightIndex(index)}
                      onClick={() => executeCommandPaletteItem(item)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{item.label}</div>
                        {item.description ? (
                          <div className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{item.description}</div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        {isActive ? 'Enter' : null}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-6 text-center text-[12px] text-[var(--text-muted)]">
                  No matching commands.
                </div>
              )}
            </div>

            <div className="border-t border-[color:var(--border-subtle)] px-4 py-2 text-[11px] text-[var(--text-muted)]">
              Use Arrow keys to navigate, Enter to run, Escape to close.
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes yantra-editor-cursor-blink {
          0%,
          49% {
            opacity: 1;
          }

          50%,
          100% {
            opacity: 0;
          }
        }

        @keyframes yantra-run-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 rgba(99, 102, 241, 0);
          }

          50% {
            box-shadow: 0 0 16px rgba(99, 102, 241, 0.35);
          }
        }

        .yantra-shell {
          --bg-base: #04070d;
          --bg-surface: #090d14;
          --bg-elevated: #101722;
          --bg-overlay: #141b28;
          --bg-panel: #0b1018;
          --bg-panel-alt: #0f1520;
          --bg-terminal: #05070c;
          --border-subtle: #192131;
          --border-strong: #263146;
          --border-accent: #44506b;
          --accent-primary: #7382f6;
          --accent-glow: #c7d0ff;
          --accent-soft: rgba(115, 130, 246, 0.14);
          --accent-strong: rgba(115, 130, 246, 0.28);
          --chrome-highlight: rgba(255, 255, 255, 0.04);
          --panel-shadow: 0 24px 80px rgba(0, 0, 0, 0.46);
          --text-primary: #e8edf8;
          --text-secondary: #93a0b7;
          --text-muted: #566175;
          --green: #86e0a8;
          --red: #f08b8b;
          --yellow: #f0c96a;
          background:
            radial-gradient(circle at top center, rgba(99, 102, 241, 0.08), transparent 28%),
            radial-gradient(circle at 82% 16%, rgba(148, 163, 184, 0.06), transparent 22%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.015), transparent 18%),
            var(--bg-base);
          color: var(--text-primary);
          font-family: Inter, Geist, system-ui, sans-serif;
        }

        .yantra-shell ::selection {
          background: var(--accent-strong);
          color: #ffffff;
        }

        .yantra-shell button,
        .yantra-shell a,
        .yantra-shell input,
        .yantra-shell textarea {
          transition: all 0.15s ease;
        }

        .yantra-command-palette-backdrop {
          background: rgba(3, 6, 23, 0.72);
          backdrop-filter: blur(10px);
        }

        .yantra-command-palette {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 16%),
            linear-gradient(180deg, rgba(15, 20, 31, 0.98), rgba(8, 12, 18, 0.98));
          border-color: var(--border-strong);
          box-shadow: var(--panel-shadow), inset 0 1px 0 var(--chrome-highlight);
        }

        .yantra-command-palette-input {
          background: var(--bg-base);
          border: 0;
          color: var(--text-primary);
          font-size: 14px;
          outline: none;
          padding: 2px 0;
        }

        .yantra-command-palette-input::placeholder {
          color: var(--text-muted);
        }

        .yantra-command-item {
          color: var(--text-secondary);
        }

        .yantra-command-item:hover,
        .yantra-command-item.is-active {
          background: var(--accent-soft);
          color: var(--text-primary);
        }

        .yantra-shell * {
          scrollbar-width: thin;
          scrollbar-color: var(--border-subtle) transparent;
        }

        .yantra-shell *::-webkit-scrollbar {
          width: 3px;
          height: 3px;
        }

        .yantra-shell *::-webkit-scrollbar-track {
          background: transparent;
        }

        .yantra-shell *::-webkit-scrollbar-thumb {
          background: var(--border-subtle);
          border-radius: 999px;
        }

        .yantra-shell *::-webkit-scrollbar-thumb:hover {
          background: var(--border-accent);
        }

        .yantra-header {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 60%),
            var(--bg-surface);
          border-bottom: 0.5px solid var(--border-subtle);
          box-shadow: inset 0 1px 0 var(--chrome-highlight);
        }

        .yantra-back-link {
          color: var(--text-muted);
          font-size: 11px;
          line-height: 1;
        }

        .yantra-back-link::before {
          content: '←';
        }

        .yantra-back-link span[aria-hidden='true'] {
          display: none;
        }

        .yantra-back-link:hover {
          color: var(--text-secondary);
        }

        .yantra-brand-pill {
          align-items: center;
          border: 0.5px solid rgba(115, 130, 246, 0.32);
          border-radius: 20px;
          background:
            linear-gradient(180deg, rgba(115, 130, 246, 0.14), rgba(115, 130, 246, 0.05)),
            var(--bg-panel);
          box-shadow: inset 0 1px 0 var(--chrome-highlight);
          color: var(--accent-glow);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.1em;
          padding: 5px 11px;
          text-transform: uppercase;
        }

        .yantra-crumb-sep {
          color: var(--text-muted);
          font-size: 12px;
        }

        .yantra-title-button {
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 500;
          padding: 6px 0;
        }

        .yantra-title-button:hover {
          color: var(--text-primary);
        }

        .yantra-title-input {
          background: var(--bg-panel);
          border: 0.5px solid var(--border-strong);
          border-radius: 10px;
          box-shadow: inset 0 1px 0 var(--chrome-highlight);
          color: var(--text-primary);
          font-size: 12px;
          outline: none;
        }

        .yantra-title-input::placeholder {
          color: var(--text-muted);
        }

        .yantra-language-dot {
          border-radius: 999px;
          flex: 0 0 auto;
        }

        .yantra-top-tab {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 85%),
            transparent;
          border: 0.5px solid transparent;
          border-radius: 12px;
          margin-right: 0.25rem;
          color: var(--text-muted);
        }

        .yantra-top-tab:hover {
          background: var(--bg-panel);
          border-color: var(--border-subtle);
          color: var(--text-primary);
        }

        .yantra-top-tab.is-active {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 70%),
            var(--bg-elevated);
          border-color: var(--border-strong);
          box-shadow: inset 0 1px 0 var(--chrome-highlight);
          color: var(--text-primary);
        }

        .yantra-tab-close {
          color: var(--text-muted);
          opacity: 0;
        }

        .yantra-top-tab:hover .yantra-tab-close {
          opacity: 1;
        }

        .yantra-tab-close:hover {
          color: var(--text-primary);
        }

        .yantra-toolbar-cluster {
          align-items: center;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 100%),
            var(--bg-panel);
          border: 0.5px solid var(--border-subtle);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 var(--chrome-highlight);
          display: inline-flex;
          gap: 0.375rem;
        }

        .yantra-collab-button {
          align-items: center;
          border: 0.5px solid transparent;
          border-radius: 999px;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .yantra-collab-button:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--border-subtle);
          color: var(--text-primary);
        }

        .yantra-collab-button.is-active {
          background:
            linear-gradient(180deg, rgba(52, 211, 153, 0.14), rgba(52, 211, 153, 0.05)),
            var(--bg-panel);
          border-color: rgba(52, 211, 153, 0.24);
          color: #d1fae5;
        }

        .yantra-toolbar-badge {
          align-items: center;
          background: rgba(255, 255, 255, 0.016);
          border: 0.5px solid rgba(255, 255, 255, 0.03);
          border-radius: 999px;
          color: var(--text-muted);
          display: inline-flex;
          font-size: 10px;
          letter-spacing: 0.04em;
          min-height: 28px;
          padding: 0 10px;
        }

        .yantra-save-banner {
          background: rgba(248, 113, 113, 0.08);
          border-bottom: 0.5px solid rgba(248, 113, 113, 0.24);
          color: var(--red);
        }

        .yantra-save-banner-button {
          background: rgba(248, 113, 113, 0.14);
          border: 0.5px solid rgba(248, 113, 113, 0.24);
          border-radius: 999px;
          color: var(--text-primary);
        }

        .yantra-save-banner-button:hover {
          background: rgba(248, 113, 113, 0.2);
        }

        .yantra-collab-banner {
          background:
            linear-gradient(180deg, rgba(56, 189, 248, 0.08), transparent 100%),
            rgba(7, 11, 19, 0.86);
        }

        .yantra-collab-status {
          color: var(--text-secondary);
        }

        .yantra-collab-status .yantra-collab-dot {
          background: rgba(148, 163, 184, 0.7);
          box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.08);
        }

        .yantra-collab-status.is-connected .yantra-collab-dot {
          background: #34d399;
          box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.12);
        }

        .yantra-collab-pill {
          background: rgba(255, 255, 255, 0.024);
          border: 0.5px solid var(--border-subtle);
          border-radius: 999px;
          color: var(--text-primary);
        }

        .yantra-collab-pill.is-self {
          border-color: rgba(115, 130, 246, 0.24);
          color: var(--accent-glow);
        }

        .yantra-collab-inline-action {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 100%),
            var(--bg-panel);
          border: 0.5px solid var(--border-subtle);
          border-radius: 999px;
          color: var(--text-secondary);
        }

        .yantra-collab-inline-action:hover {
          border-color: var(--border-strong);
          color: var(--text-primary);
        }

        .yantra-collab-waiting-card {
          background:
            radial-gradient(circle at top center, rgba(99, 102, 241, 0.12), transparent 38%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 100%),
            var(--bg-surface);
        }

        .yantra-local-badge {
          border: 0.5px solid var(--green);
          border-radius: 999px;
          background: rgba(17, 50, 34, 0.72);
          color: var(--green);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.08em;
          padding: 4px 9px;
        }

        .yantra-run-button {
          align-items: center;
          background: linear-gradient(135deg, #7280f4 0%, #6573e3 56%, #5664ca 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          box-shadow:
            0 12px 28px rgba(58, 70, 180, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.16);
          color: #ffffff;
          height: 30px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .yantra-run-button:hover {
          background: linear-gradient(135deg, #7a87f8 0%, #6a77e6 58%, #5965cf 100%);
          box-shadow:
            0 18px 34px rgba(58, 70, 180, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
        }

        .yantra-run-button:disabled {
          cursor: not-allowed;
          opacity: 0.9;
        }

        .yantra-run-button--running {
          animation: yantra-run-pulse 1.4s ease-in-out infinite;
        }

        .yantra-diff-button {
          align-items: center;
          border: 0.5px solid transparent;
          border-radius: 999px;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .yantra-diff-button:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--border-subtle);
          color: var(--text-primary);
        }

        .yantra-diff-button.is-active {
          background:
            linear-gradient(180deg, rgba(56, 189, 248, 0.16), rgba(56, 189, 248, 0.06)),
            var(--bg-panel);
          border-color: rgba(56, 189, 248, 0.26);
          color: #dbeafe;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .yantra-diff-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .yantra-diff-count {
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 0.5px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          display: inline-flex;
          justify-content: center;
          min-width: 1.25rem;
          padding: 0 0.375rem;
        }

        .yantra-icon-button {
          background: rgba(255, 255, 255, 0.015);
          border: 0.5px solid rgba(255, 255, 255, 0.04);
          border-radius: 999px;
          color: var(--text-secondary);
        }

        .yantra-icon-button:hover {
          background: var(--bg-panel);
          border-color: var(--border-strong);
          box-shadow: inset 0 1px 0 var(--chrome-highlight);
          color: var(--text-primary);
        }

        .yantra-icon-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .yantra-ai-button {
          background:
            linear-gradient(180deg, rgba(115, 130, 246, 0.14), rgba(115, 130, 246, 0.05)),
            var(--bg-panel);
          border: 0.5px solid rgba(115, 130, 246, 0.4);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 var(--chrome-highlight);
          color: var(--accent-glow);
        }

        .yantra-ai-button:hover,
        .yantra-ai-button.is-active {
          background:
            linear-gradient(180deg, rgba(115, 130, 246, 0.2), rgba(115, 130, 246, 0.08)),
            var(--bg-panel-alt);
          box-shadow: inset 0 0 0 1px rgba(115, 130, 246, 0.18);
        }

        .yantra-toolbar-select {
          appearance: none;
          background: transparent;
          border: 0;
          color: var(--text-primary);
          font-size: 11px;
          outline: none;
          padding-right: 0.5rem;
        }

        .yantra-toolbar-select option {
          background: var(--bg-surface);
          color: var(--text-primary);
        }

        .yantra-settings-row {
          align-items: center;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01)),
            var(--bg-panel);
          border: 0.5px solid var(--border-subtle);
          border-radius: 12px;
          box-shadow: inset 0 1px 0 var(--chrome-highlight);
          color: var(--text-secondary);
          display: flex;
          font-size: 12px;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 10px 12px;
          text-align: left;
          width: 100%;
        }

        .yantra-settings-row:hover,
        .yantra-settings-row.is-active {
          border-color: var(--border-strong);
          box-shadow:
            inset 0 1px 0 var(--chrome-highlight),
            0 0 0 1px var(--accent-soft);
          color: var(--text-primary);
        }

        .yantra-rail {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.015), transparent 16%),
            var(--bg-terminal);
          border-right: 0.5px solid var(--border-subtle);
          box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.015);
        }

        .yantra-compact-switcher {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 18%),
            var(--bg-surface);
        }

        .yantra-compact-tab,
        .yantra-compact-file-pill {
          border: 0.5px solid var(--border-subtle);
          border-radius: 999px;
          color: var(--text-secondary);
          flex-shrink: 0;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 100%),
            var(--bg-panel);
        }

        .yantra-compact-tab:hover,
        .yantra-compact-file-pill:hover {
          border-color: var(--border-strong);
          color: var(--text-primary);
        }

        .yantra-compact-tab.is-active,
        .yantra-compact-file-pill.is-active {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 80%),
            var(--accent-soft);
          border-color: rgba(115, 130, 246, 0.24);
          color: var(--text-primary);
        }

        .yantra-rail-button {
          border: 0.5px solid transparent;
          border-radius: 14px;
          color: var(--text-muted);
          text-align: center;
          transition: all 0.15s ease;
        }

        .yantra-rail-button-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          line-height: 1.1;
          text-transform: uppercase;
        }

        .yantra-rail-button:hover {
          background: var(--bg-panel);
          border-color: var(--border-subtle);
          color: var(--text-primary);
        }

        .yantra-rail-button.is-active {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 100%),
            var(--accent-soft);
          border-color: rgba(115, 130, 246, 0.24);
          color: var(--accent-glow);
        }

        .yantra-rail-indicator {
          background: var(--accent-primary);
          border-radius: 999px;
          bottom: 6px;
          left: 0;
          position: absolute;
          top: 6px;
          width: 2px;
        }

        .yantra-sidebar {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 18%),
            var(--bg-surface);
          border-right: 0.5px solid var(--border-subtle);
          box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.015);
        }

        .yantra-section-label {
          color: var(--text-muted);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .yantra-sidebar-group {
          border-radius: 12px;
          color: var(--text-secondary);
          font-size: 12px;
          margin: 0 8px;
          padding: 10px 12px;
        }

        .yantra-sidebar-group:hover {
          background: var(--bg-panel);
          color: var(--text-primary);
        }

        .yantra-file-item {
          border: 0.5px solid transparent;
          border-radius: 12px;
          color: var(--text-secondary);
          font-size: 13px;
          margin: 2px 8px;
          padding: 8px 12px;
        }

        .yantra-file-item:hover {
          background: var(--bg-panel);
          border-color: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
        }

        .yantra-file-item.is-active {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 80%),
            var(--accent-soft);
          border-color: rgba(115, 130, 246, 0.22);
          color: var(--text-primary);
          font-weight: 500;
        }

        .yantra-new-file-button {
          color: var(--text-secondary);
          font-size: 12px;
        }

        .yantra-new-file-button:hover {
          background: var(--accent-soft);
          color: var(--text-primary);
        }

        .yantra-new-file-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .yantra-empty-note {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 100%),
            var(--bg-panel);
          border: 0.5px solid var(--border-subtle);
          border-radius: 14px;
          color: var(--text-muted);
          font-size: 12px;
          line-height: 1.6;
          padding: 12px 14px;
        }

        .yantra-editor-crumbbar {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 70%),
            var(--bg-surface);
          border-bottom: 0.5px solid var(--border-subtle);
        }

        .yantra-kind-badge {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 100%),
            var(--bg-panel);
          border: 0.5px solid var(--border-strong);
          border-radius: 4px;
          color: var(--text-primary);
          display: inline-flex;
          padding: 1px 8px;
        }

        .yantra-collapsed-panel {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 100%),
            var(--bg-panel);
          border: 0.5px solid var(--border-subtle);
          border-radius: 999px;
          box-shadow: var(--panel-shadow);
          color: var(--text-secondary);
        }

        .yantra-collapsed-panel:hover {
          background: var(--bg-elevated);
          color: var(--text-primary);
        }

        .yantra-bottom-panel {
          background: var(--bg-terminal);
          border-top: 0.5px solid var(--border-subtle);
        }

        .yantra-panel-tab {
          border: 0.5px solid transparent;
          border-radius: 999px;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.06em;
          min-height: 28px;
          padding-inline: 10px;
          text-transform: uppercase;
        }

        .yantra-panel-tab:hover {
          background: var(--bg-panel);
          color: var(--text-secondary);
        }

        .yantra-panel-tab.is-active {
          background: var(--accent-soft);
          border-color: rgba(115, 130, 246, 0.2);
          color: var(--text-primary);
        }

        .yantra-terminal {
          background: var(--bg-terminal);
          display: flex;
          flex-direction: column;
          font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
          font-size: 12px;
          gap: 8px;
          line-height: 1.7;
        }

        .yantra-terminal-action {
          background: var(--bg-panel);
          border: 0.5px solid var(--border-subtle);
          border-radius: 999px;
          color: var(--text-secondary);
          padding: 6px 10px;
          transition:
            border-color 160ms ease,
            color 160ms ease,
            opacity 160ms ease;
        }

        .yantra-terminal-action:hover:not(:disabled) {
          border-color: var(--border-strong);
          color: var(--text-primary);
        }

        .yantra-terminal-action:disabled {
          cursor: not-allowed;
          opacity: 0.42;
        }

        .yantra-terminal-entry {
          align-items: start;
          display: grid;
          gap: 10px;
          grid-template-columns: auto auto minmax(0, 1fr) auto;
          padding: 6px 0;
        }

        .yantra-terminal-entry--detail {
          padding: 4px 0;
        }

        .yantra-terminal-timestamp {
          color: var(--text-muted);
          font-size: 11px;
          white-space: nowrap;
        }

        .yantra-terminal-prefix {
          color: var(--accent-primary);
          white-space: pre;
        }

        .yantra-terminal-text {
          min-width: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .yantra-terminal-entry--stdout {
          color: var(--green);
        }

        .yantra-terminal-entry--success {
          color: var(--green);
        }

        .yantra-terminal-entry--stderr {
          color: var(--red);
        }

        .yantra-terminal-entry--info {
          color: var(--text-primary);
        }

        .yantra-terminal-empty {
          align-items: center;
          color: var(--text-muted);
          display: flex;
          min-height: 100%;
          white-space: pre-wrap;
        }

        .yantra-terminal-empty--info {
          color: var(--text-muted);
        }

        .yantra-terminal-empty--stderr {
          color: var(--red);
        }

        .yantra-terminal-trace {
          background: rgba(220, 38, 38, 0.06);
          border: 0.5px solid rgba(220, 38, 38, 0.14);
          border-radius: 14px;
          padding: 2px 12px 10px;
        }

        .yantra-terminal-trace-toggle {
          align-items: start;
          background: transparent;
          border: 0;
          color: inherit;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          min-width: 0;
          padding: 0;
          text-align: left;
          width: 100%;
        }

        .yantra-terminal-trace-summary {
          flex: 1 1 180px;
          min-width: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .yantra-terminal-trace-meta {
          color: var(--text-muted);
          font-size: 11px;
          margin-left: auto;
          padding-left: 12px;
          text-align: right;
        }

        .yantra-terminal-trace-details {
          border-left: 0.5px dashed var(--border-subtle);
          margin-left: 88px;
          padding-left: 12px;
        }

        .yantra-problem-row:hover {
          background: var(--accent-soft);
        }

        .yantra-ai-panel {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 18%),
            var(--bg-surface);
          border-left: 0.5px solid var(--border-subtle);
          box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.015);
        }

        .yantra-prompt-chip {
          align-items: center;
          background: var(--bg-panel);
          border: 0.5px solid var(--border-subtle);
          border-radius: 12px;
          box-shadow: inset 0 1px 0 var(--chrome-highlight);
          color: var(--text-secondary);
          display: inline-flex;
          font-size: 11px;
          justify-content: flex-start;
          min-height: 34px;
          padding: 8px 10px;
          text-align: left;
        }

        .yantra-prompt-chip:hover {
          border-color: var(--border-strong);
          color: var(--text-primary);
        }

        .yantra-context-card {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.022), transparent 100%),
            var(--bg-panel);
          border: 0.5px solid var(--border-subtle);
          border-radius: 16px;
          box-shadow: inset 0 1px 0 var(--chrome-highlight);
          padding: 14px;
        }

        .yantra-assist-message {
          border: 0.5px solid var(--border-subtle);
          border-radius: 18px;
          padding: 12px;
        }

        .yantra-assist-message.is-assistant {
          background:
            linear-gradient(180deg, rgba(115, 130, 246, 0.12), rgba(115, 130, 246, 0.08)),
            var(--bg-panel);
          border-color: rgba(115, 130, 246, 0.24);
        }

        .yantra-assist-message.is-user {
          background: var(--bg-panel);
        }

        .yantra-ai-input {
          background: var(--bg-panel-alt);
          border: 0.5px solid var(--border-subtle);
          border-radius: 8px;
          box-shadow: inset 0 1px 0 var(--chrome-highlight);
          color: var(--text-primary);
          outline: none;
        }

        .yantra-ai-input::placeholder {
          color: var(--text-muted);
        }

        .yantra-ai-input:focus {
          border-color: var(--border-strong);
        }

        .yantra-ai-submit {
          background: linear-gradient(135deg, #7280f4 0%, #6270dd 100%);
          border-radius: 999px;
          box-shadow:
            0 10px 24px rgba(58, 70, 180, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.14);
          font-weight: 600;
        }

        .yantra-ai-submit:hover {
          background: linear-gradient(135deg, #7a87f8 0%, #6875e3 100%);
          box-shadow:
            0 14px 28px rgba(58, 70, 180, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.16);
        }

        .yantra-ai-submit:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .yantra-status-bar {
          background: var(--bg-terminal);
          border-top: 0.5px solid var(--border-subtle);
          color: var(--text-muted);
          font-size: 10px;
          height: 28px;
        }

        .yantra-status-link {
          background: transparent;
          border: 0;
          border-radius: 999px;
          color: inherit;
          min-height: 22px;
          padding: 0 8px;
        }

        .yantra-status-link:hover {
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-primary);
        }

        .yantra-editor-cursor {
          animation: yantra-editor-cursor-blink 1s steps(1) infinite;
          color: var(--accent-glow);
          display: inline-block;
          margin-left: 1px;
        }

        .yantra-shell .monaco-editor,
        .yantra-shell .monaco-editor .margin,
        .yantra-shell .monaco-editor-background {
          background-color: var(--bg-base) !important;
        }

        .yantra-shell .monaco-editor .line-numbers {
          font-feature-settings: 'tnum' 1;
        }

        .yantra-shell .monaco-editor .line-numbers.active-line-number {
          color: var(--accent-glow) !important;
        }

        .yantra-shell .monaco-editor .current-line {
          background: var(--accent-soft) !important;
          border: 0 !important;
        }

        .yantra-shell .monaco-editor .current-line-margin {
          background: var(--accent-soft) !important;
          border-left: 1px solid var(--border-accent) !important;
          box-sizing: border-box;
        }

        .yantra-shell .monaco-editor .selected-text {
          background: var(--accent-strong) !important;
        }

        .yantra-shell .monaco-editor .cursor {
          background-color: var(--accent-primary) !important;
          border-color: var(--accent-primary) !important;
        }

        .yantra-shell .monaco-editor .scroll-decoration {
          box-shadow: none !important;
        }

        @media (max-width: 1180px) {
          .yantra-command-palette {
            max-width: min(100%, 40rem);
          }
        }

        @media (max-width: 720px) {
          .yantra-shell {
            background:
              radial-gradient(circle at top center, rgba(99, 102, 241, 0.08), transparent 24%),
              radial-gradient(circle at 82% 16%, rgba(148, 163, 184, 0.05), transparent 18%),
              linear-gradient(180deg, rgba(255, 255, 255, 0.015), transparent 16%),
              var(--bg-base);
          }

          .yantra-command-palette-backdrop {
            padding-top: 8vh;
          }
        }
      `}</style>
    </div>
  );
}

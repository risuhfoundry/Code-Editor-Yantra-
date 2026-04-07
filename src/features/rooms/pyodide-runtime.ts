type PythonRunStatus = 'success' | 'error' | 'stopped';

export type PythonRunProgressStage =
  | 'downloading-runtime'
  | 'initializing-runtime'
  | 'ready'
  | 'loading-imports'
  | 'running';

export type PythonRunProgress = {
  stage: PythonRunProgressStage;
  message: string;
};

export type PythonRunResult = {
  status: PythonRunStatus;
  stdout: string;
  stderr: string;
  output: string;
  durationMs: number;
};

type PythonRunOptions = {
  onProgress?: (progress: PythonRunProgress) => void;
};

type WarmWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  onProgress?: (progress: PythonRunProgress) => void;
};

type ActiveRun = {
  runId: string;
  startedAt: number;
  resolve: (result: PythonRunResult) => void;
  onProgress?: (progress: PythonRunProgress) => void;
};

type WorkerResponse =
  | {
      type: 'progress';
      runId: string | null;
      stage: PythonRunProgressStage;
      message: string;
    }
  | {
      type: 'ready';
    }
  | {
      type: 'result';
      runId: string;
      result: unknown;
      stdout: string;
      stderr: string;
    }
  | {
      type: 'error';
      runId: string | null;
      message: string;
    };

const PYODIDE_VERSION = '0.27.4';
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`;

let runtimeWorker: Worker | null = null;
let runtimeBlobUrl: string | null = null;
let runtimeReady = false;
let activeRun: ActiveRun | null = null;
let warmWaiters: WarmWaiter[] = [];

function trimTrailingNewline(value: string) {
  return value.replace(/\n+$/g, '');
}

function buildExecutionOutput(stdout: string, stderr: string, fallbackMessage: string) {
  if (stdout && stderr) {
    return `${stdout}\n${stderr}`;
  }

  return stdout || stderr || fallbackMessage;
}

function flushWarmWaiters(
  callback: (waiter: WarmWaiter) => void,
) {
  const pending = warmWaiters;
  warmWaiters = [];

  for (const waiter of pending) {
    callback(waiter);
  }
}

function revokeRuntimeBlobUrl() {
  if (!runtimeBlobUrl) {
    return;
  }

  URL.revokeObjectURL(runtimeBlobUrl);
  runtimeBlobUrl = null;
}

function teardownWorker() {
  runtimeWorker?.terminate();
  runtimeWorker = null;
  runtimeReady = false;
  revokeRuntimeBlobUrl();
}

function getWorkerScriptSource() {
  return `
const PYODIDE_INDEX_URL = ${JSON.stringify(PYODIDE_INDEX_URL)};
const PYODIDE_SCRIPT_URL = ${JSON.stringify(PYODIDE_SCRIPT_URL)};

let pyodidePromise = null;

function post(message) {
  self.postMessage(message);
}

function trimTrailingNewline(value) {
  return value.replace(/\\n+$/g, '');
}

function createStdinHandler(stdin) {
  const normalized = String(stdin || '').replace(/\\r\\n/g, '\\n');

  if (!normalized) {
    return () => undefined;
  }

  const lines = normalized.endsWith('\\n') ? normalized.slice(0, -1).split('\\n') : normalized.split('\\n');
  let index = 0;

  return () => lines[index++] ?? undefined;
}

async function getPyodide(runId) {
  if (!pyodidePromise) {
    post({
      type: 'progress',
      runId,
      stage: 'downloading-runtime',
      message: 'Downloading Pyodide runtime...',
    });

    self.importScripts(PYODIDE_SCRIPT_URL);

    if (typeof self.loadPyodide !== 'function') {
      throw new Error('Pyodide did not initialize correctly.');
    }

    post({
      type: 'progress',
      runId,
      stage: 'initializing-runtime',
      message: 'Initializing Python runtime...',
    });

    pyodidePromise = self.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  }

  const pyodide = await pyodidePromise;
  post({ type: 'ready' });

  return pyodide;
}

self.onmessage = async (event) => {
  const message = event.data || {};

  if (message.type === 'warm') {
    try {
      await getPyodide(null);
    } catch (error) {
      post({
        type: 'error',
        runId: null,
        message: error instanceof Error ? error.message : 'Unable to warm the Python runtime.',
      });
    }

    return;
  }

  if (message.type !== 'run') {
    return;
  }

  try {
    const pyodide = await getPyodide(message.runId);
    let stdout = '';
    let stderr = '';

    pyodide.setStdout?.({
      batched: (value) => {
        stdout += value + '\\n';
      },
      raw: (value) => {
        stdout += value;
      },
    });

    pyodide.setStderr?.({
      batched: (value) => {
        stderr += value + '\\n';
      },
      raw: (value) => {
        stderr += value;
      },
    });

    pyodide.setStdin?.({
      stdin: createStdinHandler(message.stdin),
      isatty: false,
    });

    post({
      type: 'progress',
      runId: message.runId,
      stage: 'loading-imports',
      message: 'Resolving imports for this script...',
    });

    await pyodide.loadPackagesFromImports(message.code);

    post({
      type: 'progress',
      runId: message.runId,
      stage: 'running',
      message: 'Executing Python in-browser...',
    });

    const result = await pyodide.runPythonAsync(message.code);

    post({
      type: 'result',
      runId: message.runId,
      result,
      stdout: trimTrailingNewline(stdout),
      stderr: trimTrailingNewline(stderr),
    });
  } catch (error) {
    post({
      type: 'error',
      runId: message.runId,
      message: error instanceof Error ? error.message : 'Unable to run Python in the browser.',
    });
  }
};
`;
}

function finishActiveRun(result: PythonRunResult) {
  if (!activeRun) {
    return;
  }

  const currentRun = activeRun;
  activeRun = null;
  currentRun.resolve(result);
}

function handleWorkerError(error: Error, runId: string | null) {
  if (runId && activeRun?.runId === runId) {
    finishActiveRun({
      status: 'error',
      stdout: '',
      stderr: error.message,
      output: error.message,
      durationMs: Math.round(performance.now() - activeRun.startedAt),
    });
  } else {
    flushWarmWaiters((waiter) => waiter.reject(error));
  }

  teardownWorker();
}

function handleWorkerMessage(event: MessageEvent<WorkerResponse>) {
  const message = event.data;

  if (message.type === 'progress') {
    if (message.runId && activeRun?.runId === message.runId) {
      activeRun.onProgress?.({
        stage: message.stage,
        message: message.message,
      });
      return;
    }

    for (const waiter of warmWaiters) {
      waiter.onProgress?.({
        stage: message.stage,
        message: message.message,
      });
    }

    return;
  }

  if (message.type === 'ready') {
    runtimeReady = true;
    flushWarmWaiters((waiter) => {
      waiter.onProgress?.({
        stage: 'ready',
        message: 'Python runtime ready.',
      });
      waiter.resolve();
    });
    return;
  }

  if (message.type === 'result') {
    if (!activeRun || activeRun.runId !== message.runId) {
      return;
    }

    const durationMs = Math.round(performance.now() - activeRun.startedAt);
    const stdout = message.stdout;
    const stderr = message.stderr;
    const resultText =
      message.result === undefined || message.result === null || String(message.result).trim().length === 0
        ? stdout || 'Python finished without output.'
        : stdout
          ? `${stdout}\n${String(message.result)}`
          : String(message.result);

    finishActiveRun({
      status: stderr ? 'error' : 'success',
      stdout,
      stderr,
      output: stderr || resultText,
      durationMs,
    });
    return;
  }

  handleWorkerError(new Error(message.message), message.runId);
}

function getWorker() {
  if (typeof window === 'undefined') {
    throw new Error('Pyodide can only run in the browser.');
  }

  if (runtimeWorker) {
    return runtimeWorker;
  }

  runtimeBlobUrl = URL.createObjectURL(
    new Blob([getWorkerScriptSource()], {
      type: 'application/javascript',
    }),
  );

  runtimeWorker = new Worker(runtimeBlobUrl);
  runtimeWorker.onmessage = handleWorkerMessage;
  runtimeWorker.onerror = (event) => {
    handleWorkerError(new Error(event.message || 'Python runtime worker crashed.'), activeRun?.runId ?? null);
  };

  return runtimeWorker;
}

export async function warmPyodideRuntime(options: PythonRunOptions = {}) {
  if (runtimeReady) {
    options.onProgress?.({
      stage: 'ready',
      message: 'Python runtime ready.',
    });
    return;
  }

  const worker = getWorker();

  await new Promise<void>((resolve, reject) => {
    warmWaiters.push({
      resolve,
      reject,
      onProgress: options.onProgress,
    });
    worker.postMessage({ type: 'warm' });
  });
}

export async function runPythonInBrowser(
  code: string,
  stdin = '',
  options: PythonRunOptions = {},
): Promise<PythonRunResult> {
  if (activeRun) {
    return {
      status: 'error',
      stdout: '',
      stderr: 'A Python run is already in progress.',
      output: 'A Python run is already in progress.',
      durationMs: 0,
    };
  }

  const worker = getWorker();
  const runId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `py-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise<PythonRunResult>((resolve) => {
    activeRun = {
      runId,
      startedAt: performance.now(),
      resolve,
      onProgress: options.onProgress,
    };

    worker.postMessage({
      type: 'run',
      runId,
      code,
      stdin,
    });
  });
}

export function stopPythonInBrowserExecution() {
  if (!activeRun) {
    return false;
  }

  const runStartTime = activeRun.startedAt;

  teardownWorker();
  finishActiveRun({
    status: 'stopped',
    stdout: '',
    stderr: '',
    output: 'Python execution stopped.',
    durationMs: Math.round(performance.now() - runStartTime),
  });

  flushWarmWaiters((waiter) => waiter.reject(new Error('Python runtime reset.')));

  return true;
}

export function formatExecutionTime(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(durationMs >= 10000 ? 0 : 2)} s`;
}

export function appendExecutionSummary(output: string, durationMs: number) {
  const summary = `Execution time: ${formatExecutionTime(durationMs)}`;
  return output ? `${trimTrailingNewline(output)}\n\n${summary}` : summary;
}

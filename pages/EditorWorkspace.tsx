'use client';

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Play,
  Plus,
  Save,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import type { editor } from 'monaco-editor';
import ShareModal from '@/editor/components/ShareModal';
import ProjectCodeEditor from '@/editor/components/ProjectCodeEditor';
import { parseEditorExecutionErrors } from '@/editor/lib/error-utils';
import { createLocalEditorProject, getLocalEditorProject, saveLocalEditorProject } from '@/editor/lib/local-dev-projects';
import { getEditorLanguageFromPath } from '@/editor/lib/project-templates';
import { runPythonInBrowser, warmPyodideRuntime } from '@/src/features/rooms/pyodide-runtime';
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
} from '@/editor/types';

type EditorWorkspaceProps = {
  authedUser: EditorAuthedUser;
  profile: EditorAuthedProfile;
  initialProjectId?: string | null;
  initialProjectDetails?: EditorProjectDetails | null;
  devBypass?: boolean;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type WorkspaceStatus = 'loading' | 'ready' | 'error';
type PythonRunStatus = 'idle' | 'running' | 'success' | 'error';
type BottomPanelTab = 'terminal' | 'problems';
type PendingFileAction =
  | { type: 'rename'; path: string }
  | { type: 'delete'; path: string }
  | null;

type PythonRunOutput = {
  status: PythonRunStatus;
  stdout: string;
  stderr: string;
  output: string;
};

type WorkspaceFile = Pick<EditorProjectFile, 'path' | 'language' | 'content' | 'sortOrder' | 'isEntry'>;

type TerminalLine = {
  id: string;
  prefix: string;
  text: string;
  tone: 'stdout' | 'stderr' | 'info';
};

type ProblemEntry = {
  id: string;
  filePath: string;
  fileName: string;
  lineNumber: number | null;
  message: string;
};

const PYTHON_AUTOSAVE_DELAY_MS = 2000;
const DEFAULT_SIDEBAR_WIDTH = 236;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;
const DEFAULT_BOTTOM_PANEL_HEIGHT = 200;
const MIN_BOTTOM_PANEL_HEIGHT = 120;
const MIN_CENTER_COLUMN_WIDTH = 340;
const AI_PANEL_WIDTH = 320;
const ASSIST_SUGGESTIONS = [
  {
    label: 'Explain',
    value: 'Explain the active file and highlight anything important to understand before I change it.',
  },
  {
    label: 'Debug',
    value: 'Help me debug the current file using the active output and point to the most likely fix.',
  },
  {
    label: 'Refactor',
    value: 'Suggest a small refactor that improves clarity without changing behavior.',
  },
] as const;
const SUPPORTED_NEW_FILE_EXTENSIONS = ['.py', '.html', '.css', '.js', '.ts', '.tsx', '.json', '.md', '.mdx', '.txt'] as const;

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

function buildEditorTerminalLines(output: PythonRunOutput): TerminalLine[] {
  const lines: TerminalLine[] = [];

  for (const stdoutLine of output.stdout.split(/\r?\n/).filter((line) => line.length > 0)) {
    lines.push({ id: `stdout-${lines.length}`, prefix: '> ', text: stdoutLine, tone: 'stdout' });
  }

  for (const stderrLine of output.stderr.split(/\r?\n/).filter((line) => line.length > 0)) {
    lines.push({ id: `stderr-${lines.length}`, prefix: '! ', text: stderrLine, tone: 'stderr' });
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

export default function EditorWorkspace({
  authedUser,
  profile,
  initialProjectId = null,
  initialProjectDetails = null,
  devBypass = false,
}: EditorWorkspaceProps) {
  const router = useRouter();
  const initialFiles = initialProjectDetails ? toWorkspaceFiles(initialProjectDetails.files) : [];
  const initialEntryFile = initialProjectDetails ? getEntryFile(initialFiles) : null;
  const initialOutputText = initialProjectDetails
    ? initialProjectDetails.project.templateKey === 'web-playground'
      ? 'Run the web playground to refresh the live preview.'
      : 'Run your Python file to see stdout, stderr, and tracebacks here.'
    : 'Open a project and run it to see Python output here.';

  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>(initialProjectDetails ? 'ready' : 'loading');
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
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareError, setShareError] = useState<string | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const [assistQuestion, setAssistQuestion] = useState('');
  const [assistResponse, setAssistResponse] = useState('');
  const [assistError, setAssistError] = useState<string | null>(null);
  const [assistLoading, setAssistLoading] = useState(false);
  const [pythonRunOutput, setPythonRunOutput] = useState<PythonRunOutput>({
    status: 'idle',
    stdout: '',
    stderr: '',
    output: initialOutputText,
  });
  const [previewSrcDoc, setPreviewSrcDoc] = useState('');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileError, setNewFileError] = useState<string | null>(null);
  const [pendingFileAction, setPendingFileAction] = useState<PendingFileAction>(null);
  const [fileActionPath, setFileActionPath] = useState('');
  const [fileActionError, setFileActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [activeBottomPanelTab, setActiveBottomPanelTab] = useState<BottomPanelTab>('terminal');
  const [bottomPanelHeight, setBottomPanelHeight] = useState(DEFAULT_BOTTOM_PANEL_HEIGHT);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const newFileInputRef = useRef<HTMLInputElement | null>(null);
  const fileActionInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const editorColumnRef = useRef<HTMLDivElement | null>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const bottomPanelHeightRef = useRef(DEFAULT_BOTTOM_PANEL_HEIGHT);
  const sidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const lastExpandedPanelHeightRef = useRef(DEFAULT_BOTTOM_PANEL_HEIGHT);

  const activeFile = useMemo(
    () => files.find((file) => file.path === activeFilePath) ?? null,
    [activeFilePath, files],
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
  const isPythonProject = project?.templateKey === 'python-playground';
  const isWebProject = project?.templateKey === 'web-playground';
  const isTitleDirty = projectTitle.trim() !== savedProjectTitle.trim();
  const filesSnapshot = useMemo(() => serializeFiles(files), [files]);
  const savedFiles = useMemo(() => JSON.parse(savedFilesSnapshot) as WorkspaceFile[], [savedFilesSnapshot]);
  const areFilesDirty = filesSnapshot !== savedFilesSnapshot;
  const isDirty = isTitleDirty || areFilesDirty;
  const runErrorText = isPythonProject && activeFile?.path === entryFile?.path ? pythonRunOutput.stderr : '';
  const titleLabel = projectTitle.trim() || project?.title || 'Untitled Project';
  const saveStatusLabel =
    saveStatus === 'saving'
      ? 'Saving...'
      : saveStatus === 'saved'
        ? 'Saved'
        : saveStatus === 'error'
          ? 'Save failed'
          : isDirty
            ? 'Unsaved changes'
            : 'Synced';
  const panelIsCollapsed = bottomPanelHeight === 0;
  const activeFileName = activeFile ? getFileName(activeFile.path) : 'No file selected';
  const activeFileIndicator = activeFile ? getEditorFileIndicator(activeFile.path) : null;
  const projectKindLabel = isWebProject ? 'WEB PLAYGROUND' : 'PYTHON PLAYGROUND';
  const isRunning = pythonRunOutput.status === 'running';
  const runButtonLabel = isRunning ? 'RUNNING...' : 'RUN';
  const panelStatusLabel = isWebProject
    ? previewSrcDoc
      ? 'Preview live'
      : 'Preview idle'
    : pythonRunOutput.status === 'running'
      ? 'Process running'
      : pythonRunOutput.status === 'error'
        ? 'Run failed'
        : pythonRunOutput.status === 'success'
          ? 'Last run finished'
          : 'Ready';
  const panelStatusDotColor = isWebProject
    ? previewSrcDoc
      ? '#4ade80'
      : '#374151'
    : pythonRunOutput.status === 'running'
      ? '#818cf8'
      : pythonRunOutput.status === 'error'
        ? '#f87171'
        : '#4ade80';

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

  const dirtyFilePaths = useMemo(() => {
    const savedFileMap = new Map(savedFiles.map((file) => [file.path, file.content]));

    return new Set(
      files
        .filter((file) => savedFileMap.get(file.path) !== file.content)
        .map((file) => file.path),
    );
  }, [files, savedFiles]);
  const terminalLines = useMemo(() => buildEditorTerminalLines(pythonRunOutput), [pythonRunOutput]);
  const problemEntries = useMemo(() => buildProblemEntries(pythonRunOutput.stderr, entryFile), [entryFile, pythonRunOutput.stderr]);
  const panelTabs = [
    { id: 'terminal' as BottomPanelTab, label: isWebProject ? 'preview' : 'terminal' },
    { id: 'problems' as BottomPanelTab, label: 'problems', count: problemEntries.length },
  ];
  const activePanelLabel = panelTabs.find((tab) => tab.id === activeBottomPanelTab)?.label ?? 'terminal';

  const handleEditorReady = useCallback((nextEditor: editor.IStandaloneCodeEditor | null) => {
    editorRef.current = nextEditor;
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
    if (window.innerWidth < 1024) {
      setIsSidebarVisible(false);
    }
  }, []);

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
    setAssistResponse('');
    setAssistError(null);
    setShareUrl('');
    setShareError(null);
    setPreviewSrcDoc('');
    setIsCreatingFile(false);
    setNewFilePath('');
    setNewFileError(null);
    setPythonRunOutput({
      status: 'idle',
      stdout: '',
      stderr: '',
      output:
        projectDetails.project.templateKey === 'web-playground'
          ? 'Run the web playground to refresh the live preview.'
          : 'Run your Python file to see stdout, stderr, and tracebacks here.',
    });
    setWorkspaceStatus('ready');
  }, []);

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
      setWorkspaceStatus((currentStatus) => (currentStatus === 'ready' ? currentStatus : 'loading'));
      setWorkspaceError(null);

      try {
        if (devBypass) {
          if (initialProjectDetails && resolvedProjectId === initialProjectDetails.project.id) {
            saveLocalEditorProject(initialProjectDetails);
          }

          if (!resolvedProjectId) {
            const created = saveLocalEditorProject(createLocalEditorProject('python-playground', authedUser.id));

            if (!isCancelled) {
              applyProjectDetails(created);
              startTransition(() => {
                router.replace(`/editor?projectId=${created.project.id}`);
              });
            }

            return;
          }

          const localProjectDetails = getLocalEditorProject(resolvedProjectId);

          if (!localProjectDetails) {
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

        if (!resolvedProjectId) {
          const createdProjectDetails = await readJson<EditorProjectDetails>(
            await fetch('/api/editor/projects', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                templateKey: 'python-playground',
              }),
            }),
          );

          if (!isCancelled) {
            applyProjectDetails(createdProjectDetails);
            startTransition(() => {
              router.replace(`/editor?projectId=${createdProjectDetails.project.id}`);
            });
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
          setWorkspaceError(error instanceof Error ? error.message : 'Unable to load the editor workspace.');
          setWorkspaceStatus('error');
        }
      }
    }

    void loadWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [applyProjectDetails, authedUser.id, devBypass, initialProjectDetails, resolvedProjectId, router]);

  useEffect(() => {
    if (!isPythonProject) {
      return;
    }

    void warmPyodideRuntime();
  }, [isPythonProject, project?.id]);

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

  function startNewFileCreation() {
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
    setPendingFileAction({ type: 'rename', path });
    setFileActionPath(path);
    setFileActionError(null);
  }

  function startDeleteFile(path: string) {
    setPendingFileAction({ type: 'delete', path });
    setFileActionPath(path);
    setFileActionError(null);
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
      return false;
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

  async function confirmNewFileCreation() {
    const validation = validateNewFilePath(newFilePath);

    if ('error' in validation) {
      if (!newFilePath.trim()) {
        cancelNewFileCreation();
        return;
      }

      setNewFileError(validation.error);
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
    cancelNewFileCreation();
    await persistFileSet(nextFiles);
  }

  async function handleRun() {
    if (!entryFile) {
      return;
    }

    if (panelIsCollapsed) {
      reopenBottomPanel();
    }

    if (isPythonProject) {
      setPythonRunOutput({
        status: 'running',
        stdout: '',
        stderr: '',
        output: 'Executing your Python file in-browser...',
      });
      setActiveBottomPanelTab('terminal');

      const result = await runPythonInBrowser(entryFile.content);

      setPythonRunOutput({
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        output: result.output,
      });
      return;
    }

    if (isWebProject) {
      setPreviewSrcDoc(buildWebPreviewDocument(files));
      setActiveBottomPanelTab('terminal');
    }
  }

  const handleManualSave = useCallback(async () => {
    await saveProject({ includeTitle: true });
  }, [project, projectTitle, files, isTitleDirty, areFilesDirty, devBypass]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey;

      if (isModifierPressed && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleManualSave();
        return;
      }

      if (isModifierPressed && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setIsSidebarVisible(true);
        window.requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
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
  }, [handleManualSave]);

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
        setFileActionError('You need at least one file in the project.');
        return;
      }

      const nextFiles = files
        .filter((file) => file.path !== pendingFileAction.path)
        .map((file, index) => ({
          ...file,
          isEntry: file.path === pendingFileAction.path ? false : file.isEntry,
          sortOrder: index,
        }));

      if (!nextFiles.some((file) => file.isEntry) && nextFiles[0]) {
        nextFiles[0] = { ...nextFiles[0], isEntry: true };
      }

      setFiles(nextFiles);
      setOpenFilePaths((currentPaths) => currentPaths.filter((path) => path !== pendingFileAction.path));
      if (activeFilePath === pendingFileAction.path) {
        setActiveFilePath(nextFiles[0]?.path ?? null);
      }
      cancelFileAction();
      await persistFileSet(nextFiles);
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
        throw new Error('Share is unavailable in local dev mode. Sign in to create real share links.');
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
      setAssistError('AI assist is unavailable in local dev mode. Sign in to use the Yantra service-backed assistant.');
      setAssistResponse('');
      return;
    }

    const model = editorRef.current?.getModel();
    const selection = editorRef.current?.getSelection();
    const selectedText = model && selection ? model.getValueInRange(selection).trim() : '';

    setAssistLoading(true);
    setAssistError(null);
    setAssistResponse('');

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
          } satisfies EditorAssistRequest),
        }),
      );

      setAssistResponse(response.reply);
    } catch (error) {
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

  function handleFileSelect(path: string) {
    setActiveFilePath(path);
    setOpenFilePaths((currentPaths) => (currentPaths.includes(path) ? currentPaths : [...currentPaths, path]));
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

  if (workspaceStatus === 'loading') {
    return (
      <main
        className="flex h-screen items-center justify-center px-6"
        style={{ backgroundColor: '#08080f', color: '#e2e8f0', fontFamily: 'Inter, Geist, system-ui, sans-serif' }}
      >
        <div className="flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.45)]" style={{ borderColor: '#1e1e38', backgroundColor: '#0d0d18' }}>
          <LoaderCircle className="h-4 w-4 animate-spin" style={{ color: '#818cf8' }} />
          Loading editor workspace
        </div>
      </main>
    );
  }

  if (workspaceStatus === 'error') {
    return (
      <main
        className="flex h-screen items-center justify-center px-6"
        style={{ backgroundColor: '#08080f', color: '#e2e8f0', fontFamily: 'Inter, Geist, system-ui, sans-serif' }}
      >
        <div className="w-full max-w-xl rounded-2xl border p-6 shadow-[0_28px_90px_rgba(0,0,0,0.52)]" style={{ borderColor: '#1e1e38', backgroundColor: '#0d0d18' }}>
          <div className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: '#818cf8' }}>Editor unavailable</div>
          <p className="mt-4 text-sm leading-6" style={{ color: '#e2e8f0' }}>{workspaceError || 'Unable to load the editor.'}</p>
          <button
            type="button"
            className="mt-6 inline-flex h-9 items-center rounded-full px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-white"
            style={{ backgroundColor: '#4f46e5' }}
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
      className="yantra-shell flex h-screen flex-col overflow-hidden selection:text-white"
      style={{ fontFamily: 'Inter, Geist, system-ui, sans-serif' }}
    >
      <header className="yantra-header flex h-11 shrink-0 items-stretch">
        <div className="flex min-w-0 shrink-0 items-center gap-2 px-4">
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
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitTitleEdit();
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setProjectTitle(savedProjectTitle);
                    setIsEditingTitle(false);
                  }
                }}
                className="yantra-title-input h-8 min-w-[10rem] max-w-[18rem] px-3"
                aria-label="Project title"
              />
            ) : (
              <button
                type="button"
                className="yantra-title-button max-w-[18rem] truncate text-left"
                onClick={() => setIsEditingTitle(true)}
                title={titleLabel}
              >
                {titleLabel}
              </button>
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

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex h-full min-w-max items-stretch">
            {openTabs.map((file) => {
              const indicator = getEditorFileIndicator(file.path);
              const isActive = activeFile?.path === file.path;
              const isDirtyTab = dirtyFilePaths.has(file.path);

              return (
                <div
                  key={file.path}
                  className={`yantra-top-tab group flex h-full items-center gap-2 px-3.5 text-[12px] ${isActive ? 'is-active' : ''}`}
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

        <div className="flex shrink-0 items-center gap-2 border-l border-[color:var(--border-subtle)] px-3">
          <div className="hidden items-center gap-2 text-[10px] xl:flex">
            <span className="yantra-status-text">{saveStatusLabel}</span>
            <span className="yantra-divider">|</span>
            <span className="yantra-status-text inline-flex items-center gap-1.5">
              <span className="inline-flex h-[5px] w-[5px] rounded-full" style={{ backgroundColor: panelStatusDotColor }} />
              {panelStatusLabel}
            </span>
          </div>
          {devBypass ? (
            <div className="yantra-local-badge hidden sm:block">
              LOCAL
            </div>
          ) : null}

          <button
            type="button"
            className={`yantra-run-button inline-flex items-center gap-2 px-4 text-[12px] font-semibold text-white ${
              isRunning ? 'yantra-run-button--running' : ''
            }`}
            onClick={() => {
              void handleRun();
            }}
            disabled={isRunning}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {runButtonLabel}
          </button>

          <button
            type="button"
            className="yantra-icon-button inline-flex h-8 w-8 items-center justify-center"
            onClick={() => {
              void handleManualSave();
            }}
            aria-label="Save project"
            title="Save project"
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
          >
            <Share2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            className={`yantra-ai-button inline-flex h-8 items-center gap-2 px-3 text-[11px] font-medium ${
              assistOpen ? 'is-active' : ''
            }`}
            onClick={() => setAssistOpen((current) => !current)}
            aria-label="Toggle AI assist"
            title="Toggle AI assist"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden lg:block">AI</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="yantra-rail flex w-9 shrink-0 flex-col items-center justify-between py-2">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className={`yantra-rail-button relative flex h-9 w-9 items-center justify-center ${isSidebarVisible ? 'is-active' : ''}`}
              onClick={() => setIsSidebarVisible((current) => !current)}
              aria-label="Toggle explorer"
              title="Toggle explorer"
            >
              {isSidebarVisible ? <span className="yantra-rail-indicator" /> : null}
              EX
            </button>
            <button
              type="button"
              className={`yantra-rail-button relative flex h-9 w-9 items-center justify-center ${
                !panelIsCollapsed && activeBottomPanelTab === 'terminal' ? 'is-active' : ''
              }`}
              onClick={() => handlePanelTabSelect('terminal')}
              aria-label={`Open ${isWebProject ? 'preview' : 'terminal'} panel`}
              title={isWebProject ? 'Open preview panel' : 'Open terminal panel'}
            >
              {!panelIsCollapsed && activeBottomPanelTab === 'terminal' ? <span className="yantra-rail-indicator" /> : null}
              OUT
            </button>
            <button
              type="button"
              className={`yantra-rail-button relative flex h-9 w-9 items-center justify-center ${assistOpen ? 'is-active' : ''}`}
              onClick={() => setAssistOpen((current) => !current)}
              aria-label="Toggle AI assist"
              title="Toggle AI assist"
            >
              {assistOpen ? <span className="yantra-rail-indicator" /> : null}
              AI
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <button
              type="button"
              className={`yantra-rail-button relative flex h-9 w-9 items-center justify-center ${
                !panelIsCollapsed && activeBottomPanelTab === 'problems' ? 'is-active' : ''
              }`}
              onClick={() => handlePanelTabSelect('problems')}
              aria-label="Open problems panel"
              title="Open problems panel"
            >
              {!panelIsCollapsed && activeBottomPanelTab === 'problems' ? <span className="yantra-rail-indicator" /> : null}
              ERR
            </button>
            <div className="yantra-rail-label flex h-9 w-9 items-center justify-center">
              LOG
            </div>
          </div>
        </nav>

        {isSidebarVisible ? (
        <aside
          className="yantra-sidebar relative shrink-0 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          <div className="flex h-full flex-col">
            <div className="flex h-10 items-center justify-between border-b border-[color:var(--border-subtle)] px-3.5">
              <div className="yantra-section-label">EXPLORER</div>
              <button
                type="button"
                className="yantra-icon-button inline-flex h-7 w-7 items-center justify-center"
                onClick={() => setIsSidebarVisible(false)}
                aria-label="Hide explorer"
                title="Hide explorer"
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
                  <div className="px-3 py-2 text-[12px] text-[var(--text-muted)]">No open editors.</div>
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
                      Shortcuts: Cmd/Ctrl+S save, Cmd/Ctrl+P search, Cmd/Ctrl+N new file.
                    </div>
                  </div>

                  {filteredFiles.map((file) => {
                    const indicator = getEditorFileIndicator(file.path);
                    const isActive = activeFile?.path === file.path;
                    const isDirtyFile = dirtyFilePaths.has(file.path);

                    return (
                      <div
                        key={file.path}
                        className={`yantra-file-item flex w-full items-center gap-2 text-left ${isActive ? 'is-active' : ''}`}
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
                            className="yantra-icon-button inline-flex h-6 w-6 items-center justify-center text-[10px]"
                            onClick={() => startDeleteFile(file.path)}
                            title="Delete file"
                            aria-label={`Delete ${getFileName(file.path)}`}
                          >
                            D
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
                </div>
              ) : null}
            </div>

            <div className="border-t border-[color:var(--border-subtle)] p-1.5">
              <button
                type="button"
                className="yantra-new-file-button flex h-8 w-full items-center gap-2 px-2.5"
                onClick={startNewFileCreation}
                title="Create new file"
                aria-label="Create new file"
              >
                <Plus className="h-4 w-4" />
                <span>New File</span>
              </button>
            </div>
          </div>

          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-[rgba(99,102,241,0.35)]"
            onMouseDown={handleSidebarResizeStart}
          />
        </aside>
        ) : null}

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

              <div className="hidden items-center gap-3 text-[11px] text-[var(--text-muted)] lg:flex">
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

            <div className="min-h-0 flex-1">
              <ProjectCodeEditor
                file={activeFile}
                theme="dark"
                errorText={runErrorText}
                onChange={handleFileChange}
                onEditorReady={handleEditorReady}
              />
            </div>

            {panelIsCollapsed ? (
              <button
                type="button"
                className="yantra-collapsed-panel absolute bottom-3 left-3 z-10 inline-flex h-8 items-center gap-2 px-3 text-[11px] uppercase tracking-[0.08em]"
                onClick={reopenBottomPanel}
              >
                {activePanelLabel}
              </button>
            ) : (
              <section
                className="yantra-bottom-panel relative shrink-0"
                style={{ height: bottomPanelHeight }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-1 cursor-row-resize bg-transparent hover:bg-[rgba(99,102,241,0.35)]"
                  onMouseDown={handleBottomPanelResizeStart}
                />

                <div className="flex h-full flex-col pt-1">
                  <div className="flex h-10 items-center justify-between border-b border-[color:var(--border-subtle)] bg-[#060609] px-3">
                    <div className="flex h-full items-stretch">
                      {panelTabs.map((tab) => {
                        const isActive = activeBottomPanelTab === tab.id;

                        return (
                          <button
                            key={tab.id}
                            type="button"
                            className={`yantra-panel-tab inline-flex items-center gap-2 px-3 ${isActive ? 'is-active' : ''}`}
                            onClick={() => handlePanelTabSelect(tab.id)}
                          >
                            <span>{tab.label}</span>
                            {tab.count ? (
                              <span className="rounded-full border border-[color:var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                                {tab.count}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                      <span className="hidden md:block">{panelStatusLabel}</span>
                      <button
                        type="button"
                        className="yantra-icon-button inline-flex h-7 w-7 items-center justify-center"
                        onClick={() => setBottomPanelHeight(0)}
                        aria-label="Collapse bottom panel"
                        title="Collapse bottom panel"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden">
                    {activeBottomPanelTab === 'terminal' ? (
                      isWebProject ? (
                        <div className="h-full bg-[#060609]">
                          {previewSrcDoc ? (
                            <iframe
                              title="Yantra web playground preview"
                              className="h-full w-full border-0 bg-white"
                              sandbox="allow-scripts"
                              srcDoc={previewSrcDoc}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-[#060609] px-6 text-[13px] text-[var(--text-muted)]">
                              Run the web playground to generate the live preview.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="yantra-terminal h-full overflow-auto px-4 py-3">
                          {terminalLines.map((line, index) => {
                            const isLastLine = index === terminalLines.length - 1;

                            return (
                              <div
                                key={line.id}
                                className={`${
                                  line.tone === 'stderr'
                                    ? 'yantra-terminal-line--stderr'
                                    : line.tone === 'stdout'
                                      ? 'yantra-terminal-line--stdout'
                                      : 'yantra-terminal-line--info'
                                }`}
                              >
                                <span className="yantra-terminal-prefix select-none">{line.prefix}</span>
                                <span>{line.text}</span>
                                {isLastLine ? <span className="yantra-editor-cursor">|</span> : null}
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className="h-full overflow-auto bg-[#060609] py-2">
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
            )}
          </div>

          {assistOpen ? (
            <aside className="yantra-ai-panel flex w-[320px] shrink-0 flex-col">
              <div className="flex h-11 items-center justify-between border-b border-[color:var(--border-subtle)] px-4">
                <div className="text-[13px] font-medium text-[var(--text-primary)]">AI Assist</div>
                <button
                  type="button"
                  className="yantra-icon-button inline-flex h-7 w-7 items-center justify-center"
                  onClick={() => setAssistOpen(false)}
                  aria-label="Close AI assist"
                  title="Close AI assist"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="border-b border-[color:var(--border-subtle)] px-4 py-3 text-[12px] leading-6 text-[var(--text-secondary)]">
                {devBypass
                  ? 'Sign in to enable Yantra AI Assist for the active file.'
                  : `Copilot-style chat for ${activeFileName}. Use Ctrl/Cmd + Enter to send.`}
              </div>

              <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
                <div className="mb-2 text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Quick prompts</div>
                <div className="flex flex-wrap gap-2">
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
                {assistLoading ? (
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Thinking through your code...
                  </div>
                ) : assistError ? (
                  <div className="rounded-xl border border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.08)] px-3 py-2 text-[var(--red)]">
                    {assistError}
                  </div>
                ) : assistResponse ? (
                  <pre className="whitespace-pre-wrap font-mono text-[var(--text-primary)]">{assistResponse}</pre>
                ) : (
                  <div className="text-[var(--text-muted)]">
                    {devBypass
                      ? 'Sign in to ask Yantra to explain, debug, or review the active file.'
                      : 'Ask Yantra to explain code, debug errors, or review the active file.'}
                  </div>
                )}
              </div>

              <div className="border-t border-[color:var(--border-subtle)] p-4">
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
                  placeholder="Ask about the active file..."
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 text-[11px] text-[var(--text-muted)]">
                    <div className="truncate">{activeFileName}</div>
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
      </div>

      <footer className="yantra-status-bar flex shrink-0 items-center justify-between px-3">
        <div className="flex min-w-0 items-center overflow-hidden">
          <button
            type="button"
            className="truncate hover:text-[var(--text-secondary)]"
            onClick={() => setIsSidebarVisible((current) => !current)}
          >
            {isSidebarVisible ? 'Explorer' : 'Show Explorer'}
          </button>
          <span className="yantra-status-separator" />
          <div className="truncate text-[var(--accent-glow)]">{activeFile ? activeFile.path : 'No file open'}</div>
          <span className="yantra-status-separator hidden sm:inline-flex" />
          <div className="hidden sm:block">{saveStatusLabel}</div>
        </div>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 hover:text-[var(--text-secondary)] ${
              problemEntries.length > 0 ? 'text-[var(--yellow)]' : 'text-[var(--green)]'
            }`}
            onClick={() => handlePanelTabSelect('problems')}
          >
            {problemEntries.length > 0 ? null : <span className="inline-flex h-[5px] w-[5px] rounded-full bg-[var(--green)]" />}
            {problemEntries.length > 0
              ? `${problemEntries.length} Problem${problemEntries.length === 1 ? '' : 's'}`
              : 'No Problems'}
          </button>
          <span className="yantra-status-separator" />
          <button
            type="button"
            className="hover:text-[var(--text-secondary)]"
            onClick={() => handlePanelTabSelect('terminal')}
          >
            {panelIsCollapsed ? 'Open Panel' : isWebProject ? 'Preview' : 'Terminal'}
          </button>
          <span className="yantra-status-separator" />
          <span className="yantra-kind-badge">{projectKindLabel}</span>
        </div>
      </footer>

      <ShareModal
        open={shareModalOpen}
        isLoading={shareLoading}
        shareUrl={shareUrl}
        error={shareError}
        onClose={() => setShareModalOpen(false)}
      />

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
          --bg-base: #08080f;
          --bg-surface: #0d0d18;
          --bg-elevated: #11112a;
          --bg-overlay: #1a1a35;
          --border-subtle: #1e1e38;
          --border-accent: #6366f1;
          --accent-primary: #6366f1;
          --accent-glow: #818cf8;
          --text-primary: #e2e8f0;
          --text-secondary: #6b7280;
          --text-muted: #374151;
          --green: #4ade80;
          --red: #f87171;
          --yellow: #facc15;
          background: var(--bg-base);
          color: var(--text-primary);
          font-family: Inter, Geist, system-ui, sans-serif;
        }

        .yantra-shell ::selection {
          background: rgba(99, 102, 241, 0.2);
          color: #ffffff;
        }

        .yantra-shell button,
        .yantra-shell a,
        .yantra-shell input,
        .yantra-shell textarea {
          transition: all 0.15s ease;
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
          background: var(--bg-surface);
          border-bottom: 0.5px solid var(--border-subtle);
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
          border: 0.5px solid var(--accent-primary);
          border-radius: 20px;
          background: #1a1a35;
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
          background: var(--bg-base);
          border: 0.5px solid var(--accent-primary);
          border-radius: 10px;
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
          border-bottom: 2px solid transparent;
          border-right: 0.5px solid var(--border-subtle);
          border-top: 1px solid transparent;
          color: var(--text-muted);
        }

        .yantra-top-tab:hover {
          background: #0d0d20;
          border-top-color: var(--border-subtle);
          color: var(--text-primary);
        }

        .yantra-top-tab.is-active {
          background: var(--bg-elevated);
          border-bottom-color: var(--accent-primary);
          color: var(--accent-glow);
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

        .yantra-status-text,
        .yantra-divider {
          color: var(--text-muted);
        }

        .yantra-local-badge {
          border: 0.5px solid var(--green);
          border-radius: 999px;
          background: #0a1a0a;
          color: var(--green);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.08em;
          padding: 4px 9px;
        }

        .yantra-run-button {
          align-items: center;
          background: #4f46e5;
          border-radius: 999px;
          color: #ffffff;
          height: 30px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .yantra-run-button:hover {
          background: #4338ca;
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.35);
        }

        .yantra-run-button:disabled {
          cursor: not-allowed;
          opacity: 0.9;
        }

        .yantra-run-button--running {
          animation: yantra-run-pulse 1.4s ease-in-out infinite;
        }

        .yantra-icon-button {
          background: transparent;
          border: 0.5px solid transparent;
          border-radius: 8px;
          color: var(--text-secondary);
        }

        .yantra-icon-button:hover {
          background: var(--bg-elevated);
          border-color: var(--border-subtle);
          color: var(--text-primary);
        }

        .yantra-ai-button {
          background: #1a0a3a;
          border: 0.5px solid var(--accent-primary);
          border-radius: 6px;
          color: var(--accent-glow);
        }

        .yantra-ai-button:hover,
        .yantra-ai-button.is-active {
          background: #251550;
          box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.18);
        }

        .yantra-rail {
          background: var(--bg-base);
          border-right: 0.5px solid var(--border-subtle);
        }

        .yantra-rail-button,
        .yantra-rail-label {
          color: var(--text-muted);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.08em;
        }

        .yantra-rail-button:hover {
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-secondary);
        }

        .yantra-rail-button.is-active {
          background: rgba(99, 102, 241, 0.04);
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
          background: var(--bg-surface);
          border-right: 0.5px solid var(--border-subtle);
        }

        .yantra-section-label {
          color: var(--text-muted);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .yantra-sidebar-group {
          color: var(--text-secondary);
          font-size: 12px;
        }

        .yantra-sidebar-group:hover {
          background: #0d0d1e;
          color: var(--text-primary);
        }

        .yantra-file-item {
          border-left: 2px solid transparent;
          color: var(--text-secondary);
          font-size: 13px;
          padding: 5px 12px;
        }

        .yantra-file-item:hover {
          background: #0d0d1e;
          color: var(--text-primary);
        }

        .yantra-file-item.is-active {
          background: var(--bg-elevated);
          border-left-color: var(--accent-primary);
          color: var(--accent-glow);
          font-weight: 500;
        }

        .yantra-new-file-button {
          color: var(--text-secondary);
          font-size: 12px;
        }

        .yantra-new-file-button:hover {
          background: rgba(99, 102, 241, 0.04);
          color: var(--accent-glow);
        }

        .yantra-editor-crumbbar {
          background: var(--bg-surface);
          border-bottom: 0.5px solid var(--border-subtle);
        }

        .yantra-kind-badge {
          background: #1a1a35;
          border: 0.5px solid var(--border-accent);
          border-radius: 4px;
          color: var(--accent-glow);
          display: inline-flex;
          padding: 1px 8px;
        }

        .yantra-collapsed-panel {
          background: var(--bg-surface);
          border: 0.5px solid var(--border-subtle);
          border-radius: 999px;
          color: var(--text-secondary);
        }

        .yantra-collapsed-panel:hover {
          background: var(--bg-elevated);
          color: var(--text-primary);
        }

        .yantra-bottom-panel {
          background: #060609;
          border-top: 0.5px solid var(--border-subtle);
        }

        .yantra-panel-tab {
          border-bottom: 1.5px solid transparent;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .yantra-panel-tab:hover {
          color: var(--text-secondary);
        }

        .yantra-panel-tab.is-active {
          border-bottom-color: var(--accent-primary);
          color: var(--accent-glow);
        }

        .yantra-terminal {
          background: #060609;
          font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
          font-size: 12px;
          line-height: 1.7;
        }

        .yantra-terminal-prefix {
          color: var(--accent-primary);
        }

        .yantra-terminal-line--stdout {
          color: var(--green);
        }

        .yantra-terminal-line--stderr {
          color: var(--red);
        }

        .yantra-terminal-line--info {
          color: var(--text-primary);
        }

        .yantra-problem-row:hover {
          background: rgba(99, 102, 241, 0.06);
        }

        .yantra-ai-panel {
          background: var(--bg-surface);
          border-left: 0.5px solid var(--border-subtle);
        }

        .yantra-prompt-chip {
          background: var(--bg-base);
          border: 0.5px solid var(--border-subtle);
          border-radius: 999px;
          color: var(--text-secondary);
          font-size: 11px;
          padding: 6px 10px;
        }

        .yantra-prompt-chip:hover {
          border-color: var(--accent-primary);
          color: var(--accent-glow);
        }

        .yantra-ai-input {
          background: var(--bg-base);
          border: 0.5px solid var(--border-subtle);
          border-radius: 8px;
          color: var(--text-primary);
          outline: none;
        }

        .yantra-ai-input::placeholder {
          color: var(--text-muted);
        }

        .yantra-ai-input:focus {
          border-color: var(--accent-primary);
        }

        .yantra-ai-submit {
          background: var(--accent-primary);
          border-radius: 999px;
          font-weight: 600;
        }

        .yantra-ai-submit:hover {
          background: #4f46e5;
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.25);
        }

        .yantra-ai-submit:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .yantra-status-bar {
          background: #050509;
          border-top: 0.5px solid var(--border-subtle);
          color: var(--text-muted);
          font-size: 10px;
          height: 22px;
        }

        .yantra-status-separator {
          background: var(--border-subtle);
          display: inline-flex;
          height: 10px;
          margin: 0 10px;
          width: 1px;
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
          background: rgba(99, 102, 241, 0.06) !important;
          border: 0 !important;
        }

        .yantra-shell .monaco-editor .current-line-margin {
          background: rgba(99, 102, 241, 0.06) !important;
          border-left: 1px solid var(--accent-primary) !important;
          box-sizing: border-box;
        }

        .yantra-shell .monaco-editor .selected-text {
          background: rgba(99, 102, 241, 0.2) !important;
        }

        .yantra-shell .monaco-editor .cursor {
          background-color: var(--accent-primary) !important;
          border-color: var(--accent-primary) !important;
        }

        .yantra-shell .monaco-editor .scroll-decoration {
          box-shadow: none !important;
        }
      `}</style>
    </div>
  );
}

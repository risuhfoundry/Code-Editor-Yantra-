import type {
  EditorPrimaryLanguage,
  EditorProjectDetails,
  EditorProjectFile,
  EditorProjectFileInput,
  EditorProjectSummary,
  EditorTemplateKey,
} from '@/editor/types';

export type EditorProjectExportSnapshot = {
  version: 1;
  exportedAt: string;
  project: {
    title: string;
    templateKey: EditorTemplateKey;
    primaryLanguage: EditorPrimaryLanguage;
  };
  files: EditorProjectFileInput[];
};

type SnapshotProjectSource = Pick<EditorProjectSummary, 'title' | 'templateKey' | 'primaryLanguage'>;
type SnapshotUrlTarget = 'share' | 'embed';

const LOCAL_SNAPSHOT_SHARE_PATH = '/editor/share/local';
const LOCAL_SNAPSHOT_EMBED_PATH = '/embed/local';

function base64UrlEncode(value: string) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  const utf8Value = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_match, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );

  return btoa(utf8Value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedValue = normalizedValue.padEnd(Math.ceil(normalizedValue.length / 4) * 4, '=');

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(paddedValue, 'base64').toString('utf8');
  }

  const binaryValue = atob(paddedValue);
  const percentEncoded = Array.from(binaryValue, (character) =>
    `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`,
  ).join('');

  return decodeURIComponent(percentEncoded);
}

function isEditorProjectExportSnapshot(value: unknown): value is EditorProjectExportSnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const snapshot = value as Partial<EditorProjectExportSnapshot>;

  return (
    snapshot.version === 1 &&
    typeof snapshot.exportedAt === 'string' &&
    !!snapshot.project &&
    typeof snapshot.project.title === 'string' &&
    typeof snapshot.project.templateKey === 'string' &&
    typeof snapshot.project.primaryLanguage === 'string' &&
    Array.isArray(snapshot.files) &&
    snapshot.files.every(
      (file) =>
        !!file &&
        typeof file.path === 'string' &&
        typeof file.language === 'string' &&
        typeof file.content === 'string' &&
        typeof file.sortOrder === 'number' &&
        typeof file.isEntry === 'boolean',
    )
  );
}

function toSnapshotHash(encodedSnapshot: string) {
  return `payload=${encodedSnapshot}`;
}

function createSyntheticProjectId(encodedSnapshot: string) {
  return `snapshot-${encodedSnapshot.slice(0, 18) || 'project'}`;
}

export function sanitizeProjectExportName(value: string) {
  const sanitizedValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return sanitizedValue || 'yantra-project';
}

export function createEditorProjectExportSnapshot({
  project,
  files,
  title,
  exportedAt = new Date().toISOString(),
}: {
  project: SnapshotProjectSource;
  files: EditorProjectFileInput[];
  title?: string;
  exportedAt?: string;
}): EditorProjectExportSnapshot {
  return {
    version: 1,
    exportedAt,
    project: {
      title: title?.trim() || project.title,
      templateKey: project.templateKey,
      primaryLanguage: project.primaryLanguage,
    },
    files: files.map((file) => ({
      path: file.path,
      language: file.language,
      content: file.content,
      sortOrder: file.sortOrder,
      isEntry: file.isEntry,
    })),
  };
}

export function encodeEditorProjectExportSnapshot(snapshot: EditorProjectExportSnapshot) {
  return base64UrlEncode(JSON.stringify(snapshot));
}

export function decodeEditorProjectExportSnapshot(encodedSnapshot: string) {
  const decodedValue = base64UrlDecode(encodedSnapshot);
  const parsedValue = JSON.parse(decodedValue) as unknown;

  if (!isEditorProjectExportSnapshot(parsedValue)) {
    throw new Error('This export payload is invalid or no longer supported.');
  }

  return parsedValue;
}

export function extractEncodedSnapshotFromHash(hashValue: string) {
  const normalizedHash = hashValue.replace(/^#/, '');
  const params = new URLSearchParams(normalizedHash);
  const encodedSnapshot = params.get('payload');

  if (!encodedSnapshot) {
    throw new Error('The export link is missing its project snapshot.');
  }

  return encodedSnapshot;
}

export function buildLocalSnapshotUrl({
  encodedSnapshot,
  origin,
  target,
}: {
  encodedSnapshot: string;
  origin: string;
  target: SnapshotUrlTarget;
}) {
  const pathname = target === 'embed' ? LOCAL_SNAPSHOT_EMBED_PATH : LOCAL_SNAPSHOT_SHARE_PATH;
  return `${origin}${pathname}#${toSnapshotHash(encodedSnapshot)}`;
}

export function buildLocalSnapshotUrls({
  origin,
  snapshot,
}: {
  origin: string;
  snapshot: EditorProjectExportSnapshot;
}) {
  const encodedSnapshot = encodeEditorProjectExportSnapshot(snapshot);

  return {
    encodedSnapshot,
    shareUrl: buildLocalSnapshotUrl({
      origin,
      target: 'share',
      encodedSnapshot,
    }),
    embedUrl: buildLocalSnapshotUrl({
      origin,
      target: 'embed',
      encodedSnapshot,
    }),
  };
}

export function buildEditorProjectDetailsFromSnapshot(encodedSnapshot: string): EditorProjectDetails {
  const snapshot = decodeEditorProjectExportSnapshot(encodedSnapshot);
  const projectId = createSyntheticProjectId(encodedSnapshot);
  const timestamp = snapshot.exportedAt;

  return {
    project: {
      id: projectId,
      userId: 'shared-snapshot',
      title: snapshot.project.title,
      templateKey: snapshot.project.templateKey,
      primaryLanguage: snapshot.project.primaryLanguage,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    files: snapshot.files.map(
      (file, index): EditorProjectFile => ({
        id: `snapshot-file-${index}-${sanitizeProjectExportName(file.path)}`,
        projectId,
        path: file.path,
        language: file.language,
        content: file.content,
        sortOrder: file.sortOrder,
        isEntry: file.isEntry,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ),
  };
}

export function buildProjectArchiveFileName(projectTitle: string) {
  return `${sanitizeProjectExportName(projectTitle)}.zip`;
}

export function buildProjectArchiveFolderName(projectTitle: string) {
  return sanitizeProjectExportName(projectTitle);
}

export function buildEmbedCode(embedUrl: string, projectTitle: string) {
  const safeTitle = projectTitle.trim() || 'Yantra Project';

  return [
    `<iframe`,
    `  src="${embedUrl}"`,
    `  title="${safeTitle}"`,
    `  width="100%"`,
    `  height="520"`,
    `  loading="lazy"`,
    `  style="border:0;border-radius:20px;overflow:hidden;background:#05050b;"`,
    `></iframe>`,
  ].join('\n');
}

import * as Y from 'yjs';
import type { EditorProjectFileInput } from '@/editor/types';

const COLLABORATION_ROOM_PREFIX = 'yantra-live';
const FILES_MAP_KEY = 'files';
const META_MAP_KEY = 'meta';

const COLLABORATOR_NAME_PREFIXES = [
  'Aurora',
  'Beacon',
  'Comet',
  'Drift',
  'Ember',
  'Flux',
  'Harbor',
  'Indigo',
  'Juno',
  'Kite',
  'Lumen',
  'Nova',
] as const;

const COLLABORATOR_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f472b6', '#818cf8', '#fb7185'] as const;

export type CollaborationIdentity = {
  color: string;
  name: string;
};

export type CollaborationSnapshot = {
  activeFilePath: string | null;
  files: EditorProjectFileInput[];
  title: string;
};

function getFilesMap(doc: Y.Doc) {
  return doc.getMap<Y.Map<unknown>>(FILES_MAP_KEY);
}

function getMetaMap(doc: Y.Doc) {
  return doc.getMap<string>(META_MAP_KEY);
}

function ensureFileMap(doc: Y.Doc, path: string) {
  const filesMap = getFilesMap(doc);
  const existingValue = filesMap.get(path);

  if (existingValue instanceof Y.Map) {
    return existingValue;
  }

  const nextFileMap = new Y.Map<unknown>();
  filesMap.set(path, nextFileMap);
  return nextFileMap;
}

function ensureFileText(doc: Y.Doc, path: string, fallbackContent = '') {
  const fileMap = ensureFileMap(doc, path);
  const existingValue = fileMap.get('content');

  if (existingValue instanceof Y.Text) {
    return existingValue;
  }

  const nextText = new Y.Text(fallbackContent);
  fileMap.set('content', nextText);
  return nextText;
}

export function buildCollaborationRoomName(sessionId: string) {
  return `${COLLABORATION_ROOM_PREFIX}:${sessionId}`;
}

export function createCollaborationSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createCollaborationIdentity(preferredName: string) {
  const normalizedName = preferredName.trim();
  const fallbackName = COLLABORATOR_NAME_PREFIXES[Math.floor(Math.random() * COLLABORATOR_NAME_PREFIXES.length)];
  const suffix = Math.floor(10 + Math.random() * 90);

  return {
    name: `${normalizedName || fallbackName} ${suffix}`,
    color: COLLABORATOR_COLORS[Math.floor(Math.random() * COLLABORATOR_COLORS.length)],
  } satisfies CollaborationIdentity;
}

export function hasCollaborationFiles(doc: Y.Doc) {
  return getFilesMap(doc).size > 0;
}

export function getCollaborationText(doc: Y.Doc, file: Pick<EditorProjectFileInput, 'content' | 'path'>) {
  return ensureFileText(doc, file.path, file.content);
}

export function readCollaborationSnapshot(doc: Y.Doc): CollaborationSnapshot {
  const filesMap = getFilesMap(doc);
  const metaMap = getMetaMap(doc);
  const files: EditorProjectFileInput[] = [];

  filesMap.forEach((value, path) => {
    if (!(value instanceof Y.Map)) {
      return;
    }

    const textValue = value.get('content');
    const languageValue = value.get('language');
    const sortOrderValue = value.get('sortOrder');
    const isEntryValue = value.get('isEntry');

    files.push({
      path,
      language: typeof languageValue === 'string' ? (languageValue as EditorProjectFileInput['language']) : 'plaintext',
      content: textValue instanceof Y.Text ? textValue.toString() : '',
      sortOrder: typeof sortOrderValue === 'number' ? sortOrderValue : 0,
      isEntry: Boolean(isEntryValue),
    });
  });

  files.sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.path.localeCompare(right.path);
  });

  return {
    files,
    title: metaMap.get('title') ?? '',
    activeFilePath: metaMap.get('activeFilePath') ?? null,
  };
}

export function syncCollaborationSnapshot(
  doc: Y.Doc,
  snapshot: {
    activeFilePath?: string | null;
    files?: EditorProjectFileInput[];
    title?: string;
  },
) {
  doc.transact(() => {
    const filesMap = getFilesMap(doc);
    const metaMap = getMetaMap(doc);

    if (typeof snapshot.title === 'string' && metaMap.get('title') !== snapshot.title) {
      metaMap.set('title', snapshot.title);
    }

    if (snapshot.activeFilePath !== undefined) {
      if (snapshot.activeFilePath) {
        metaMap.set('activeFilePath', snapshot.activeFilePath);
      } else {
        metaMap.delete('activeFilePath');
      }
    }

    if (!snapshot.files) {
      return;
    }

    const expectedPaths = new Set(snapshot.files.map((file) => file.path));

    Array.from(filesMap.keys()).forEach((path) => {
      if (!expectedPaths.has(path)) {
        filesMap.delete(path);
      }
    });

    snapshot.files.forEach((file) => {
      const fileMap = ensureFileMap(doc, file.path);

      if (fileMap.get('language') !== file.language) {
        fileMap.set('language', file.language);
      }

      if (fileMap.get('sortOrder') !== file.sortOrder) {
        fileMap.set('sortOrder', file.sortOrder);
      }

      if (fileMap.get('isEntry') !== file.isEntry) {
        fileMap.set('isEntry', file.isEntry);
      }

      const text = ensureFileText(doc, file.path);

      if (text.toString() !== file.content) {
        text.delete(0, text.length);
        text.insert(0, file.content);
      }
    });
  }, 'yantra-collaboration-sync');
}

export function toRgba(color: string, alpha: number) {
  const normalizedColor = color.trim();

  if (/^#([0-9a-f]{6})$/i.test(normalizedColor)) {
    const [, value] = /^#([0-9a-f]{6})$/i.exec(normalizedColor) ?? [];

    if (value) {
      const red = Number.parseInt(value.slice(0, 2), 16);
      const green = Number.parseInt(value.slice(2, 4), 16);
      const blue = Number.parseInt(value.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
  }

  if (/^#([0-9a-f]{3})$/i.test(normalizedColor)) {
    const [, value] = /^#([0-9a-f]{3})$/i.exec(normalizedColor) ?? [];

    if (value) {
      const red = Number.parseInt(value[0] + value[0], 16);
      const green = Number.parseInt(value[1] + value[1], 16);
      const blue = Number.parseInt(value[2] + value[2], 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
  }

  return normalizedColor;
}

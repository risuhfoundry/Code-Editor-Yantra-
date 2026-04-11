import { getEditorProjectTemplate } from './project-templates';
import { getEditorProjectCreationTemplate, type EditorProjectCreationTemplateId } from './project-creation-templates';
import { getEditorStarterTemplate } from './starter-templates';
import type {
  EditorProjectDetails,
  EditorProjectFile,
  EditorProjectFileInput,
  EditorProjectSummary,
  EditorStarterTemplateId,
  EditorTemplateKey,
} from '@/editor/types';

const LOCAL_EDITOR_PROJECTS_STORAGE_KEY = 'yantra-local-editor-projects';

type StoredLocalEditorProjects = Record<string, EditorProjectDetails>;
type BuildLocalEditorProjectOptions = {
  projectId: string;
  userId: string;
  templateKey: EditorTemplateKey;
  title?: string;
  timestamp?: string;
  files?: EditorProjectFileInput[];
};

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function createTimestamp() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredProjects(): StoredLocalEditorProjects {
  if (!canUseBrowserStorage()) {
    return {};
  }

  const rawValue = window.localStorage.getItem(LOCAL_EDITOR_PROJECTS_STORAGE_KEY);

  if (!rawValue) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(rawValue) as StoredLocalEditorProjects;
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
  } catch {
    return {};
  }
}

function writeStoredProjects(projects: StoredLocalEditorProjects) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(LOCAL_EDITOR_PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

export function buildLocalEditorProject({
  projectId,
  userId,
  templateKey,
  title,
  timestamp = createTimestamp(),
  files: sourceFiles,
}: BuildLocalEditorProjectOptions): EditorProjectDetails {
  const template = getEditorProjectTemplate(templateKey);
  const files = sourceFiles ?? template.files;

  const project: EditorProjectSummary = {
    id: projectId,
    userId,
    title: title?.trim() || template.title,
    templateKey,
    primaryLanguage: template.primaryLanguage,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const projectFiles: EditorProjectFile[] = files.map((file) => ({
    id: createId('local-file'),
    projectId,
    path: file.path,
    language: file.language,
    content: file.content,
    sortOrder: file.sortOrder,
    isEntry: file.isEntry,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  return {
    project,
    files: projectFiles,
  };
}

export function createLocalEditorProject(templateKey: EditorTemplateKey, userId: string, title?: string): EditorProjectDetails {
  return buildLocalEditorProject({
    projectId: createId('local-project'),
    userId,
    templateKey,
    title,
  });
}

export function createLocalEditorProjectFromCreationTemplate(
  creationTemplateId: EditorProjectCreationTemplateId,
  userId: string,
): EditorProjectDetails {
  const creationTemplate = getEditorProjectCreationTemplate(creationTemplateId);

  return buildLocalEditorProject({
    projectId: createId('local-project'),
    userId,
    templateKey: creationTemplate.templateKey,
    title: creationTemplate.title,
    files: creationTemplate.files,
  });
}

export function createLocalEditorProjectFromStarterTemplate(
  starterTemplateId: EditorStarterTemplateId,
  userId: string,
): EditorProjectDetails {
  const starterTemplate = getEditorStarterTemplate(starterTemplateId);

  return buildLocalEditorProject({
    projectId: createId('local-project'),
    userId,
    templateKey: starterTemplate.templateKey,
    title: starterTemplate.title,
    files: starterTemplate.files,
  });
}

export function getLocalEditorProject(projectId: string) {
  const projects = readStoredProjects();
  return projects[projectId] ?? null;
}

export function listLocalEditorProjects() {
  return Object.values(readStoredProjects())
    .map((projectDetails) => projectDetails.project)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

export function saveLocalEditorProject(projectDetails: EditorProjectDetails) {
  const projects = readStoredProjects();

  projects[projectDetails.project.id] = projectDetails;
  writeStoredProjects(projects);

  return projectDetails;
}

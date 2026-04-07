import ProjectsPageClient from './ProjectsPageClient';
import { requireAuthenticatedProfile } from '@/src/lib/supabase/route-guards';
import { getRequestBaseUrl, getRequestCookieHeader } from '@/editor/lib/request-origin';
import type { EditorProjectSummary } from '@/editor/types';

type ProjectsResponse = {
  projects: EditorProjectSummary[];
  error?: string;
};

export default async function EditorProjectsPage() {
  await requireAuthenticatedProfile({
    unauthenticatedRedirect: '/login?message=Log%20in%20to%20open%20your%20editor%20projects.&kind=info',
  });

  const baseUrl = await getRequestBaseUrl();
  const cookieHeader = await getRequestCookieHeader();
  const response = await fetch(`${baseUrl}/api/editor/projects`, {
    method: 'GET',
    cache: 'no-store',
    headers: cookieHeader
      ? {
          cookie: cookieHeader,
        }
      : undefined,
  });
  const payload = (await response.json().catch(() => ({ projects: [] }))) as ProjectsResponse;

  if (!response.ok) {
    throw new Error(payload.error || 'Unable to load editor projects.');
  }

  return <ProjectsPageClient initialProjects={payload.projects} />;
}

import { notFound } from 'next/navigation';
import SharedProjectView from './SharedProjectView';
import { getAuthenticatedUser } from '@/src/lib/supabase/profiles';
import { getRequestBaseUrl } from '@/editor/lib/request-origin';
import type { EditorProjectDetails } from '@/editor/types';

type SharePageProps = {
  params: Promise<{
    shareSlug: string;
  }>;
};

type ShareApiResponse = EditorProjectDetails & {
  error?: string;
};

export default async function SharedEditorProjectPage({ params }: SharePageProps) {
  const resolvedParams = await params;
  const baseUrl = await getRequestBaseUrl();
  const response = await fetch(`${baseUrl}/api/editor/share/${resolvedParams.shareSlug}`, {
    method: 'GET',
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as ShareApiResponse | null;

  if (!response.ok || !payload) {
    notFound();
  }

  const viewer = await getAuthenticatedUser();

  return (
    <SharedProjectView
      shareSlug={resolvedParams.shareSlug}
      project={payload.project}
      files={payload.files}
      viewer={
        viewer
          ? {
              id: viewer.id,
              email: viewer.email ?? null,
            }
          : null
      }
    />
  );
}

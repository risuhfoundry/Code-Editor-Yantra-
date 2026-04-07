import { notFound } from 'next/navigation';
import EmbeddedSnippetView from '../../../editor-pages/EmbeddedSnippetView';
import { getRequestBaseUrl } from '@/editor/lib/request-origin';
import type { EditorProjectDetails } from '@/editor/types';

type EmbedPageProps = {
  params: Promise<{
    shareSlug: string;
  }>;
};

type ShareApiResponse = EditorProjectDetails & {
  error?: string;
};

export default async function EmbeddedSnippetPage({ params }: EmbedPageProps) {
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

  return <EmbeddedSnippetView project={payload.project} files={payload.files} shareSlug={resolvedParams.shareSlug} />;
}

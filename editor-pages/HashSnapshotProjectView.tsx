'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';
import EmbeddedSnippetView from './EmbeddedSnippetView';
import SharedProjectView from './SharedProjectView';
import {
  buildEditorProjectDetailsFromSnapshot,
  extractEncodedSnapshotFromHash,
} from '@/editor/lib/project-export';
import type { EditorProjectDetails } from '@/editor/types';

type HashSnapshotProjectViewProps = {
  variant: 'embed' | 'share';
};

function MissingSnapshotState({ message, variant }: { message: string; variant: 'embed' | 'share' }) {
  const backHref = variant === 'embed' ? '/editor' : '/editor/projects';

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-[24px]">
        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/70">
          Export Snapshot
        </div>
        <h1 className="mt-5 font-display text-4xl leading-[0.96] tracking-tight text-white">This export link is incomplete</h1>
        <p className="mt-4 text-base leading-7 text-white/65">{message}</p>
        <div className="mt-8">
          <Link
            href={backHref}
            className="inline-flex items-center rounded-full bg-white px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-black"
          >
            Back To Yantra
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function HashSnapshotProjectView({ variant }: HashSnapshotProjectViewProps) {
  const [projectDetails, setProjectDetails] = useState<EditorProjectDetails | null>(null);
  const [encodedSnapshot, setEncodedSnapshot] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const readSnapshot = () => {
      try {
        const nextEncodedSnapshot = extractEncodedSnapshotFromHash(window.location.hash);
        const nextProjectDetails = buildEditorProjectDetailsFromSnapshot(nextEncodedSnapshot);

        setEncodedSnapshot(nextEncodedSnapshot);
        setProjectDetails(nextProjectDetails);
        setError(null);
      } catch (snapshotError) {
        setProjectDetails(null);
        setEncodedSnapshot('');
        setError(
          snapshotError instanceof Error
            ? snapshotError.message
            : 'The export payload could not be loaded from this link.',
        );
      }
    };

    readSnapshot();
    window.addEventListener('hashchange', readSnapshot);

    return () => {
      window.removeEventListener('hashchange', readSnapshot);
    };
  }, []);

  if (error) {
    return <MissingSnapshotState message={error} variant={variant} />;
  }

  if (!projectDetails) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05050b] px-6 text-white">
        <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-white/70">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading exported snapshot...
        </div>
      </main>
    );
  }

  if (variant === 'embed') {
    return (
      <EmbeddedSnippetView
        project={projectDetails.project}
        files={projectDetails.files}
        shareSlug={`local#payload=${encodedSnapshot}`}
      />
    );
  }

  return <SharedProjectView project={projectDetails.project} files={projectDetails.files} />;
}

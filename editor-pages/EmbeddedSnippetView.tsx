'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import ProjectCodeEditor from '@/editor/components/ProjectCodeEditor';
import type { EditorProjectFile, EditorProjectSummary } from '@/editor/types';

type EmbeddedSnippetViewProps = {
  project: EditorProjectSummary;
  files: EditorProjectFile[];
  shareSlug: string;
};

export default function EmbeddedSnippetView({ project, files, shareSlug }: EmbeddedSnippetViewProps) {
  const entryFile = useMemo(() => files.find((file) => file.isEntry) ?? files[0] ?? null, [files]);

  return (
    <div className="flex min-h-screen flex-col bg-[#05050b] text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b0b13] px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] uppercase tracking-[0.24em] text-white/38">Yantra Embed</div>
          <div className="truncate text-sm text-white/78">
            {project.title} {entryFile ? `• ${entryFile.path}` : ''}
          </div>
        </div>

        <Link
          href={`/editor/share/${shareSlug}`}
          className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-white/84 transition hover:bg-white/[0.08]"
        >
          Open Share View
        </Link>
      </div>

      <div className="flex-1">
        <ProjectCodeEditor
          file={
            entryFile
              ? {
                  path: entryFile.path,
                  language: entryFile.language,
                  content: entryFile.content,
                }
              : null
          }
          theme="dark"
          readOnly
          settings={{
            fontSize: 13,
            minimapEnabled: false,
            wordWrap: 'on',
          }}
          onChange={() => undefined}
        />
      </div>
    </div>
  );
}

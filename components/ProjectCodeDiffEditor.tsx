'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { languageToMonaco, pathToMonacoLanguage, resolveMonacoTheme, setupMonaco } from '@/editor/lib/monaco';

type ProjectCodeDiffEditorProps = {
  filePath: string;
  language?: string;
  original: string;
  modified: string;
  theme: 'dark' | 'light' | 'contrast';
  settings?: {
    fontSize: number;
    minimapEnabled: boolean;
    wordWrap: 'off' | 'on';
  };
};

const MonacoDiffEditor = dynamic(() => import('@monaco-editor/react').then((module) => module.DiffEditor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#08080f] text-[12px] uppercase tracking-[0.12em] text-[#374151]">
      Loading diff view...
    </div>
  ),
});

export default function ProjectCodeDiffEditor({
  filePath,
  language,
  modified,
  original,
  theme,
  settings,
}: ProjectCodeDiffEditorProps) {
  const [diffEditor, setDiffEditor] = useState<editor.IStandaloneDiffEditor | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<Monaco | null>(null);

  useEffect(() => {
    document.documentElement.dataset.editorTheme = theme;

    return () => {
      delete document.documentElement.dataset.editorTheme;
    };
  }, [theme]);

  useEffect(() => {
    if (!monacoInstance) {
      return;
    }

    monacoInstance.editor.setTheme(resolveMonacoTheme(theme));
  }, [monacoInstance, theme]);

  useEffect(() => {
    if (!diffEditor) {
      return;
    }

    diffEditor.updateOptions({
      fontSize: settings?.fontSize ?? 13,
      renderSideBySide: true,
      renderOverviewRuler: true,
      originalEditable: false,
      readOnly: true,
      wordWrap: settings?.wordWrap ?? 'off',
    });
  }, [diffEditor, settings?.fontSize, settings?.wordWrap]);

  return (
    <div className="h-full min-h-[28rem] overflow-hidden bg-[#08080f]">
      <MonacoDiffEditor
        beforeMount={setupMonaco}
        height="100%"
        language={languageToMonaco(pathToMonacoLanguage(filePath, language))}
        onMount={(nextDiffEditor, nextMonacoInstance) => {
          setDiffEditor(nextDiffEditor);
          setMonacoInstance(nextMonacoInstance);
          nextMonacoInstance.editor.setTheme(resolveMonacoTheme(theme));
        }}
        options={{
          automaticLayout: true,
          diffWordWrap: settings?.wordWrap ?? 'off',
          enableSplitViewResizing: true,
          fontFamily: 'Fira Code, SF Mono, JetBrains Mono, monospace',
          fontSize: settings?.fontSize ?? 13,
          originalEditable: false,
          readOnly: true,
          renderMarginRevertIcon: false,
          renderOverviewRuler: true,
          renderSideBySide: true,
          scrollbar: {
            verticalScrollbarSize: 3,
            horizontalScrollbarSize: 3,
          },
          wordWrap: settings?.wordWrap ?? 'off',
        }}
        original={original}
        modified={modified}
        theme={resolveMonacoTheme(theme)}
      />
    </div>
  );
}

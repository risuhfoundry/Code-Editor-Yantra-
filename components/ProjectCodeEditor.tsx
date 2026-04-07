'use client';

import dynamic from 'next/dynamic';
import type { Monaco } from '@monaco-editor/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { editor } from 'monaco-editor';
import { parseEditorExecutionErrors } from '@/editor/lib/error-utils';
import { editorOptions, languageToMonaco, pathToMonacoLanguage, resolveMonacoTheme, setupMonaco } from '@/editor/lib/monaco';

type ProjectCodeEditorFile = {
  path: string;
  language?: string;
  content: string;
};

type ProjectCodeEditorProps = {
  file: ProjectCodeEditorFile | null;
  theme: 'dark' | 'light' | 'contrast';
  errorText?: string;
  readOnly?: boolean;
  settings?: {
    fontSize: number;
    minimapEnabled: boolean;
    wordWrap: 'off' | 'on';
  };
  onChange: (value: string) => void;
  onEditorReady?: (editorInstance: editor.IStandaloneCodeEditor | null) => void;
  onMonacoReady?: (monacoInstance: Monaco | null) => void;
};

const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((module) => module.default), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-[#04070d] p-4">
      <div className="h-full rounded-[1.5rem] border border-[#192131] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent),#090d14] p-4 shadow-[0_24px_56px_rgba(0,0,0,0.32)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-3 w-28 rounded-full bg-[#192131]" />
          <div className="h-3 w-16 rounded-full bg-[#192131]" />
        </div>
        <div className="space-y-3 font-mono text-[12px]">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="h-3 w-5 rounded-full bg-[#192131]" />
              <div className="h-3 rounded-full bg-[#0f1520]" style={{ width: `${42 + (index % 4) * 12}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
});

export default function ProjectCodeEditor({
  file,
  theme,
  errorText = '',
  readOnly = false,
  settings,
  onChange,
  onEditorReady,
  onMonacoReady,
}: ProjectCodeEditorProps) {
  const [editorInstance, setEditorInstance] = useState<editor.IStandaloneCodeEditor | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<Monaco | null>(null);
  const isApplyingExternalValueRef = useRef(false);

  const markerOwner = 'yantra-editor-playground';
  const errorLines = useMemo(() => {
    const lineCount = file?.content.split('\n').length ?? 0;
    return parseEditorExecutionErrors(errorText, lineCount);
  }, [errorText, file?.content]);

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
    if (!onEditorReady) {
      return;
    }

    onEditorReady(editorInstance);

    return () => {
      onEditorReady(null);
    };
  }, [editorInstance, onEditorReady]);

  useEffect(() => {
    if (!onMonacoReady) {
      return;
    }

    onMonacoReady(monacoInstance);

    return () => {
      onMonacoReady(null);
    };
  }, [monacoInstance, onMonacoReady]);

  useEffect(() => {
    if (!editorInstance || !monacoInstance) {
      return;
    }

    const model = editorInstance.getModel();

    if (!model || !file) {
      return;
    }

    monacoInstance.editor.setModelLanguage(model, languageToMonaco(pathToMonacoLanguage(file.path, file.language)));
  }, [editorInstance, file, monacoInstance]);

  useEffect(() => {
    if (!editorInstance || !file) {
      return;
    }

    const model = editorInstance.getModel();

    if (!model) {
      return;
    }

    if (model.getValue() === file.content) {
      return;
    }

    isApplyingExternalValueRef.current = true;
    model.setValue(file.content);
    queueMicrotask(() => {
      isApplyingExternalValueRef.current = false;
    });
  }, [editorInstance, file]);

  useEffect(() => {
    if (!editorInstance || readOnly) {
      return;
    }

    editorInstance.focus();
  }, [editorInstance, file?.path, readOnly]);

  useEffect(() => {
    if (!editorInstance) {
      return;
    }

    editorInstance.updateOptions({
      fontSize: settings?.fontSize ?? editorOptions.fontSize,
      minimap: { enabled: readOnly ? false : settings?.minimapEnabled ?? true },
      readOnly,
      wordWrap: settings?.wordWrap ?? 'off',
    });
  }, [editorInstance, readOnly, settings?.fontSize, settings?.minimapEnabled, settings?.wordWrap]);

  useEffect(() => {
    if (!editorInstance || !monacoInstance) {
      return;
    }

    const model = editorInstance.getModel();

    if (!model) {
      return;
    }

    monacoInstance.editor.setModelMarkers(
      model,
      markerOwner,
      errorLines.map((errorLine) => ({
        severity: monacoInstance.MarkerSeverity.Error,
        message: errorLine.message,
        startLineNumber: errorLine.lineNumber,
        endLineNumber: errorLine.lineNumber,
        startColumn: 1,
        endColumn: model.getLineMaxColumn(errorLine.lineNumber),
      })),
    );

    return () => {
      monacoInstance.editor.setModelMarkers(model, markerOwner, []);
    };
  }, [editorInstance, errorLines, monacoInstance]);

  if (!file) {
    return (
      <div className="flex h-full min-h-[28rem] items-center justify-center bg-[#04070d]">
        <p className="text-sm text-[#93a0b7]">Open a file to start editing.</p>
      </div>
    );
  }

  return (
    <div className="yantra-editor-surface h-full min-h-[28rem] overflow-hidden bg-[#04070d]">
      <MonacoEditor
        beforeMount={setupMonaco}
        defaultValue={file.content}
        height="100%"
        keepCurrentModel
        language={languageToMonaco(pathToMonacoLanguage(file.path, file.language))}
        onChange={(value) => {
          if (isApplyingExternalValueRef.current) {
            return;
          }

          onChange(value ?? '');
        }}
        onMount={(nextEditorInstance, nextMonacoInstance) => {
          setEditorInstance(nextEditorInstance);
          setMonacoInstance(nextMonacoInstance);
          nextMonacoInstance.editor.setTheme(resolveMonacoTheme(theme));

          if (!readOnly) {
            nextEditorInstance.focus();
          }
        }}
        options={{
          ...editorOptions,
          minimap: { enabled: readOnly ? false : settings?.minimapEnabled ?? true },
          padding: { top: 18, bottom: 18 },
          folding: true,
          matchBrackets: 'always',
          guides: {
            bracketPairs: true,
            bracketPairsHorizontal: true,
            highlightActiveBracketPair: true,
            highlightActiveIndentation: true,
            indentation: true,
          },
          renderWhitespace: 'selection',
          readOnly,
          overviewRulerBorder: false,
          renderLineHighlight: 'all',
          scrollbar: {
            verticalScrollbarSize: 3,
            horizontalScrollbarSize: 3,
          },
          fontSize: settings?.fontSize ?? editorOptions.fontSize,
          wordWrap: settings?.wordWrap ?? 'off',
        }}
        path={file.path}
        saveViewState
        theme={resolveMonacoTheme(theme)}
      />
    </div>
  );
}

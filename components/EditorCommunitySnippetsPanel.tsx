'use client';

import { Plus, Search, Sparkles } from 'lucide-react';
import type { RefObject } from 'react';
import type { EditorCommunitySnippetDefinition, EditorCommunitySnippetRuntime } from '@/editor/lib/community-snippets';

type EditorCommunitySnippetsPanelProps = {
  activeRuntime: EditorCommunitySnippetRuntime | null;
  feedback: {
    tone: 'error' | 'success';
    text: string;
  } | null;
  importingSnippetId: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  onImportSnippet: (snippetId: string) => void;
  onSearchChange: (value: string) => void;
  onToggleOpen: () => void;
  searchQuery: string;
  snippets: EditorCommunitySnippetDefinition[];
};

function getRuntimeLabel(runtime: EditorCommunitySnippetRuntime) {
  switch (runtime) {
    case 'python':
      return 'Python';
    case 'web':
      return 'Web';
    default:
      return 'JavaScript';
  }
}

export default function EditorCommunitySnippetsPanel({
  activeRuntime,
  feedback,
  importingSnippetId,
  inputRef,
  isOpen,
  onImportSnippet,
  onSearchChange,
  onToggleOpen,
  searchQuery,
  snippets,
}: EditorCommunitySnippetsPanelProps) {
  return (
    <section className="border-t border-[color:var(--border-subtle)] pt-3">
      <button
        type="button"
        className="yantra-sidebar-group flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={onToggleOpen}
      >
        <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
        <span className="min-w-0 flex-1 truncate">Community snippets</span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {snippets.length} ready
        </span>
      </button>

      {isOpen ? (
        <div className="mt-1 px-3 pb-3">
          <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--bg-panel)] p-3 shadow-[inset_0_1px_0_var(--chrome-highlight)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Marketplace</div>
                <div className="mt-1 text-[13px] font-medium text-[var(--text-primary)]">
                  Browse community-built starter code and import it in one click.
                </div>
              </div>
              {activeRuntime ? (
                <span className="rounded-full border border-[color:var(--border-subtle)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  {getRuntimeLabel(activeRuntime)} first
                </span>
              ) : null}
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                ref={inputRef}
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                className="yantra-title-input h-9 w-full pl-9 pr-3"
                placeholder="Search snippets, tags, or stacks..."
                aria-label="Search community snippets"
              />
            </div>

            {feedback ? (
              <div
                className={`mt-3 rounded-xl border px-3 py-2 text-[11px] leading-5 ${
                  feedback.tone === 'error'
                    ? 'border-[rgba(248,113,113,0.32)] bg-[rgba(127,29,29,0.2)] text-[var(--red)]'
                    : 'border-[rgba(74,222,128,0.28)] bg-[rgba(20,83,45,0.18)] text-[var(--green)]'
                }`}
              >
                {feedback.text}
              </div>
            ) : null}
          </div>

          <div className="mt-3 space-y-2">
            {snippets.length > 0 ? (
              snippets.map((snippet) => {
                const isImporting = importingSnippetId === snippet.id;
                const isBestFit = activeRuntime === snippet.runtime;

                return (
                  <article
                    key={snippet.id}
                    className="rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--bg-panel)] p-3 shadow-[inset_0_1px_0_var(--chrome-highlight)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-[13px] font-medium text-[var(--text-primary)]">{snippet.title}</h4>
                          <span className="rounded-full border border-[color:var(--border-subtle)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                            {snippet.category}
                          </span>
                          <span className="rounded-full border border-[rgba(115,130,246,0.18)] bg-[var(--accent-soft)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--accent-glow)]">
                            {getRuntimeLabel(snippet.runtime)}
                          </span>
                          {isBestFit ? (
                            <span className="rounded-full border border-[rgba(74,222,128,0.28)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--green)]">
                              Best fit
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{snippet.author}</div>
                        <p className="mt-2 text-[12px] leading-6 text-[var(--text-secondary)]">{snippet.description}</p>
                      </div>

                      <button
                        type="button"
                        className="yantra-new-file-button inline-flex h-8 shrink-0 items-center gap-1.5 px-3"
                        onClick={() => onImportSnippet(snippet.id)}
                        disabled={isImporting}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{isImporting ? 'Importing...' : 'Import'}</span>
                      </button>
                    </div>

                    <p className="mt-3 text-[12px] leading-6 text-[var(--text-secondary)]">{snippet.detail}</p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {snippet.tags.map((tag) => (
                        <span
                          key={`${snippet.id}-${tag}`}
                          className="rounded-full border border-[color:var(--border-subtle)] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {snippet.files.map((file) => (
                        <code
                          key={`${snippet.id}-${file.path}`}
                          className="rounded-md border border-[color:var(--border-subtle)] bg-[var(--bg-panel-alt)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
                        >
                          {file.path}
                        </code>
                      ))}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="yantra-empty-note">
                No snippets matched that search. Try a stack name like <code>python</code>, <code>fetch</code>, or <code>chart</code>.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

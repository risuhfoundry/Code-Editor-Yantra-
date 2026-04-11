import { ArrowRight, LoaderCircle } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { EditorStarterTemplateId } from '@/editor/types';
import type { EditorStarterTemplateDefinition } from '@/editor/lib/starter-templates';

type EditorStarterEmptyStateProps = {
  templates: EditorStarterTemplateDefinition[];
  creatingStarterId: EditorStarterTemplateId | null;
  error: string | null;
  onSelectStarter: (starterTemplateId: EditorStarterTemplateId) => void;
};

export default function EditorStarterEmptyState({
  templates,
  creatingStarterId,
  error,
  onSelectStarter,
}: EditorStarterEmptyStateProps) {
  return (
    <div className="flex h-full min-h-[28rem] overflow-y-auto bg-[var(--bg-base)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col justify-center px-6 py-10 lg:px-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center rounded-full border border-[color:var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-glow)]">
            Starter templates
          </div>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-4xl">
            Start with something runnable instead of a blank file.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--text-secondary)]">
            Choose a template and Yantra will open a working project you can edit, run, and remix right away.
          </p>
        </div>

        {error ? (
          <div className="mt-6 rounded-[1.25rem] border border-[rgba(248,113,113,0.35)] bg-[rgba(127,29,29,0.2)] px-4 py-3 text-sm leading-6 text-[var(--red)]">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {templates.map((template) => {
            const isCreating = creatingStarterId === template.id;
            const cardStyle = {
              '--starter-accent': template.accent,
            } as CSSProperties;

            return (
              <button
                key={template.id}
                type="button"
                className="group relative overflow-hidden rounded-[1.75rem] border border-[color:var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent),var(--bg-surface)] text-left shadow-[var(--panel-shadow)] disabled:cursor-wait disabled:opacity-75"
                style={cardStyle}
                onClick={() => onSelectStarter(template.id)}
                disabled={creatingStarterId !== null}
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-[var(--starter-accent)]" />

                <div className="flex h-full flex-col p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--starter-accent)]">
                      {template.eyebrow}
                    </span>
                    {isCreating ? (
                      <LoaderCircle className="h-4 w-4 animate-spin text-[var(--starter-accent)]" />
                    ) : (
                      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Ready</span>
                    )}
                  </div>

                  <h3 className="mt-4 text-[1.45rem] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                    {template.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{template.description}</p>
                  <p className="mt-3 text-[12px] leading-6 text-[var(--text-muted)]">{template.detail}</p>

                  <div className="mt-5 rounded-[1.25rem] border border-[color:var(--border-subtle)] bg-[var(--bg-base)]/80 px-4 py-3 font-mono text-[11px] leading-6 text-[var(--text-secondary)]">
                    {template.preview.map((line) => (
                      <div key={`${template.id}-${line}`} className="truncate">
                        {line}
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
                    <span>{isCreating ? 'Creating project...' : template.actionLabel}</span>
                    {isCreating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-xs leading-6 text-[var(--text-muted)]">
          After the project opens, you can rename files, add new ones, switch themes, and keep building from there.
        </p>
      </div>
    </div>
  );
}

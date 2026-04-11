import { ArrowRight, LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, type CSSProperties } from 'react';
import type {
  EditorProjectCreationTemplateDefinition,
  EditorProjectCreationTemplateId,
} from '@/editor/lib/project-creation-templates';

type EditorProjectTemplateModalProps = {
  open: boolean;
  templates: EditorProjectCreationTemplateDefinition[];
  creatingTemplateId: EditorProjectCreationTemplateId | null;
  error: string | null;
  onClose: () => void;
  onSelectTemplate: (templateId: EditorProjectCreationTemplateId) => void;
};

export default function EditorProjectTemplateModal({
  open,
  templates,
  creatingTemplateId,
  error,
  onClose,
  onSelectTemplate,
}: EditorProjectTemplateModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(2,6,23,0.72)] px-4 py-6 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-template-modal-title"
        className="flex max-h-[min(92vh,64rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#050816] shadow-[0_34px_120px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/58">
              Project templates
            </div>
            <h2 id="project-template-modal-title" className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white">
              Start with a real project shape, not a blank shell.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58">
              Pick a preset and Yantra will pre-populate the project with runnable boilerplate, starter files, and a stronger first
              structure.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/72 transition hover:bg-white/[0.08] hover:text-white"
            onClick={onClose}
            aria-label="Close project template picker"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          {error ? (
            <div className="mb-5 rounded-[1.4rem] border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {templates.map((template) => {
              const isCreating = creatingTemplateId === template.id;
              const cardStyle = {
                '--template-accent': template.accent,
              } as CSSProperties;

              return (
                <button
                  key={template.id}
                  type="button"
                  className="group relative overflow-hidden rounded-[1.85rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01)),#090f1d] text-left shadow-[0_22px_72px_rgba(0,0,0,0.35)] transition hover:-translate-y-[1px] hover:border-white/16 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02)),#0b1326] disabled:cursor-wait disabled:opacity-80"
                  style={cardStyle}
                  onClick={() => onSelectTemplate(template.id)}
                  disabled={creatingTemplateId !== null}
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-[var(--template-accent)]" />

                  <div className="flex h-full flex-col p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--template-accent)]">
                        {template.eyebrow}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-white/42">
                        {isCreating ? 'Creating' : 'Ready'}
                      </span>
                    </div>

                    <h3 className="mt-4 text-[1.7rem] font-semibold tracking-[-0.03em] text-white">{template.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/68">{template.description}</p>
                    <p className="mt-3 text-[12px] leading-6 text-white/46">{template.detail}</p>

                    <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-black/20 px-4 py-3 font-mono text-[11px] leading-6 text-white/72">
                      {template.preview.map((line) => (
                        <div key={`${template.id}-${line}`} className="truncate">
                          {line}
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold text-white">
                      <span>{isCreating ? 'Creating project...' : template.actionLabel}</span>
                      {isCreating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

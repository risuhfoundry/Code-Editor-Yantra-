'use client';

import { Keyboard, X } from 'lucide-react';

type ShortcutItem = {
  keys: string;
  action: string;
};

type ShortcutCheatSheetProps = {
  open: boolean;
  onClose: () => void;
  shortcuts: ShortcutItem[];
};

export default function ShortcutCheatSheet({ open, onClose, shortcuts }: ShortcutCheatSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[rgba(8,8,15,0.72)] px-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-sheet-title"
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[rgba(30,30,56,0.95)] bg-[#10101d] shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
      >
        <div className="flex h-12 items-center justify-between border-b border-[rgba(30,30,56,0.95)] bg-[#0b0b13] px-5">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#818cf8]">
            <Keyboard className="h-3.5 w-3.5" />
            Keyboard Shortcuts
          </div>

          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6b7280] transition hover:bg-[#11112a] hover:text-[#e2e8f0]"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {shortcuts.map((shortcut) => (
            <div
              key={`${shortcut.keys}-${shortcut.action}`}
              className="rounded-[1.2rem] border border-[rgba(30,30,56,0.95)] bg-[#08080f] px-4 py-3"
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#cbd5e1]">{shortcut.keys}</div>
              <div className="mt-2 text-sm leading-6 text-[#94a3b8]">{shortcut.action}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

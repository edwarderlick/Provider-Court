"use client";

import { ReactNode, useEffect } from "react";

// Shared confirm/action modal shell. NOTE: none of the 19 Stitch exports
// contain a modal/dialog pattern anywhere (verified — every confirm action
// in the source is an inline button or a full-page flow). This component is
// therefore new UI, not lifted from an export; it borrows the app's existing
// visual language (sharp hardware-border card, mono labels, primary/on-primary
// button treatment) so it doesn't clash with the rest of the interface.
export function Modal({
  open,
  onClose,
  title,
  tag,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  tag?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-margin-mobile">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-on-surface/60 cursor-crosshair-brutalist"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-surface hardware-border border-on-surface">
        <div className="bg-surface-container px-6 py-4 border-b border-outline flex justify-between items-center">
          <h2 className="font-mono-label text-mono-label font-bold text-on-surface">
            {tag && <span className="text-primary mr-2">{tag}</span>}
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors"
          >
            close
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && (
          <div className="p-6 pt-0 flex flex-col sm:flex-row gap-3 sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

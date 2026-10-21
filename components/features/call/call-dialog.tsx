"use client";

import { useEffect, useId, useRef } from "react";
import { Icon } from "./icons";

/**
 * Native <dialog> as dialog or sheet (design system §3.4). `showModal()` gives the focus trap and Esc;
 * focus returns to whatever had it before opening. `initialFocus` picks the first focused element
 * (the End confirm focuses Cancel).
 */
export function CallDialog({
  open,
  onClose,
  title,
  variant = "dialog",
  initialFocus,
  children,
  footer,
  describedBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  variant?: "dialog" | "sheet-bottom" | "sheet-side";
  initialFocus?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Id of the element that explains the consequence (read with the title). */
  describedBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      initialFocus?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocus]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onDialogClose = () => {
      onClose();
      const target = returnFocus.current;
      returnFocus.current = null;
      if (target && target.isConnected) target.focus();
    };
    dialog.addEventListener("close", onDialogClose);
    return () => dialog.removeEventListener("close", onDialogClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className="call-dialog"
      data-variant={variant}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      onClick={(event) => {
        // Backdrop click closes sheets (the click target is the dialog itself, outside the panel).
        if (event.target === ref.current && variant !== "dialog") ref.current?.close();
      }}
    >
      <div className="call-dialog-panel">
        <div className="call-dialog-head">
          <h2 id={titleId}>{title}</h2>
          {variant !== "dialog" && (
            <button type="button" className="call-btn" data-variant="ghost" data-icon="true" aria-label="Close" onClick={() => ref.current?.close()}>
              <Icon name="close" />
            </button>
          )}
        </div>
        {open && <div className="call-dialog-body">{children}</div>}
        {open && footer && <div className="call-dialog-actions">{footer}</div>}
      </div>
    </dialog>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./icons";

/** Empty state (design system §3.18): title, one sentence, one action. */
export function EmptyState({ title, children, action, variant = "panel" }: { title: string; children?: React.ReactNode; action?: React.ReactNode; variant?: "page" | "panel" }) {
  return (
    <div className="call-empty" data-variant={variant}>
      <p className="call-empty-title">{title}</p>
      {children && <p className="call-empty-copy">{children}</p>}
      {action}
    </div>
  );
}

/**
 * Loading state (design system §3.19). `steps` shows which of the start steps is active
 * ("Preparing interpreter…" → "Connecting audio…" → "Starting interpreter…").
 */
export function LoadingState({ label, steps, current }: { label: string; steps?: string[]; current?: number }) {
  return (
    <div className="call-loading" aria-busy="true">
      <span className="call-spinner" aria-hidden="true" />
      <span className="call-loading-label">{label}</span>
      {steps && (
        <ol className="call-steps" aria-hidden="true">
          {steps.map((step, index) => <li key={step} data-state={index < (current ?? 0) ? "done" : index === current ? "active" : "todo"} />)}
        </ol>
      )}
    </div>
  );
}

/**
 * Error state (design system §3.20). Blocking errors use role="alert"; the raw code goes into a
 * closed "Technical details" disclosure, never into the headline.
 */
export function ErrorState({
  title,
  children,
  action,
  technical,
  variant = "inline",
  alert = true,
  id,
  focusOnMount = false,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  technical?: string;
  variant?: "inline" | "banner" | "page";
  alert?: boolean;
  id?: string;
  /** Move focus to the title when it appears (the user's own action caused the error). */
  focusOnMount?: boolean;
}) {
  const titleRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (focusOnMount) titleRef.current?.focus();
  }, [focusOnMount, title]);
  return (
    <div className="call-error" data-variant={variant} role={alert ? "alert" : undefined} id={id}>
      <Icon name="alert" className="call-error-icon" />
      <div className="call-error-body">
        <p className="call-error-title" ref={titleRef} tabIndex={focusOnMount ? -1 : undefined}>{title}</p>
        {children && <p className="call-error-copy">{children}</p>}
        {action && <div className="call-error-actions">{action}</div>}
        {technical && (
          <details className="call-error-tech">
            <summary>Technical details</summary>
            <code>{technical}</code>
          </details>
        )}
      </div>
    </div>
  );
}

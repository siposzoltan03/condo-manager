"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ResponsiveDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Sticky footer (action row). On phone the body scrolls under it. */
  footer?: ReactNode;
  /** Max-width at desktop. Defaults to "md" (max-w-lg ≈ 32rem). */
  size?: "sm" | "md" | "lg" | "xl";
  /** Breakpoint at which the dialog stops being full-screen and becomes
   *  a centered card. Defaults to "sm" — full-screen on phone only. */
  cardAt?: "sm" | "md";
  /** When false, clicking the backdrop won't close. Defaults to true. */
  dismissOnBackdrop?: boolean;
  /** Optional label override for the close button. */
  closeLabel?: string;
}

const SIZE_CLASS = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

const CARD_CLASS = {
  sm: "sm:relative sm:m-auto sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl sm:border sm:border-ink/12",
  md: "md:relative md:m-auto md:h-auto md:max-h-[calc(100vh-2rem)] md:rounded-2xl md:border md:border-ink/12",
};

const BACKDROP_PADDING = {
  sm: "sm:p-4",
  md: "md:p-4",
};

export function ResponsiveDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  cardAt = "sm",
  dismissOnBackdrop = true,
  closeLabel = "Close",
}: ResponsiveDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function getFocusables(): HTMLElement[] {
      const root = contentRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusables = getFocusables();
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);

    const focusables = getFocusables();
    focusables[0]?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-stretch justify-center bg-ink/50",
        BACKDROP_PADDING[cardAt],
      )}
      onClick={dismissOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="responsive-dialog-title"
    >
      <div
        ref={contentRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative flex w-full flex-col bg-card",
          // phone: full-screen sheet
          "h-full",
          // desktop: floating card
          CARD_CLASS[cardAt],
          SIZE_CLASS[size],
        )}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink/8 bg-card px-5 py-4 sm:rounded-t-2xl">
          <div className="min-w-0 flex-1">
            <h2
              id="responsive-dialog-title"
              className="font-display text-lg font-semibold leading-tight tracking-tight text-ink"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-ink-soft">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-bg-3"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {footer && (
          <footer className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-ink/8 bg-card px-5 py-3 sm:rounded-b-2xl">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** "expense" gives the danger-tinted accent stripe; "income" gives moss. */
  variant: "income" | "expense";
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Tiles-styled modal shell shared by Add Income / Add Expense.
 * Pure presentation — form state and submission live in the consumer.
 */
export function FinanceModalShell({
  open,
  onClose,
  variant,
  title,
  subtitle,
  children,
}: Props) {
  // Esc closes; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const accent =
    variant === "income" ? "var(--color-moss)" : "var(--color-danger)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ padding: "16px" }}
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0"
        style={{
          background: "color-mix(in srgb, var(--color-ink) 50%, transparent)",
          backdropFilter: "blur(2px)",
          border: 0,
          cursor: "default",
        }}
      />
      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full overflow-hidden"
        style={{
          maxWidth: "480px",
          background: "var(--color-card)",
          borderRadius: "14px",
          border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          boxShadow:
            "0 28px 70px -28px color-mix(in srgb, var(--color-ink) 30%, transparent), 0 12px 28px -12px color-mix(in srgb, var(--color-ink) 18%, transparent)",
          fontFamily: "var(--font-manrope), system-ui, sans-serif",
          color: "var(--color-ink)",
        }}
      >
        {/* Accent stripe */}
        <div
          aria-hidden
          style={{
            height: "3px",
            background: accent,
          }}
        />

        {/* Header */}
        <div
          className="flex items-start justify-between gap-4"
          style={{ padding: "22px 24px 14px" }}
        >
          <div>
            <span
              className="font-mono"
              style={{
                fontSize: "10px",
                color: "var(--color-muted)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {variant === "income" ? "/ bevétel · új tétel" : "/ kiadás · új tétel"}
            </span>
            <h2
              id="modal-title"
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "22px",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                marginTop: "4px",
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--color-ink-soft)",
                  margin: "4px 0 0",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid place-items-center transition-colors hover:bg-[var(--color-bg-3)] flex-shrink-0"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              color: "var(--color-muted)",
            }}
            aria-label="Close"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 6L18 18M6 18L18 6" />
            </svg>
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

// ─── Shared field primitives ──────────────────────────────────────────────

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function FinanceField({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label
        htmlFor={htmlFor}
        className="block font-mono"
        style={{
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: error ? "var(--color-danger)" : "var(--color-muted)",
          marginBottom: "6px",
        }}
      >
        {label}
      </label>
      {children}
      {(error || hint) && (
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: error ? "var(--color-danger)" : "var(--color-muted)",
            marginTop: "5px",
            letterSpacing: "0.04em",
          }}
        >
          {error ?? hint}
        </div>
      )}
    </div>
  );
}

export function financeInputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    fontSize: "13.5px",
    color: "var(--color-ink)",
    background: hasError
      ? "color-mix(in srgb, var(--color-danger) 7%, var(--color-bg-3))"
      : "var(--color-bg-3)",
    border: hasError
      ? "1px solid var(--color-danger)"
      : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
    borderRadius: "8px",
    outline: "none",
    fontFamily: "inherit",
  };
}

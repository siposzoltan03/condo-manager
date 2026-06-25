"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Mono eyebrow above the title, e.g. "/ szavazás · új tétel". */
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** "moss" for vote-create, "ochre" for meeting-create. */
  accent?: "moss" | "ochre" | "ink";
  /** Modal max width in pixels. */
  maxWidth?: number;
  children: React.ReactNode;
}

export function VotingModalShell({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  accent = "moss",
  maxWidth = 560,
  children,
}: Props) {
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

  const accentColor =
    accent === "moss"
      ? "var(--color-moss-2)"
      : accent === "ochre"
        ? "var(--color-ochre)"
        : "var(--color-ink)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ padding: "16px" }}
    >
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voting-modal-title"
        className="relative w-full overflow-hidden flex flex-col"
        style={{
          maxWidth: `${maxWidth}px`,
          maxHeight: "calc(100vh - 32px)",
          background: "var(--color-card)",
          borderRadius: "14px",
          border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          boxShadow:
            "0 28px 70px -28px color-mix(in srgb, var(--color-ink) 30%, transparent), 0 12px 28px -12px color-mix(in srgb, var(--color-ink) 18%, transparent)",
          fontFamily: "var(--font-manrope), system-ui, sans-serif",
          color: "var(--color-ink)",
        }}
      >
        <div
          aria-hidden
          style={{
            height: "3px",
            background: accentColor,
            flexShrink: 0,
          }}
        />

        <div
          className="flex items-start justify-between gap-4"
          style={{ padding: "22px 24px 14px", flexShrink: 0 }}
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
              {eyebrow}
            </span>
            <h2
              id="voting-modal-title"
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

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function VotingField({ label, htmlFor, hint, error, children }: FieldProps) {
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

export function votingInputStyle(hasError: boolean): React.CSSProperties {
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

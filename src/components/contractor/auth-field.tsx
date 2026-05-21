"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Label + slot + error/hint trio for contractor auth forms. Mirrors the
 * condo `<Field>` in `login-form.tsx` so the visual language matches.
 */
export function AuthField({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <label
        htmlFor={htmlFor}
        className="block font-mono"
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: error ? "var(--color-danger)" : "var(--color-muted)",
          marginBottom: "6px",
        }}
      >
        {label}
      </label>
      <div className="relative">{children}</div>
      {error ? (
        <div
          role="alert"
          style={{
            fontSize: "12px",
            color: "var(--color-danger)",
            marginTop: "6px",
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      ) : hint ? (
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            marginTop: "5px",
            letterSpacing: "0.04em",
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function authInputStyle(hasError: boolean): CSSProperties {
  return {
    width: "100%",
    padding: "13px 14px",
    fontSize: "14px",
    color: "var(--color-ink)",
    background: hasError
      ? "color-mix(in srgb, var(--color-danger) 7%, var(--color-bg-3))"
      : "var(--color-bg-3)",
    border: hasError
      ? "1px solid var(--color-danger)"
      : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
    borderRadius: "10px",
    outline: "none",
    transition: "border-color 0.15s, background 0.15s",
  };
}

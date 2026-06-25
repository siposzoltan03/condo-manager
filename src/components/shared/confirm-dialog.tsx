"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Tiles-styled confirmation dialog. Replaces `window.confirm()` calls
 * across the app with a promise-returning hook:
 *
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: "Lemondás benyújtása",
 *     description: "Biztosan…?",
 *     danger: true,
 *   });
 *   if (!ok) return;
 *
 * Mount <ConfirmProvider> once near the root of the app shell.
 */

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (red). */
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) {
    throw new Error(
      "useConfirm must be used inside <ConfirmProvider>",
    );
  }
  return fn;
}

interface PendingConfirm {
  opts: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ opts, resolve });
    });
  }, []);

  function close(ok: boolean) {
    if (!pending) return;
    pending.resolve(ok);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialog
          opts={pending.opts}
          onCancel={() => close(false)}
          onConfirm={() => close(true)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  opts,
  onCancel,
  onConfirm,
}: {
  opts: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button on open (the safer default for destructive
  // actions). Esc cancels. Tab cycles between the two buttons.
  useEffect(() => {
    cancelBtnRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Tab") {
        // Two-button trap: tab + shift-tab cycle between them.
        e.preventDefault();
        const cancel = cancelBtnRef.current;
        const conf = confirmBtnRef.current;
        if (!cancel || !conf) return;
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === cancel) conf.focus();
          else cancel.focus();
        } else {
          if (active === cancel) conf.focus();
          else cancel.focus();
        }
      }
      if (e.key === "Enter") {
        const active = document.activeElement;
        if (active === confirmBtnRef.current) {
          e.preventDefault();
          onConfirm();
        } else if (active === cancelBtnRef.current) {
          e.preventDefault();
          onCancel();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center"
      style={{
        background: "color-mix(in srgb, var(--color-ink) 50%, transparent)",
        padding: "20px",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 100%)",
          background: "var(--color-card)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
          borderRadius: "16px",
          padding: "24px 26px",
        }}
      >
        <h2
          id="confirm-title"
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "18px",
            fontWeight: 600,
            letterSpacing: "-0.018em",
            marginBottom: opts.description ? "8px" : "20px",
          }}
        >
          {opts.title}
        </h2>
        {opts.description && (
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-ink-soft)",
              lineHeight: 1.55,
              marginBottom: "20px",
            }}
          >
            {opts.description}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            style={{
              padding: "9px 16px",
              fontSize: "12.5px",
              fontWeight: 500,
              borderRadius: "8px",
              background: "transparent",
              color: "var(--color-ink)",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
              cursor: "pointer",
            }}
          >
            {opts.cancelLabel ?? "Mégse"}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className="transition-opacity hover:opacity-90"
            style={{
              padding: "9px 18px",
              fontSize: "12.5px",
              fontWeight: 600,
              borderRadius: "8px",
              background: opts.danger ? "#c44" : "var(--color-ink)",
              color: opts.danger ? "#fff" : "var(--color-bg)",
              border: opts.danger ? "1px solid #b33" : "1px solid var(--color-ink)",
              cursor: "pointer",
            }}
          >
            {opts.confirmLabel ?? "Megerősítés"}
          </button>
        </div>
      </div>
    </div>
  );
}

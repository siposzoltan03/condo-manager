"use client";

import { useTranslations } from "next-intl";
import { X, ClipboardList } from "lucide-react";

interface AgendaItem {
  title?: string;
  description?: string;
  duration?: string;
}

interface AgendaModalProps {
  meetingTitle: string;
  agenda: unknown;
  onClose: () => void;
}

export function AgendaModal({ meetingTitle, agenda, onClose }: AgendaModalProps) {
  const t = useTranslations("voting");

  const items: AgendaItem[] = Array.isArray(agenda)
    ? agenda.map((item: unknown) => {
        if (typeof item === "string") return { title: item };
        if (typeof item === "object" && item !== null) return item as AgendaItem;
        return { title: String(item) };
      })
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "color-mix(in srgb, var(--color-ink) 50%, transparent)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div className="w-full max-w-lg bg-card rounded-xl mx-4 overflow-hidden border border-ink/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-3">
              <ClipboardList className="h-4 w-4 text-ink" />
            </div>
            <div>
              <h3 className="font-mono text-xs uppercase tracking-wider text-ink">
                {t("viewAgenda")}
              </h3>
              <p className="mt-0.5 text-xs text-muted">{meetingTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-bg-3 hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              {t("noAgenda")}
            </p>
          ) : (
            <ol className="space-y-3">
              {items.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-3 font-mono text-[11px] text-ink-soft">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink">
                      {item.title ?? `Item ${i + 1}`}
                    </p>
                    {item.description && (
                      <p className="mt-0.5 text-xs text-muted">
                        {item.description}
                      </p>
                    )}
                    {item.duration && (
                      <p className="mt-0.5 font-mono text-[11px] text-muted">
                        {item.duration}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-ink/8 bg-bg-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-ink px-5 py-2 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 transition-opacity"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

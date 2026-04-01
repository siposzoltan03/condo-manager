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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl mx-4 overflow-hidden border border-[#c4c6cf]/20">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c4c6cf]/10">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e2e7ff]">
              <ClipboardList className="h-4 w-4 text-[#002045]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#131b2e]">{t("viewAgenda")}</h3>
              <p className="text-xs text-[#515f74]">{meetingTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#43474e] hover:text-[#131b2e] p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-[#515f74] text-center py-8">No agenda items</p>
          ) : (
            <ol className="space-y-3">
              {items.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f2f3ff] text-xs font-bold text-[#002045]">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#131b2e]">
                      {item.title ?? `Item ${i + 1}`}
                    </p>
                    {item.description && (
                      <p className="text-xs text-[#515f74] mt-0.5">{item.description}</p>
                    )}
                    {item.duration && (
                      <p className="text-xs text-[#74777f] mt-0.5">{item.duration}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#c4c6cf]/10 bg-[#f2f3ff]/50 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-[#002045] px-5 py-2 text-sm font-bold text-white hover:opacity-90 transition-all"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

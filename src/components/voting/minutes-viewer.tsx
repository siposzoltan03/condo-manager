"use client";

import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText } from "lucide-react";

interface MinutesViewerProps {
  minutes: string | null;
  updatedAt: string | null;
  updatedBy: { name: string } | null;
}

export function MinutesViewer({ minutes, updatedAt, updatedBy }: MinutesViewerProps) {
  const t = useTranslations("voting");

  if (!minutes) {
    return (
      <div className="rounded-xl border border-ink/8 bg-card p-10 text-center">
        <FileText className="h-10 w-10 text-muted mx-auto mb-3" />
        <p className="text-sm text-muted">{t("noMinutes")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-xl border border-ink/8 bg-card p-6 prose prose-sm max-w-none prose-headings:font-display prose-headings:text-ink prose-p:text-ink prose-li:text-ink prose-strong:text-ink prose-a:text-ink prose-a:underline prose-code:text-ink-soft prose-code:font-mono">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{minutes}</ReactMarkdown>
      </div>
      {updatedBy && updatedAt && (
        <p className="mt-3 font-mono text-[11px] text-muted">
          {t("lastEditedBy", {
            name: updatedBy.name,
            date: new Date(updatedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </p>
      )}
    </div>
  );
}

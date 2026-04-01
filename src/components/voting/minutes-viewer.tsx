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
      <div className="rounded-xl bg-white p-8 shadow-sm border border-[#c4c6cf]/20 text-center">
        <FileText className="h-10 w-10 text-[#c4c6cf] mx-auto mb-3" />
        <p className="text-sm text-[#515f74]">{t("noMinutes")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-xl bg-white p-6 shadow-sm border border-[#c4c6cf]/20 prose prose-sm max-w-none prose-headings:text-[#002045] prose-headings:font-bold prose-p:text-[#131b2e] prose-li:text-[#131b2e] prose-strong:text-[#002045]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{minutes}</ReactMarkdown>
      </div>
      {updatedBy && updatedAt && (
        <p className="mt-3 text-xs text-[#74777f]">
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

"use client";

import { useState, useEffect } from "react";
import { X, RotateCcw, Eye } from "lucide-react";
import { useTranslations } from "next-intl";

interface Version {
  id: string;
  versionNumber: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: { id: string; name: string };
  uploadedAt: string;
}

interface DocumentDetail {
  id: string;
  title: string;
  versions: Version[];
}

interface VersionHistoryPanelProps {
  documentId: string;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function VersionHistoryPanel({ documentId, onClose }: VersionHistoryPanelProps) {
  const t = useTranslations("documents");
  const tCommon = useTranslations("common");
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDocument() {
      setLoading(true);
      try {
        const res = await fetch(`/api/documents/${documentId}`);
        if (res.ok) {
          const data = await res.json();
          setDocument(data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchDocument();
  }, [documentId]);

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel */}
      <div className="w-96 bg-white shadow-xl border-l border-slate-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">{t("versionHistory")}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Document title */}
        {document && (
          <div className="border-b border-slate-100 px-6 py-3">
            <p className="text-sm text-slate-500">{document.title}</p>
          </div>
        )}

        {/* Versions timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-slate-500">{tCommon("loading")}</p>
          ) : !document || document.versions.length === 0 ? (
            <p className="text-sm text-slate-500">{t("noVersions")}</p>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[5px] top-3 bottom-3 w-0.5 bg-slate-200" />

              <div className="space-y-6">
                {document.versions.map((version, idx) => {
                  const isCurrent = idx === 0;

                  return (
                    <div key={version.id} className="relative flex gap-4">
                      {/* Dot */}
                      <div
                        className={`relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full ${
                          isCurrent
                            ? "bg-[#002045] ring-2 ring-[#002045]/20"
                            : "bg-slate-300"
                        }`}
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm ${
                              isCurrent ? "font-bold text-slate-900" : "font-medium text-slate-700"
                            }`}
                          >
                            v{version.versionNumber}.0
                            {isCurrent && (
                              <span className="ml-1.5 text-xs font-normal text-[#002045]">
                                ({t("current")})
                              </span>
                            )}
                          </span>
                        </div>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {version.uploadedBy.name} &middot; {formatDate(version.uploadedAt)}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-400">
                          {version.fileName} ({formatFileSize(version.fileSize)})
                        </p>

                        {/* Actions */}
                        <div className="mt-2 flex items-center gap-3">
                          <button className="inline-flex items-center gap-1 text-xs font-medium text-[#002045] hover:underline">
                            <Eye className="h-3 w-3" />
                            {t("view")}
                          </button>
                          {!isCurrent && (
                            <button className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline">
                              <RotateCcw className="h-3 w-3" />
                              {t("restore")}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { FileText, Sheet } from "lucide-react";
import { useTranslations } from "next-intl";

interface LatestVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: { id: string; name: string };
  uploadedAt: string;
}

interface DocumentItem {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  uploadedBy: { id: string; name: string };
  latestVersion: LatestVersion | null;
  updatedAt: string;
}

interface DocumentTableProps {
  documents: DocumentItem[];
  onSelectDocument: (id: string) => void;
}

function getFileTypeInfo(mimeType: string): { label: string; bgClass: string; textClass: string; iconBgClass: string; iconTextClass: string } {
  if (mimeType === "application/pdf") {
    return { label: "PDF", bgClass: "bg-red-50", textClass: "text-red-700", iconBgClass: "bg-red-50", iconTextClass: "text-red-600" };
  }
  if (mimeType.includes("wordprocessingml") || mimeType.includes("msword")) {
    return { label: "DOCX", bgClass: "bg-blue-50", textClass: "text-blue-700", iconBgClass: "bg-blue-50", iconTextClass: "text-blue-600" };
  }
  if (mimeType.includes("spreadsheetml") || mimeType.includes("ms-excel")) {
    return { label: "XLSX", bgClass: "bg-green-50", textClass: "text-green-700", iconBgClass: "bg-green-50", iconTextClass: "text-green-600" };
  }
  return { label: "FILE", bgClass: "bg-slate-100", textClass: "text-slate-700", iconBgClass: "bg-slate-100", iconTextClass: "text-slate-600" };
}

function getVisibilityBadge(visibility: string): { label: string; className: string } {
  switch (visibility) {
    case "PUBLIC":
      return { label: "Public", className: "bg-green-50 text-green-700" };
    case "BOARD_ONLY":
      return { label: "Board Only", className: "bg-blue-50 text-blue-700" };
    case "ADMIN_ONLY":
      return { label: "Admin Only", className: "bg-slate-100 text-slate-700" };
    default:
      return { label: visibility, className: "bg-slate-100 text-slate-700" };
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const info = getFileTypeInfo(mimeType);
  const isSpreadsheet = mimeType.includes("spreadsheetml") || mimeType.includes("ms-excel");
  const IconComponent = isSpreadsheet ? Sheet : FileText;

  return (
    <div className={`rounded-lg p-2 ${info.iconBgClass}`}>
      <IconComponent className={`h-4 w-4 ${info.iconTextClass}`} />
    </div>
  );
}

export function DocumentTable({ documents, onSelectDocument }: DocumentTableProps) {
  const t = useTranslations("documents");

  if (documents.length === 0) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center rounded-2xl bg-white shadow-sm">
        <p className="text-slate-500">{t("noDocuments")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("columnTitle")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("columnVersion")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("columnVisibility")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("columnUploadedBy")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("columnLastUpdated")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              {t("columnType")}
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, idx) => {
            const version = doc.latestVersion;
            const mimeType = version?.mimeType ?? "application/octet-stream";
            const fileTypeInfo = getFileTypeInfo(mimeType);
            const visibilityBadge = getVisibilityBadge(doc.visibility);

            return (
              <tr
                key={doc.id}
                onClick={() => onSelectDocument(doc.id)}
                className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                  idx < documents.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                {/* Title */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <FileIcon mimeType={mimeType} />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{doc.title}</p>
                      {doc.description && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{doc.description}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Version */}
                <td className="px-4 py-4">
                  <span className="text-sm text-slate-600">
                    {version ? `v${version.versionNumber}.0` : "-"}
                  </span>
                </td>

                {/* Visibility */}
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${visibilityBadge.className}`}
                  >
                    {visibilityBadge.label}
                  </span>
                </td>

                {/* Uploaded By */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium text-slate-600">
                      {doc.uploadedBy.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <span className="text-sm text-slate-700">{doc.uploadedBy.name}</span>
                  </div>
                </td>

                {/* Last Updated */}
                <td className="px-4 py-4">
                  <span className="text-sm text-slate-500">
                    {formatDate(doc.updatedAt)}
                  </span>
                </td>

                {/* Type */}
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${fileTypeInfo.bgClass} ${fileTypeInfo.textClass}`}
                  >
                    {fileTypeInfo.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

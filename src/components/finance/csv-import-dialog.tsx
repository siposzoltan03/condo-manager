"use client";

import { useTranslations } from "next-intl";
import { useState, useRef } from "react";
import { X, Upload } from "lucide-react";
import { parseCsvLine } from "@/lib/finance/csv-import";

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (csv: string) => Promise<void>;
}

export function CsvImportDialog({ open, onClose, onSubmit }: CsvImportDialogProps) {
  const t = useTranslations("finance");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvContent, setCsvContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  if (!open) return null;

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvContent(text);
      const lines = text.split("\n").filter((l) => l.trim());
      const rows = lines.slice(0, 5).map((l) => parseCsvLine(l));
      setPreviewRows(rows);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleSubmit = async () => {
    if (!csvContent) return;
    setSubmitting(true);
    try {
      await onSubmit(csvContent);
      onClose();
      setCsvContent("");
      setFileName("");
      setPreviewRows([]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0"
        style={{
          background: "color-mix(in srgb, var(--color-ink) 50%, transparent)",
          backdropFilter: "blur(2px)",
        }}
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-xl border border-ink/10 bg-card p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">
            {t("csvImportTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-bg-3 hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors"
          style={
            dragActive
              ? {
                  background: "var(--color-bg-3)",
                  borderColor:
                    "color-mix(in srgb, var(--color-ink) 30%, transparent)",
                }
              : {
                  borderColor:
                    "color-mix(in srgb, var(--color-ink) 18%, transparent)",
                }
          }
        >
          <Upload className="mb-3 h-8 w-8 text-muted" />
          <p className="text-sm text-ink-soft">
            {fileName || t("dropCsvHere")}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Preview */}
        {previewRows.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
              {t("csvPreview")}
            </h3>
            <div className="overflow-x-auto rounded-lg border border-ink/8">
              <table className="w-full text-xs">
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr
                      key={i}
                      className={i === 0 ? "bg-bg-3" : ""}
                    >
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="border-b border-ink/5 px-3 py-1.5 font-mono text-ink-soft"
                        >
                          {cell.trim()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ink/15 bg-card px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:bg-bg-3 transition-colors"
          >
            {t("close")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!csvContent || submitting}
            className="rounded-md bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {t("csvConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

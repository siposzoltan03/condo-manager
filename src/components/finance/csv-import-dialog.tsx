"use client";

import { useTranslations } from "next-intl";
import { useState, useRef } from "react";
import { X, Upload } from "lucide-react";

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
      // Preview first 5 rows
      const lines = text.split("\n").filter((l) => l.trim());
      const rows = lines.slice(0, 5).map((l) => l.split(","));
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
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#002045]">{t("csvImportTitle")}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-[#515f74]" />
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
            dragActive ? "border-[#002045] bg-blue-50" : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <Upload className="mb-3 h-8 w-8 text-[#515f74]" />
          <p className="text-sm text-[#515f74]">
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
            <h3 className="mb-2 text-sm font-semibold text-[#002045]">{t("csvPreview")}</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className={i === 0 ? "bg-gray-50 font-semibold" : ""}>
                      {row.map((cell, j) => (
                        <td key={j} className="border-b border-gray-100 px-3 py-1.5 text-[#515f74]">
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
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-[#515f74] hover:bg-gray-50"
          >
            {t("close")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!csvContent || submitting}
            className="rounded-lg bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#003060] disabled:opacity-50"
          >
            {t("csvConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

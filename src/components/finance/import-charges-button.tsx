"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileSpreadsheet } from "lucide-react";
import { ImportDialog } from "@/components/shared/import-dialog";
import { importCharges } from "@/app/actions/finance";
import type { ImportConfig, ImportRow, ImportResult } from "@/lib/import/types";

const chargesImportConfig: ImportConfig = {
  fields: [
    { key: "unit_number", label: "Unit Number", required: true },
    {
      key: "month",
      label: "Month",
      required: true,
      validate: (v) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? null : "Must be YYYY-MM format",
    },
    {
      key: "amount",
      label: "Amount",
      required: true,
      validate: (v) => {
        const n = parseFloat(v);
        return isNaN(n) || n <= 0 ? "Must be a positive number" : null;
      },
    },
  ],
};

export function ImportChargesButton() {
  const t = useTranslations("import");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleImport(rows: ImportRow[]): Promise<ImportResult> {
    const result = await importCharges(rows);
    router.refresh();
    return result;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <FileSpreadsheet className="h-4 w-4" />
        {t("importCharges")}
      </button>
      <ImportDialog
        open={open}
        onClose={() => setOpen(false)}
        onImport={handleImport}
        config={chargesImportConfig}
        title={t("importCharges")}
        description={t("importChargesDesc")}
      />
    </>
  );
}

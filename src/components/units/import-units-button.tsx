"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileSpreadsheet } from "lucide-react";
import { ImportDialog } from "@/components/shared/import-dialog";
import { importUnits } from "@/app/actions/units";
import type { ImportConfig, ImportRow, ImportResult } from "@/lib/import/types";

const unitsImportConfig: ImportConfig = {
  fields: [
    {
      key: "unit_number",
      label: "Unit Number",
      required: true,
    },
    {
      key: "floor",
      label: "Floor",
      required: true,
      validate: (v) => (isNaN(parseInt(v, 10)) ? "Must be a number" : null),
    },
    {
      key: "size_sqm",
      label: "Size (m²)",
      required: true,
      validate: (v) => {
        const n = parseFloat(v);
        return isNaN(n) || n <= 0 ? "Must be a positive number" : null;
      },
    },
    {
      key: "ownership_share",
      label: "Ownership Share",
      required: true,
      validate: (v) => {
        const n = parseFloat(v);
        return isNaN(n) || n < 0 || n > 1 ? "Must be between 0 and 1" : null;
      },
    },
  ],
};

export function ImportUnitsButton() {
  const t = useTranslations("import");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleImport(rows: ImportRow[]): Promise<ImportResult> {
    const result = await importUnits(rows);
    router.refresh();
    return result;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-[#c4c6cf]/40 bg-white px-4 py-2.5 text-sm font-medium text-[#002045] hover:bg-[#f2f3ff] transition-colors"
      >
        <FileSpreadsheet className="h-4 w-4" />
        {t("importUnits")}
      </button>
      <ImportDialog
        open={open}
        onClose={() => setOpen(false)}
        onImport={handleImport}
        config={unitsImportConfig}
        title={t("importUnits")}
        description={t("importUnitsDesc")}
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileSpreadsheet } from "lucide-react";
import { ImportDialog } from "@/components/shared/import-dialog";
import { importAccounts } from "@/app/actions/finance";
import type { ImportConfig, ImportRow, ImportResult } from "@/lib/import/types";

const accountsImportConfig: ImportConfig = {
  fields: [
    { key: "account_name", label: "Account Name", required: true },
    {
      key: "account_type",
      label: "Account Type",
      required: true,
      validate: (v) =>
        ["ASSET", "LIABILITY", "INCOME", "EXPENSE"].includes(v.toUpperCase())
          ? null
          : "Must be ASSET, LIABILITY, INCOME, or EXPENSE",
    },
    { key: "parent_account", label: "Parent Account", required: false },
  ],
};

export function ImportAccountsButton() {
  const t = useTranslations("import");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleImport(rows: ImportRow[]): Promise<ImportResult> {
    const result = await importAccounts(rows);
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
        {t("importAccounts")}
      </button>
      <ImportDialog
        open={open}
        onClose={() => setOpen(false)}
        onImport={handleImport}
        config={accountsImportConfig}
        title={t("importAccounts")}
        description={t("importAccountsDesc")}
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileSpreadsheet } from "lucide-react";
import { ImportDialog } from "@/components/shared/import-dialog";
import { importUsers } from "@/app/actions/users";
import type { ImportConfig, ImportRow, ImportResult } from "@/lib/import/types";

const usersImportConfig: ImportConfig = {
  fields: [
    { key: "email", label: "Email", required: true, validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Invalid email" },
    { key: "name", label: "Name", required: true },
    { key: "role", label: "Role", required: true, validate: (v) => ["SUPER_ADMIN", "ADMIN", "BOARD_MEMBER", "OWNER", "TENANT"].includes(v.toUpperCase()) ? null : "Invalid role" },
    { key: "unit_number", label: "Unit Number", required: true },
    { key: "primary_contact", label: "Primary Contact", required: false },
    { key: "relationship", label: "Relationship", required: false, validate: (v) => !v || ["OWNER", "TENANT"].includes(v.toUpperCase()) ? null : "Must be OWNER or TENANT" },
  ],
};

export function ImportUsersButton() {
  const t = useTranslations("import");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleImport(rows: ImportRow[]): Promise<ImportResult> {
    const result = await importUsers(rows);
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
        {t("importUsers")}
      </button>
      <ImportDialog
        open={open}
        onClose={() => setOpen(false)}
        onImport={handleImport}
        config={usersImportConfig}
        title={t("importUsers")}
        description={t("importUsersDesc")}
      />
    </>
  );
}

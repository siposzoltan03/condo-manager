"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteUnit } from "@/app/actions/units";

interface DeleteUnitButtonProps {
  unitId: string;
  hasUsers: boolean;
}

export function DeleteUnitButton({ unitId, hasUsers }: DeleteUnitButtonProps) {
  const t = useTranslations("common");
  const tUnits = useTranslations("units");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setError("");
    const result = await deleteUnit(unitId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (error) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-[#93000a]">{error}</span>
        <button
          onClick={() => setError("")}
          className="rounded-md px-2 py-1 text-xs font-medium text-[#515f74] hover:bg-[#f2f3ff] transition-colors"
        >
          {t("cancel")}
        </button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          className="rounded-md px-2 py-1 text-xs font-medium text-[#93000a] hover:bg-[#ffdad6] transition-colors"
        >
          {t("delete")}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-md px-2 py-1 text-xs font-medium text-[#515f74] hover:bg-[#f2f3ff] transition-colors"
        >
          {t("cancel")}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      disabled={hasUsers}
      className="rounded-md p-2 text-[#515f74] hover:text-[#ba1a1a] disabled:text-[#c4c6cf]/30 disabled:cursor-not-allowed transition-colors"
      title={hasUsers ? tUnits("unitHasUsers") : tUnits("deleteUnit")}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

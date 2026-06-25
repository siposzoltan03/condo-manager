"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { NewComplaintModal } from "./new-complaint-modal";
import { ManageCategoriesModal } from "./manage-categories-modal";
import type { ComplaintCategoryRef } from "@/lib/dal";

interface UnitOption {
  id: string;
  number: string;
  stairwell: string | null;
  floor: number;
}

interface Props {
  isBoardPlus: boolean;
  locale: string;
  categories: ComplaintCategoryRef[];
  units: UnitOption[];
}

export function ComplaintsHeaderActions({
  isBoardPlus,
  locale,
  categories,
  units,
}: Props) {
  const t = useTranslations("complaints.actions");
  const [open, setOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {isBoardPlus && (
        <button
          type="button"
          onClick={() => setCatsOpen(true)}
          className="transition-opacity hover:opacity-90"
          style={{
            padding: "9px 14px",
            fontSize: "12.5px",
            fontWeight: 500,
            borderRadius: "8px",
            background: "transparent",
            color: "var(--color-ink)",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
            cursor: "pointer",
          }}
        >
          {t("manageCategories")}
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="transition-opacity hover:opacity-90"
        style={{
          padding: "9px 16px",
          fontSize: "12.5px",
          fontWeight: 600,
          borderRadius: "8px",
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          border: "1px solid var(--color-ink)",
          cursor: "pointer",
        }}
      >
        + {t("newComplaint")}
      </button>

      <NewComplaintModal
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
        units={units}
        locale={locale}
      />

      <ManageCategoriesModal
        open={catsOpen}
        onClose={() => setCatsOpen(false)}
      />
    </div>
  );
}

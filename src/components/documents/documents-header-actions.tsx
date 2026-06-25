"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UploadDocumentModal } from "./upload-document-modal";
import { NewCategoryModal } from "./new-category-modal";

interface CategoryOption {
  id: string;
  name: string;
  isChild: boolean;
}

interface Props {
  isBoardPlus: boolean;
  isAdminPlus: boolean;
  categories: CategoryOption[];
  defaultCategoryId?: string | null;
}

export function DocumentsHeaderActions({
  isBoardPlus,
  isAdminPlus,
  categories,
  defaultCategoryId,
}: Props) {
  const t = useTranslations("documents");
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  if (!isBoardPlus) return null;

  return (
    <>
      {isAdminPlus && (
        <button
          type="button"
          onClick={() => setCategoryOpen(true)}
          className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
          style={{
            padding: "9px 14px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            background: "var(--color-card)",
            color: "var(--color-ink)",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
            cursor: "pointer",
          }}
        >
          <FolderPlusIcon />
          {t("actions.newFolder")}
        </button>
      )}
      <button
        type="button"
        onClick={() => setUploadOpen(true)}
        className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
        style={{
          padding: "9px 14px",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 600,
          background: "var(--color-ink)",
          color: "var(--color-bg)",
          border: "1px solid var(--color-ink)",
          cursor: "pointer",
        }}
      >
        <UploadIcon />
        {t("actions.upload")}
      </button>

      <UploadDocumentModal
        open={uploadOpen}
        categories={categories}
        defaultCategoryId={defaultCategoryId ?? null}
        onClose={() => setUploadOpen(false)}
        onCreated={() => {
          setUploadOpen(false);
          router.refresh();
        }}
      />
      <NewCategoryModal
        open={categoryOpen}
        parents={categories}
        onClose={() => setCategoryOpen(false)}
        onCreated={() => {
          setCategoryOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

function FolderPlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 11v6M9 14h6" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}

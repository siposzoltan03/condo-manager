"use client";

import {
  Gavel,
  FileText,
  Users,
  Wallet,
  ShieldCheck,
  Upload,
  Archive,
  Trash2,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { RoleGuard } from "@/components/auth/role-guard";

interface CategoryChild {
  id: string;
  name: string;
  icon: string | null;
  documentCount: number;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  documentCount: number;
  children: CategoryChild[];
}

interface CategorySidebarProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  onUploadClick: () => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  gavel: Gavel,
  description: FileText,
  groups: Users,
  payments: Wallet,
  verified_user: ShieldCheck,
  folder: FolderOpen,
};

function getCategoryIcon(iconName: string | null): React.ComponentType<{ className?: string }> {
  if (iconName && ICON_MAP[iconName]) {
    return ICON_MAP[iconName];
  }
  return FolderOpen;
}

export function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onUploadClick,
}: CategorySidebarProps) {
  const t = useTranslations("documents");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="px-4 py-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          {t("categories")}
        </h2>
      </div>

      {/* Category tree */}
      <nav className="flex-1 overflow-y-auto px-2">
        {/* All Documents */}
        <button
          onClick={() => onSelectCategory(null)}
          className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
            selectedCategoryId === null
              ? "bg-white font-bold text-slate-900 shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span>{t("allDocuments")}</span>
        </button>

        {categories.map((cat) => {
          const Icon = getCategoryIcon(cat.icon);
          const isActive = selectedCategoryId === cat.id;
          const isExpanded = expandedIds.has(cat.id);
          const hasChildren = cat.children.length > 0;

          return (
            <div key={cat.id}>
              <div className="flex items-center">
                {hasChildren && (
                  <button
                    onClick={() => toggleExpanded(cat.id)}
                    className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600"
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                )}
                <button
                  onClick={() => onSelectCategory(cat.id)}
                  className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    !hasChildren ? "ml-5" : ""
                  } ${
                    isActive
                      ? "bg-white font-bold text-slate-900 shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{cat.name}</span>
                  <span className="text-xs text-slate-400">{cat.documentCount}</span>
                </button>
              </div>

              {/* Children */}
              {hasChildren && isExpanded && (
                <div className="ml-9 mt-0.5 space-y-0.5">
                  {cat.children.map((child) => {
                    const isChildActive = selectedCategoryId === child.id;
                    return (
                      <button
                        key={child.id}
                        onClick={() => onSelectCategory(child.id)}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors ${
                          isChildActive
                            ? "bg-white font-bold text-slate-900 shadow-sm"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        }`}
                      >
                        <span className="flex-1 text-left">{child.name}</span>
                        <span className="text-xs text-slate-400">{child.documentCount}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Upload button */}
      <div className="border-t border-slate-200 p-3">
        <RoleGuard role="BOARD_MEMBER">
          <button
            onClick={onUploadClick}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#002045] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#001530]"
          >
            <Upload className="h-4 w-4" />
            {t("uploadDocument")}
          </button>
        </RoleGuard>

        {/* Archive & Trash links */}
        <div className="mt-3 flex items-center justify-center gap-4">
          <button className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
            <Archive className="h-3.5 w-3.5" />
            {t("archive")}
          </button>
          <button className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
            <Trash2 className="h-3.5 w-3.5" />
            {t("trash")}
          </button>
        </div>
      </div>
    </div>
  );
}

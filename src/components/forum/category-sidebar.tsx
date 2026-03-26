"use client";

import { useTranslations } from "next-intl";
import {
  MessageSquare,
  Wrench,
  HelpCircle,
  Megaphone,
  Users,
  Leaf,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  topicCount: number;
}

interface CategorySidebarProps {
  categories: Category[];
  activeCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  onNewTopic: () => void;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  General: MessageSquare,
  Maintenance: Wrench,
  Questions: HelpCircle,
  Announcements: Megaphone,
  Community: Users,
  "Green Living": Leaf,
};

function getCategoryIcon(name: string) {
  return CATEGORY_ICONS[name] ?? MessageSquare;
}

export function CategorySidebar({
  categories,
  activeCategoryId,
  onCategoryChange,
  onNewTopic,
}: CategorySidebarProps) {
  const t = useTranslations("forum");

  const totalTopics = categories.reduce((sum, c) => sum + c.topicCount, 0);

  return (
    <div className="w-64 shrink-0">
      <h3 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-slate-400">
        {t("categories")}
      </h3>

      <div className="space-y-1">
        {/* All Categories */}
        <button
          onClick={() => onCategoryChange(null)}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            activeCategoryId === null
              ? "bg-white text-[#002045] shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{t("allCategories")}</span>
          <span className="text-xs text-slate-400">{totalTopics}</span>
        </button>

        {categories.map((category) => {
          const Icon = getCategoryIcon(category.name);
          const isActive = activeCategoryId === category.id;
          return (
            <button
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-[#002045] shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{category.name}</span>
              <span className="text-xs text-slate-400">{category.topicCount}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onNewTopic}
        className="mt-6 w-full rounded-xl bg-[#002045] px-4 py-3 text-sm font-medium text-white hover:bg-[#001530] transition-colors"
      >
        {t("newDiscussion")}
      </button>
    </div>
  );
}

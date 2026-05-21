"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, GripVertical, Trash2 } from "lucide-react";

export interface AgendaItem {
  title: string;
  description: string;
}

interface AgendaEditorProps {
  items: AgendaItem[];
  onChange: (items: AgendaItem[]) => void;
}

export function AgendaEditor({ items, onChange }: AgendaEditorProps) {
  const t = useTranslations("voting");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function addItem() {
    onChange([...items, { title: "", description: "" }]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof AgendaItem, value: string) {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChange(updated);
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    const reordered = [...items];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    onChange(reordered);
    setDragIndex(index);
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  return (
    <div className="space-y-3">
      <label className="block font-mono text-[11px] uppercase tracking-wider text-muted">
        {t("agendaTitle")}
      </label>

      {items.length === 0 && (
        <p className="text-sm text-muted">{t("noAgenda")}</p>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className="flex items-start gap-2 rounded-lg border p-3 transition-colors"
            style={
              dragIndex === index
                ? {
                    background: "var(--color-bg-3)",
                    borderColor:
                      "color-mix(in srgb, var(--color-ink) 25%, transparent)",
                  }
                : {
                    background: "var(--color-card)",
                    borderColor:
                      "color-mix(in srgb, var(--color-ink) 10%, transparent)",
                  }
            }
          >
            <div
              className="mt-2 cursor-grab transition-colors"
              style={{ color: "var(--color-muted)" }}
            >
              <GripVertical className="h-4 w-4" />
            </div>

            <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-3 font-mono text-[11px] text-ink-soft">
              {index + 1}
            </span>

            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateItem(index, "title", e.target.value)}
                placeholder={t("agendaItemTitle")}
                className="w-full rounded-md border border-ink/10 bg-card px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-ink/40 focus:outline-none"
              />
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateItem(index, "description", e.target.value)}
                placeholder={t("agendaItemDescription")}
                className="w-full rounded-md border border-ink/8 bg-card px-3 py-1.5 text-xs text-ink-soft placeholder:text-muted focus:border-ink/40 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => removeItem(index)}
              className="mt-2 rounded p-1 transition-colors"
              style={{ color: "var(--color-muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--color-danger)";
                e.currentTarget.style.background =
                  "color-mix(in srgb, var(--color-danger) 12%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--color-muted)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ink/20 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted hover:border-ink hover:text-ink transition-colors"
      >
        <Plus className="h-4 w-4" />
        {t("addAgendaItem")}
      </button>
    </div>
  );
}

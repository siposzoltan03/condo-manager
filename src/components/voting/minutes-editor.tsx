"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveMinutes } from "@/app/actions/voting";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface MinutesEditorProps {
  meetingId: string;
  initialMinutes: string | null;
  updatedAt: string | null;
  updatedBy: { name: string } | null;
  meetingTitle?: string;
  meetingDate?: string;
  agenda?: unknown[];
}

function buildTemplate(title: string, date: string, agenda: unknown[]): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push(`**${date}**`);
  lines.push("");
  lines.push("## Jelenlévők");
  lines.push("");
  lines.push("");

  if (agenda.length > 0) {
    agenda.forEach((item, i) => {
      const itemTitle =
        typeof item === "string"
          ? item
          : (item as Record<string, unknown>)?.title ?? `${i + 1}. napirendi pont`;
      lines.push(`## ${i + 1}. ${String(itemTitle)}`);
      lines.push("");
      lines.push("");
    });
  }

  lines.push("## Határozatok");
  lines.push("");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("*A jegyzőkönyvet hitelesítette:*");
  lines.push("");

  return lines.join("\n");
}

export function MinutesEditor({
  meetingId,
  initialMinutes,
  updatedAt,
  updatedBy,
  meetingTitle,
  meetingDate,
  agenda,
}: MinutesEditorProps) {
  const t = useTranslations("voting");

  const template =
    !initialMinutes && meetingTitle && meetingDate && agenda && agenda.length > 0
      ? buildTemplate(meetingTitle, meetingDate, agenda)
      : null;

  const [value, setValue] = useState(initialMinutes ?? template ?? "");
  const [saving, setSaving] = useState(false);

  const hasChanges = value !== (initialMinutes ?? "");

  async function handleSave() {
    setSaving(true);

    const result = await saveMinutes(meetingId, value);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("minutesSaved"));
    }
    setSaving(false);
  }

  function handleCancel() {
    setValue(initialMinutes ?? "");
  }

  return (
    <div>
      {/* Markdown badge */}
      <div className="flex items-center justify-end mb-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-3 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--color-ink)" }}
          />
          Markdown
        </span>
      </div>

      {/* Editor container */}
      <div
        className="minutes-editor-wrap rounded-xl border border-ink/8 overflow-hidden"
        data-color-mode="light"
      >
        {/* Pane labels — desktop split view only. The MDEditor below
            stacks into a single pane on narrow viewports, so the dual
            labels would mislead. */}
        <div className="hidden sm:grid sm:grid-cols-2 bg-bg-3 border-b border-ink/8">
          <div className="px-4 py-2 border-r border-ink/8">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
              Markdown editor
            </span>
          </div>
          <div className="px-4 py-2">
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
              Live preview
            </span>
          </div>
        </div>

        <MDEditor
          value={value}
          onChange={(v) => setValue(v ?? "")}
          height={440}
          preview="live"
          visibleDragbar={false}
          toolbarBottom={false}
        />
      </div>

      <style jsx global>{`
        .minutes-editor-wrap .w-md-editor {
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          background: var(--color-card) !important;
        }

        /* Toolbar styling — full width, single clean row */
        .minutes-editor-wrap .w-md-editor-toolbar {
          background: var(--color-card) !important;
          border-bottom: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent) !important;
          padding: 4px 10px !important;
          min-height: auto !important;
        }

        /* Hide the right-side toolbar group (fullscreen, preview toggles) */
        .minutes-editor-wrap .w-md-editor-toolbar > ul:last-child {
          display: none !important;
        }

        .minutes-editor-wrap .w-md-editor-toolbar li > button {
          color: var(--color-muted) !important;
          height: 24px !important;
          width: 24px !important;
          padding: 2px !important;
          margin: 0 1px !important;
        }
        .minutes-editor-wrap .w-md-editor-toolbar li > button:hover {
          color: var(--color-ink) !important;
          background: var(--color-bg-3) !important;
          border-radius: 4px !important;
        }
        .minutes-editor-wrap .w-md-editor-toolbar li > button svg {
          width: 14px !important;
          height: 14px !important;
        }

        /* Divider between editor and preview panes */
        .minutes-editor-wrap .w-md-editor-content > .w-md-editor-preview {
          border-left: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent) !important;
          background: var(--color-card) !important;
        }

        /* Editor font — apply to BOTH layers equally to keep cursor aligned */
        .minutes-editor-wrap .w-md-editor-text-input,
        .minutes-editor-wrap .w-md-editor-text-pre > code,
        .minutes-editor-wrap .w-md-editor-text {
          font-family: var(--font-mono), ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace !important;
          font-size: 13px !important;
          line-height: 1.75 !important;
          color: var(--color-ink) !important;
        }

        /* Preview pane styling */
        .minutes-editor-wrap .w-md-editor-preview {
          padding: 16px 20px !important;
        }

        /* Prose styling for preview markdown */
        .minutes-editor-wrap .wmde-markdown {
          font-size: 14px !important;
          color: var(--color-ink) !important;
          line-height: 1.7 !important;
          background: var(--color-card) !important;
        }
        .minutes-editor-wrap .wmde-markdown h1,
        .minutes-editor-wrap .wmde-markdown h2,
        .minutes-editor-wrap .wmde-markdown h3 {
          color: var(--color-ink) !important;
          font-family: var(--font-display), sans-serif !important;
          border-bottom: none !important;
        }
        .minutes-editor-wrap .wmde-markdown strong {
          color: var(--color-ink) !important;
        }
        .minutes-editor-wrap .wmde-markdown ul,
        .minutes-editor-wrap .wmde-markdown ol {
          padding-left: 1.5em !important;
        }
      `}</style>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <div className="font-mono text-[11px] text-muted">
          {updatedBy && updatedAt && (
            <span>
              {t("lastEditedBy", {
                name: updatedBy.name,
                date: new Date(updatedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {hasChanges && (
            <button
              onClick={handleCancel}
              className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-ink transition-colors"
            >
              {t("cancelChanges")}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("savingMinutes")}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {t("saveMinutes")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

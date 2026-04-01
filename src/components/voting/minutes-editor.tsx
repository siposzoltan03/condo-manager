"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Save, Loader2, Check } from "lucide-react";
import { saveMinutes } from "@/app/actions/voting";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface MinutesEditorProps {
  meetingId: string;
  initialMinutes: string | null;
  updatedAt: string | null;
  updatedBy: { name: string } | null;
}

export function MinutesEditor({
  meetingId,
  initialMinutes,
  updatedAt,
  updatedBy,
}: MinutesEditorProps) {
  const t = useTranslations("voting");
  const [value, setValue] = useState(initialMinutes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    const result = await saveMinutes(meetingId, value);

    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="rounded-xl bg-white shadow-sm border border-[#c4c6cf]/20 overflow-hidden" data-color-mode="light">
        <MDEditor
          value={value}
          onChange={(v) => setValue(v ?? "")}
          height={500}
          preview="live"
        />
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-[#ffdad6] px-4 py-2 text-sm text-[#93000a]">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-[#74777f]">
          {updatedBy && updatedAt
            ? t("lastEditedBy", {
                name: updatedBy.name,
                date: new Date(updatedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })
            : null}
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
              <Check className="h-4 w-4" />
              {t("minutesSaved")}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#002045] px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all"
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

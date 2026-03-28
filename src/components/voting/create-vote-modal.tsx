"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X, Plus, Trash2 } from "lucide-react";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateVoteModal({ onClose, onCreated }: Props) {
  const t = useTranslations("voting");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [voteType, setVoteType] = useState("YES_NO");
  const [isSecret, setIsSecret] = useState(false);
  const [quorumRequired, setQuorumRequired] = useState("51");
  const [deadline, setDeadline] = useState("");
  const [options, setOptions] = useState([
    { label: "Yes" },
    { label: "No" },
    { label: "Abstain" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function addOption() {
    setOptions([...options, { label: "" }]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  }

  function updateOption(index: number, label: string) {
    const updated = [...options];
    updated[index] = { label };
    setOptions(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title || !deadline || options.some((o) => !o.label.trim())) {
      setError(t("missingFields"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/voting/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          voteType,
          isSecret,
          quorumRequired: Number(quorumRequired) / 100,
          deadline,
          options: options.map((o) => ({ label: o.label.trim() })),
        }),
      });

      if (res.ok) {
        onCreated();
      } else {
        const data = await res.json();
        setError(data.error || t("createFailed"));
      }
    } catch {
      setError(t("createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#002045]">{t("createVote")}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              {t("voteTitle")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              {t("description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                {t("voteTypeLabel")}
              </label>
              <select
                value={voteType}
                onChange={(e) => setVoteType(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              >
                <option value="YES_NO">{t("voteType_YES_NO")}</option>
                <option value="MULTIPLE_CHOICE">{t("voteType_MULTIPLE_CHOICE")}</option>
                <option value="RANKED_CHOICE">{t("voteType_RANKED_CHOICE")}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                {t("quorumLabel")} (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={quorumRequired}
                onChange={(e) => setQuorumRequired(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              {t("deadline")}
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isSecret"
              checked={isSecret}
              onChange={(e) => setIsSecret(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#002045] focus:ring-[#002045]"
            />
            <label htmlFor="isSecret" className="text-sm text-slate-700">
              {t("secretBallotToggle")}
            </label>
          </div>

          {/* Options */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              {t("options")}
            </label>
            <div className="mt-2 space-y-2">
              {options.map((opt, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`${t("optionLabel")} ${index + 1}`}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addOption}
              className="mt-2 flex items-center gap-1 text-sm text-[#002045] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("addOption")}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#002045]/90 disabled:opacity-50"
            >
              {submitting ? t("creating") : t("createVote")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

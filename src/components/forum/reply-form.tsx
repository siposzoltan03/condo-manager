"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Send, X } from "lucide-react";

interface ReplyFormProps {
  topicId: string;
  parentReplyId?: string | null;
  parentAuthorName?: string;
  isLocked: boolean;
  onSuccess: () => void;
  onCancelReply?: () => void;
}

export function ReplyForm({
  topicId,
  parentReplyId,
  parentAuthorName,
  isLocked,
  onSuccess,
  onCancelReply,
}: ReplyFormProps) {
  const t = useTranslations("forum");
  const tCommon = useTranslations("common");

  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (isLocked) {
    return (
      <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">
        {t("topicLocked")}
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/forum/topics/${topicId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim(),
          parentReplyId: parentReplyId ?? undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to post reply");
      }

      setBody("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {parentReplyId && parentAuthorName && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>{t("replyTo", { name: parentAuthorName })}</span>
          <button
            type="button"
            onClick={onCancelReply}
            className="rounded p-0.5 hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("replyPlaceholder")}
          rows={3}
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
        />
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="self-end rounded-xl bg-[#002045] p-3 text-white hover:bg-[#001530] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

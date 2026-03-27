"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Send, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface CommentData {
  id: string;
  body: string;
  isInternal: boolean;
  author: { id: string; name: string };
  createdAt: string;
}

interface CommentsThreadProps {
  ticketId: string;
  comments: CommentData[];
  onCommentAdded: () => void;
}

export function CommentsThread({
  ticketId,
  comments,
  onCommentAdded,
}: CommentsThreadProps) {
  const t = useTranslations("maintenance");
  const tCommon = useTranslations("common");
  const { hasRole } = useAuth();
  const isBoardPlus = hasRole("BOARD_MEMBER");

  const [commentBody, setCommentBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: commentBody.trim(),
          isInternal: isBoardPlus ? isInternal : false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || tCommon("error"));
        return;
      }

      setCommentBody("");
      setIsInternal(false);
      onCommentAdded();
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold text-[#002045]">
        {t("comments")}
      </h3>

      {comments.length === 0 && (
        <p className="mb-4 text-sm text-slate-500">{t("noComments")}</p>
      )}

      <div className="mb-6 space-y-3">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={`rounded-lg p-4 ${
              comment.isInternal
                ? "border-l-4 border-amber-400 bg-amber-50"
                : "bg-white border border-slate-200"
            }`}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">
                {comment.author.name}
              </span>
              {comment.isInternal && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                  <ShieldAlert className="h-3 w-3" />
                  {t("internalNote")}
                </span>
              )}
              <span className="text-xs text-slate-500">
                {new Date(comment.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {comment.body}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
        {error && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
          placeholder={t("addCommentPlaceholder")}
        />
        <div className="mt-3 flex items-center justify-between">
          <div>
            {isBoardPlus && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                {t("internalWarning")}
              </label>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !commentBody.trim()}
            className="flex items-center gap-2 rounded-md bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#002045]/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {loading ? tCommon("loading") : t("addComment")}
          </button>
        </div>
      </form>
    </div>
  );
}

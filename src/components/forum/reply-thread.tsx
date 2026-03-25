"use client";

import { useTranslations } from "next-intl";
import { Reply } from "lucide-react";

interface ReplyItem {
  id: string;
  body: string;
  author: { name: string; role: string };
  authorId: string;
  parentReplyId: string | null;
  createdAt: string;
}

interface ReplyThreadProps {
  replies: ReplyItem[];
  onReplyTo: (replyId: string, authorName: string) => void;
  isLocked: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  BOARD_MEMBER: "Board Member",
  RESIDENT: "Resident",
  TENANT: "Tenant",
};

function ReplyCard({
  reply,
  isChild,
  onReplyTo,
  isLocked,
}: {
  reply: ReplyItem;
  isChild: boolean;
  onReplyTo: (replyId: string, authorName: string) => void;
  isLocked: boolean;
}) {
  const t = useTranslations("forum");

  return (
    <div className={`${isChild ? "ml-10 border-l-2 border-slate-200 pl-4" : ""}`}>
      <div className="rounded-2xl bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a365d] text-xs font-bold text-white">
            {getInitials(reply.author.name)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">
              {reply.author.name}
            </span>
            <span className="text-xs text-slate-400">
              {ROLE_LABELS[reply.author.role] ?? reply.author.role}
            </span>
            <span className="text-xs text-slate-400">
              {formatTimeAgo(reply.createdAt)}
            </span>
          </div>
        </div>
        <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
          {reply.body}
        </div>
        {!isLocked && (
          <button
            onClick={() => onReplyTo(reply.id, reply.author.name)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-[#002045] transition-colors"
          >
            <Reply className="h-3.5 w-3.5" />
            {t("reply")}
          </button>
        )}
      </div>
    </div>
  );
}

export function ReplyThread({ replies, onReplyTo, isLocked }: ReplyThreadProps) {
  const t = useTranslations("forum");

  if (replies.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        {t("noReplies")}
      </div>
    );
  }

  // Build a simple tree: top-level replies first, then children grouped under parents
  const topLevel = replies.filter((r) => !r.parentReplyId);
  const childMap = new Map<string, ReplyItem[]>();
  for (const reply of replies) {
    if (reply.parentReplyId) {
      const children = childMap.get(reply.parentReplyId) ?? [];
      children.push(reply);
      childMap.set(reply.parentReplyId, children);
    }
  }

  return (
    <div className="space-y-3">
      {topLevel.map((reply) => {
        const children = childMap.get(reply.id) ?? [];
        return (
          <div key={reply.id} className="space-y-2">
            <ReplyCard
              reply={reply}
              isChild={false}
              onReplyTo={onReplyTo}
              isLocked={isLocked}
            />
            {children.map((child) => (
              <ReplyCard
                key={child.id}
                reply={child}
                isChild={true}
                onReplyTo={onReplyTo}
                isLocked={isLocked}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatConversationTime } from "@/lib/format-time";

interface ConversationItemProps {
  id: string;
  name: string | null;
  type: "DIRECT" | "GROUP";
  otherParticipants: { id: string; name: string }[];
  lastMessage: {
    body: string;
    senderName: string;
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  isActive: boolean;
  currentUserId: string;
  onClick: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ConversationItem({
  name,
  type,
  otherParticipants,
  lastMessage,
  unreadCount,
  isActive,
  currentUserId,
  onClick,
}: ConversationItemProps) {
  const t = useTranslations("messages");
  const locale = useLocale();

  const displayName =
    type === "GROUP"
      ? name || otherParticipants.map((p) => p.name).join(", ")
      : otherParticipants.map((p) => p.name).join(", ") || "Unknown";

  const initials =
    type === "GROUP"
      ? (name?.[0]?.toUpperCase() ?? "G")
      : getInitials(otherParticipants[0]?.name ?? "?");

  const lastMessagePreview = lastMessage
    ? lastMessage.senderId === currentUserId
      ? `${t("you")}: ${lastMessage.body}`
      : lastMessage.body
    : null;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-slate-50 ${
        isActive ? "bg-[#f2f3ff]" : ""
      }`}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1a365d] text-white flex items-center justify-center text-sm font-semibold">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span
            className={`text-sm truncate ${
              unreadCount > 0 ? "font-bold text-slate-900" : "font-semibold text-slate-700"
            }`}
          >
            {displayName}
          </span>
          {lastMessage && (
            <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
              {formatConversationTime(lastMessage.createdAt, locale)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          {lastMessagePreview ? (
            <p className="text-sm text-slate-500 truncate">
              {lastMessagePreview}
            </p>
          ) : (
            <p className="text-sm text-slate-400 italic truncate">
              {t("noMessagesYet")}
            </p>
          )}
          {unreadCount > 0 && (
            <span className="flex-shrink-0 ml-2 bg-[#002045] text-white text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

"use client";

import { useLocale } from "next-intl";

interface MessageBubbleProps {
  body: string;
  senderName: string;
  senderId: string;
  currentUserId: string;
  createdAt: string;
  showSender: boolean;
}

function formatMessageTime(dateString: string, locale: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({
  body,
  senderName,
  senderId,
  currentUserId,
  createdAt,
  showSender,
}: MessageBubbleProps) {
  const locale = useLocale();
  const isOwn = senderId === currentUserId;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-1`}>
      <div
        className={`max-w-[70%] ${
          isOwn ? "items-end" : "items-start"
        }`}
      >
        {showSender && !isOwn && (
          <p className="text-xs text-slate-500 mb-1 ml-3">{senderName}</p>
        )}
        <div
          className={`px-4 py-2 ${
            isOwn
              ? "bg-[#002045] text-white rounded-2xl rounded-br-sm"
              : "bg-[#f2f3ff] text-[#131b2e] rounded-2xl rounded-bl-sm"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{body}</p>
        </div>
        <p
          className={`text-xs text-slate-400 mt-0.5 ${
            isOwn ? "text-right mr-1" : "ml-3"
          }`}
        >
          {formatMessageTime(createdAt, locale)}
        </p>
      </div>
    </div>
  );
}

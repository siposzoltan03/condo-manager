"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { formatDateSeparator } from "@/lib/format-time";

interface MessageData {
  id: string;
  body: string;
  senderId: string;
  sender: { id: string; name: string };
  createdAt: string;
}

interface ParticipantData {
  id: string;
  name: string;
}

interface MessageThreadProps {
  conversationId: string;
  currentUserId: string;
  otherParticipants: ParticipantData[];
  conversationName: string | null;
  conversationType: "DIRECT" | "GROUP";
}

function isSameDay(d1: string, d2: string): boolean {
  const a = new Date(d1);
  const b = new Date(d2);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function MessageThread({
  conversationId,
  currentUserId,
  otherParticipants,
  conversationName,
  conversationType,
}: MessageThreadProps) {
  const t = useTranslations("messages");
  const locale = useLocale();
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName =
    conversationType === "GROUP"
      ? conversationName || otherParticipants.map((p) => p.name).join(", ")
      : otherParticipants.map((p) => p.name).join(", ") || "Unknown";

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/messages/conversations/${conversationId}/messages?limit=100`
      );
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Mark as read
  const markAsRead = useCallback(async () => {
    try {
      await fetch(
        `/api/messages/conversations/${conversationId}/read`,
        { method: "POST" }
      );
    } catch {
      // Silently handle
    }
  }, [conversationId]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    fetchMessages();
    markAsRead();
  }, [conversationId, fetchMessages, markAsRead]);

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async (body: string) => {
    const res = await fetch(
      `/api/messages/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      }
    );
    if (!res.ok) throw new Error("Failed to send message");
    const newMessage = await res.json();
    setMessages((prev) => [...prev, newMessage]);
    markAsRead();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <div className="w-10 h-10 rounded-full bg-[#1a365d] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
          {conversationType === "GROUP"
            ? (conversationName?.[0]?.toUpperCase() ?? "G")
            : (otherParticipants[0]?.name ?? "?")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">{displayName}</h2>
          {conversationType === "GROUP" && (
            <p className="text-xs text-slate-500">
              {otherParticipants.map((p) => p.name).join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-400">{t("loadingMessages")}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-400">{t("messagePlaceholder")}</p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const showDateSeparator =
                !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
              const showSender =
                conversationType === "GROUP" &&
                msg.senderId !== currentUserId &&
                (!prevMsg || prevMsg.senderId !== msg.senderId || showDateSeparator);

              return (
                <div key={msg.id}>
                  {showDateSeparator && (
                    <div className="flex items-center justify-center my-4">
                      <span className="text-xs text-slate-400 bg-white px-3">
                        {formatDateSeparator(msg.createdAt, locale)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    body={msg.body}
                    senderName={msg.sender.name}
                    senderId={msg.senderId}
                    currentUserId={currentUserId}
                    createdAt={msg.createdAt}
                    showSender={showSender}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <MessageInput onSend={handleSend} />
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { ConversationItem } from "./conversation-item";

export interface ConversationData {
  id: string;
  type: "DIRECT" | "GROUP";
  name: string | null;
  otherParticipants: { id: string; name: string }[];
  lastMessage: {
    id: string;
    body: string;
    senderName: string;
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
  createdAt: string;
}

interface ConversationListProps {
  conversations: ConversationData[];
  activeConversationId: string | null;
  currentUserId: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function ConversationList({
  conversations,
  activeConversationId,
  currentUserId,
  search,
  onSearchChange,
  onSelectConversation,
  onNewConversation,
}: ConversationListProps) {
  const t = useTranslations("messages");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <button
          onClick={onNewConversation}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-[#002045] rounded-lg hover:bg-[#001a38] transition-colors"
        >
          {t("newMessage")}
        </button>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-500">{t("noConversations")}</p>
            <p className="text-xs text-slate-400 mt-1">
              {t("noConversationsDesc")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                id={conv.id}
                name={conv.name}
                type={conv.type}
                otherParticipants={conv.otherParticipants}
                lastMessage={conv.lastMessage}
                unreadCount={conv.unreadCount}
                isActive={conv.id === activeConversationId}
                currentUserId={currentUserId}
                onClick={() => onSelectConversation(conv.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

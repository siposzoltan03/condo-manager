"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ConversationList, ConversationData } from "./conversation-list";
import { MessageThread } from "./message-thread";
import { NewConversationModal } from "./new-conversation-modal";

export function MessagesPage() {
  const t = useTranslations("messages");
  const tCommon = useTranslations("common");
  const { user, isLoading: authLoading } = useAuth();

  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/messages/conversations${search ? `?search=${encodeURIComponent(search)}` : ""}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Poll for conversation list updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
  };

  const handleConversationCreated = (conversationId: string) => {
    setShowNewModal(false);
    setActiveConversationId(conversationId);
    fetchConversations();
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-500">{tCommon("loading")}</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <div className="flex h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Left panel - Conversation list */}
        <div className="w-80 border-r border-slate-200 flex-shrink-0">
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            currentUserId={user.id}
            search={search}
            onSearchChange={setSearch}
            onSelectConversation={handleSelectConversation}
            onNewConversation={() => setShowNewModal(true)}
          />
        </div>

        {/* Right panel - Message thread or empty state */}
        <div className="flex-1 flex flex-col">
          {activeConversation ? (
            <MessageThread
              conversationId={activeConversation.id}
              currentUserId={user.id}
              otherParticipants={activeConversation.otherParticipants}
              conversationName={activeConversation.name}
              conversationType={activeConversation.type}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700">
                {t("selectConversation")}
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                {t("selectConversationDesc")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New conversation modal */}
      {showNewModal && (
        <NewConversationModal
          currentUserId={user.id}
          onClose={() => setShowNewModal(false)}
          onCreated={handleConversationCreated}
        />
      )}
    </div>
  );
}

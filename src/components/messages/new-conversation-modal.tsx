"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { X, Search } from "lucide-react";

interface UserResult {
  id: string;
  name: string;
  unitNumber: string | null;
}

interface NewConversationModalProps {
  currentUserId: string;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export function NewConversationModal({
  currentUserId,
  onClose,
  onCreated,
}: NewConversationModalProps) {
  const t = useTranslations("messages");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGroup = selectedUsers.length > 1;

  const searchUsers = useCallback(async () => {
    if (!search.trim()) {
      setUsers([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/messages/users?search=${encodeURIComponent(search)}&limit=10`
      );
      if (!res.ok) return;
      const data = await res.json();
      // Filter out current user and already selected
      const selectedIds = new Set(selectedUsers.map((u) => u.id));
      setUsers(
        (data.users ?? []).filter(
          (u: UserResult) => u.id !== currentUserId && !selectedIds.has(u.id)
        )
      );
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [search, currentUserId, selectedUsers]);

  useEffect(() => {
    const timeout = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeout);
  }, [searchUsers]);

  const addUser = (user: UserResult) => {
    setSelectedUsers((prev) => [...prev, user]);
    setSearch("");
    setUsers([]);
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return;
    if (isGroup && !groupName.trim()) {
      setError(t("groupNameRequired"));
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds: selectedUsers.map((u) => u.id),
          name: isGroup ? groupName.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create conversation");
        return;
      }

      const conversation = await res.json();
      onCreated(conversation.id);
    } catch {
      setError("Failed to create conversation");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-slate-900">
            {t("newConversation")}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-slate-500">{t("newConversationDesc")}</p>

          {/* Selected participants */}
          {selectedUsers.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-600">
                {t("selectedParticipants")}
              </label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {selectedUsers.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-blue-50 text-blue-800 rounded-full"
                  >
                    {user.name}
                    <button
                      onClick={() => removeUser(user.id)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* User search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("searchUsers")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Search results */}
          {search.trim() && (
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y">
              {loading ? (
                <div className="p-3 text-sm text-slate-400 text-center">
                  Loading...
                </div>
              ) : users.length === 0 ? (
                <div className="p-3 text-sm text-slate-400 text-center">
                  {t("noUsersFound")}
                </div>
              ) : (
                users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => addUser(user)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {user.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {user.unitNumber ? `Unit ${user.unitNumber}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-blue-600 font-medium">
                      {t("addParticipant")}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Group name (shown when 2+ selected) */}
          {isGroup && (
            <div>
              <label className="text-xs font-medium text-slate-600">
                {t("groupName")}
              </label>
              <input
                type="text"
                placeholder={t("groupNamePlaceholder")}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleCreate}
            disabled={selectedUsers.length === 0 || creating}
            className="px-4 py-2 text-sm font-medium text-white bg-[#002045] rounded-lg hover:bg-[#001a38] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "..." : t("startConversation")}
          </button>
        </div>
      </div>
    </div>
  );
}

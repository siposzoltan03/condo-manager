"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toggleUserActive } from "@/app/actions/users";
import { ImportUsersButton } from "./import-users-button";
import type { UsersData } from "@/lib/dal";

const UserFormModal = dynamic(() => import("./user-form").then((m) => m.UserFormModal));

interface UserUnit {
  number: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  unitId: string;
  unit: UserUnit;
  isPrimaryContact: boolean;
  isActive: boolean;
  createdAt: string;
}

interface UsersResponse {
  users: UserData[];
  total: number;
  page: number;
  totalPages: number;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-danger/15 text-danger",
  ADMIN: "bg-ochre/15 text-ochre",
  BOARD_MEMBER: "bg-blue/15 text-blue",
  RESIDENT: "bg-good/15 text-good",
  TENANT: "bg-bg-2 text-ink-soft",
};

const ROLE_KEYS: Record<string, string> = {
  SUPER_ADMIN: "roleSuperAdmin",
  ADMIN: "roleAdmin",
  BOARD_MEMBER: "roleBoardMember",
  RESIDENT: "roleResident",
  TENANT: "roleTenant",
};

const ALL_ROLES = ["SUPER_ADMIN", "ADMIN", "BOARD_MEMBER", "OWNER", "TENANT"];

interface UserListProps {
  initialData: UsersData;
}

export function UserList({ initialData }: UserListProps) {
  const t = useTranslations("common");
  const tUsers = useTranslations("users");
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>(initialData.users as UserData[]);
  const [total, setTotal] = useState(initialData.total);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);

      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch users");

      const data: UsersResponse = await res.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      toast.error(t("error"));
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, t]);

  // Refetch when page/search/filter changes (skip initial render)
  const [hasInteracted, setHasInteracted] = useState(false);
  useEffect(() => {
    if (hasInteracted) {
      fetchUsers();
    }
  }, [fetchUsers, hasInteracted]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        setHasInteracted(true);
        setSearch(searchInput);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  function handleRoleFilterChange(value: string) {
    setHasInteracted(true);
    setRoleFilter(value);
    setPage(1);
  }

  function handleCreateUser() {
    setEditingUser(null);
    setShowModal(true);
  }

  function handleEditUser(user: UserData) {
    setEditingUser(user);
    setShowModal(true);
  }

  async function handleToggleActive(user: UserData) {
    try {
      const result = await toggleUserActive(user.id);
      if (result.error) throw new Error(result.error);
      toast.success("User status updated");
      setHasInteracted(true);
      fetchUsers();
      router.refresh();
    } catch {
      toast.error(t("error"));
      setError(t("error"));
    }
  }

  function handleModalClose() {
    setShowModal(false);
    setEditingUser(null);
  }

  function handleModalSuccess() {
    handleModalClose();
    setHasInteracted(true);
    fetchUsers();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{tUsers("title")}</h1>
          <p className="mt-1 text-sm text-muted">
            {tUsers("totalCount", { count: total })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ImportUsersButton />
          <button
            onClick={handleCreateUser}
            className="inline-flex items-center gap-2 rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {tUsers("createUser")}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder={tUsers("searchPlaceholder")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-tile-a bg-card py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => handleRoleFilterChange(e.target.value)}
          className="rounded-lg border border-tile-a bg-card px-4 py-2.5 text-sm text-ink-soft focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
        >
          <option value="">{tUsers("allRoles")}</option>
          {ALL_ROLES.map((role) => (
            <option key={role} value={role}>
              {tUsers(ROLE_KEYS[role])}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-tile-a bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tile-a bg-bg-3">
                <th className="px-6 py-3.5 text-left font-semibold text-ink-soft">
                  {tUsers("name")}
                </th>
                <th className="px-6 py-3.5 text-left font-semibold text-ink-soft">
                  {tUsers("email")}
                </th>
                <th className="px-6 py-3.5 text-left font-semibold text-ink-soft">
                  {tUsers("unit")}
                </th>
                <th className="px-6 py-3.5 text-left font-semibold text-ink-soft">
                  {tUsers("role")}
                </th>
                <th className="px-6 py-3.5 text-left font-semibold text-ink-soft">
                  {tUsers("status")}
                </th>
                <th className="px-6 py-3.5 text-right font-semibold text-ink-soft">
                  {tUsers("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tile-a">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    {t("loading")}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    {tUsers("noUsers")}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-bg-3 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-ink">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 text-ink-soft">{user.email}</td>
                    <td className="px-6 py-4 text-ink-soft">
                      {user.unit?.number ?? "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          ROLE_COLORS[user.role] ?? "bg-bg-2 text-ink-soft"
                        }`}
                      >
                        {ROLE_KEYS[user.role] ? tUsers(ROLE_KEYS[user.role]) : user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.isActive
                            ? "bg-good/15 text-good"
                            : "bg-ochre/15 text-ochre"
                        }`}
                      >
                        {user.isActive ? tUsers("active") : tUsers("inactive")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="rounded-md px-3 py-1.5 text-xs font-medium text-blue hover:bg-blue/10 transition-colors"
                        >
                          {t("edit")}
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            user.isActive
                              ? "text-ochre hover:bg-ochre/15"
                              : "text-good hover:bg-good/10"
                          }`}
                        >
                          {user.isActive ? tUsers("deactivate") : tUsers("activate")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-tile-a bg-card px-6 py-3">
            <p className="text-sm text-ink-soft">
              {tUsers("pageOf", { page, totalPages })}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setHasInteracted(true); setPage((p) => Math.max(1, p - 1)); }}
                disabled={page === 1}
                className="inline-flex items-center gap-1 rounded-md border border-tile-a bg-card px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-bg-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {tUsers("previous")}
              </button>
              <button
                onClick={() => { setHasInteracted(true); setPage((p) => Math.min(totalPages, p + 1)); }}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 rounded-md border border-tile-a bg-card px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-bg-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {tUsers("next")}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Form Modal */}
      {showModal && (
        <UserFormModal
          user={editingUser}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}

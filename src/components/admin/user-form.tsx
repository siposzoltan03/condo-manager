"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

interface UnitOption {
  id: string;
  number: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  unitId: string;
  isPrimaryContact: boolean;
  relationship?: string;
  isActive: boolean;
}

interface UserFormModalProps {
  user: UserData | null; // null = create mode
  onClose: () => void;
  onSuccess: () => void;
}

const ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "BOARD_MEMBER", label: "Board Member" },
  { value: "RESIDENT", label: "Resident" },
  { value: "TENANT", label: "Tenant" },
];

const RELATIONSHIPS = [
  { value: "OWNER", label: "Owner" },
  { value: "TENANT", label: "Tenant" },
];

export function UserFormModal({ user, onClose, onSuccess }: UserFormModalProps) {
  const t = useTranslations("common");
  const isEdit = !!user;

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [role, setRole] = useState(user?.role ?? "RESIDENT");
  const [unitId, setUnitId] = useState(user?.unitId ?? "");
  const [isPrimaryContact, setIsPrimaryContact] = useState(user?.isPrimaryContact ?? false);
  const [relationship, setRelationship] = useState(user?.relationship ?? "OWNER");

  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch units for the dropdown
  useEffect(() => {
    async function fetchUnits() {
      try {
        const res = await fetch("/api/units");
        if (res.ok) {
          const data = await res.json();
          // Handle both array and paginated response
          const unitList = Array.isArray(data) ? data : data.units ?? [];
          setUnits(unitList);
          if (!unitId && unitList.length > 0) {
            setUnitId(unitList[0].id);
          }
        }
      } catch {
        // Units fetch failed - user will see empty dropdown
      } finally {
        setLoadingUnits(false);
      }
    }
    fetchUnits();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (isEdit) {
        // PATCH /api/users/[id]
        const body: Record<string, unknown> = {
          role,
          unitId,
          isPrimaryContact,
          relationship,
        };

        const res = await fetch(`/api/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update user");
        }

        setSuccess("User updated successfully");
        setTimeout(onSuccess, 800);
      } else {
        // POST /api/users
        if (!name || !email || !temporaryPassword || !unitId) {
          setError("All fields are required");
          setSubmitting(false);
          return;
        }

        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            temporaryPassword,
            role,
            unitId,
            isPrimaryContact,
            relationship,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create user");
        }

        setSuccess("User created successfully");
        setTimeout(onSuccess, 800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl mx-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold text-slate-900 mb-6">
          {isEdit ? "Edit User" : "Create User"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEdit}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="Full name"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t("email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="user@example.com"
            />
          </div>

          {/* Temporary Password (create only) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Temporary Password
              </label>
              <input
                type="password"
                value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Set a temporary password"
              />
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Unit
            </label>
            {loadingUnits ? (
              <p className="text-sm text-slate-500">{t("loading")}</p>
            ) : (
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{t("selectUnit")}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.number}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Relationship */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Relationship
            </label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {RELATIONSHIPS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Contact */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isPrimaryContact}
              onClick={() => setIsPrimaryContact(!isPrimaryContact)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                isPrimaryContact ? "bg-blue-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
                  isPrimaryContact ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <label className="text-sm font-medium text-slate-700">
              Primary Contact
            </label>
          </div>

          {/* Error / Success */}
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? t("loading") : isEdit ? t("save") : t("create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

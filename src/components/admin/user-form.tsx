"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { X } from "lucide-react";
import { createUser, updateUser } from "@/app/actions/users";

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
  { value: "OWNER", label: "Resident" },
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
  const [role, setRole] = useState(user?.role ?? "OWNER");
  const [unitId, setUnitId] = useState(user?.unitId ?? "");
  const [isPrimaryContact, setIsPrimaryContact] = useState(user?.isPrimaryContact ?? false);
  const [relationship, setRelationship] = useState(user?.relationship ?? "OWNER");
  const [contactConsent, setContactConsent] = useState(false);

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
        toast.error("Failed to load units");
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
        const result = await updateUser(user.id, {
          role,
          unitId,
          isPrimaryContact,
          relationship,
        });

        if (result.error) {
          setError(result.error);
          setSubmitting(false);
          return;
        }

        toast.success("User updated successfully");
        setSuccess("User updated successfully");
        setTimeout(onSuccess, 800);
      } else {
        if (!name || !email || !temporaryPassword || !unitId) {
          setError("All fields are required");
          setSubmitting(false);
          return;
        }

        const result = await createUser({
          name,
          email,
          temporaryPassword,
          role,
          unitId,
          isPrimaryContact,
          relationship,
          contactConsent: relationship === "TENANT" ? contactConsent : undefined,
        });

        if (result.error) {
          setError(result.error);
          setSubmitting(false);
          return;
        }

        toast.success("User created successfully");
        setSuccess("User created successfully");
        setTimeout(onSuccess, 800);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-lg rounded-xl bg-card p-6 shadow-2xl mx-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted hover:bg-bg-2 hover:text-ink-soft transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold text-ink mb-6">
          {isEdit ? "Edit User" : "Create User"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEdit}
              required
              className="w-full rounded-lg border border-tile-a bg-card px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue disabled:bg-bg-3 disabled:text-muted"
              placeholder="Full name"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1.5">
              {t("email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
              required
              className="w-full rounded-lg border border-tile-a bg-card px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue disabled:bg-bg-3 disabled:text-muted"
              placeholder="user@example.com"
            />
          </div>

          {/* Temporary Password (create only) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1.5">
                Temporary Password
              </label>
              <input
                type="password"
                value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-tile-a bg-card px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
                placeholder="Set a temporary password"
              />
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1.5">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-tile-a bg-card px-4 py-2.5 text-sm text-ink-soft focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
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
            <label className="block text-sm font-medium text-ink-soft mb-1.5">
              Unit
            </label>
            {loadingUnits ? (
              <p className="text-sm text-muted">{t("loading")}</p>
            ) : (
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                required
                className="w-full rounded-lg border border-tile-a bg-card px-4 py-2.5 text-sm text-ink-soft focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
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
            <label className="block text-sm font-medium text-ink-soft mb-1.5">
              Relationship
            </label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full rounded-lg border border-tile-a bg-card px-4 py-2.5 text-sm text-ink-soft focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue"
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
                isPrimaryContact ? "bg-blue" : "bg-bg-2"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-card shadow-lg transition-transform ${
                  isPrimaryContact ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <label className="text-sm font-medium text-ink-soft">
              Primary Contact
            </label>
          </div>

          {/* Tenant consent — Tht. § 22(2) requires explicit opt-in
              before the building may store a tenant's email/phone. */}
          {!isEdit && relationship === "TENANT" && (
            <div className="rounded-lg border border-ochre/30 bg-ochre/15 p-3">
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={contactConsent}
                  onChange={(e) => setContactConsent(e.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>{t("tenantConsentLabel")}</span>
              </label>
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-good/10 px-4 py-3 text-sm text-good">
              {success}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-tile-a bg-card px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-bg-3 transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? t("loading") : isEdit ? t("save") : t("create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

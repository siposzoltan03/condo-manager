"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { X, Loader2 } from "lucide-react";

interface Unit {
  id: string;
  number: string;
  floor: number | null;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteUserModal({ onClose, onSuccess }: Props) {
  const t = useTranslations("invitationManagement");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("RESIDENT");
  const [unitId, setUnitId] = useState("");
  const [relationship, setRelationship] = useState("OWNER");
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => {
    async function fetchUnits() {
      try {
        const res = await fetch("/api/units");
        if (res.ok) {
          const data = await res.json();
          setUnits(Array.isArray(data) ? data : []);
        }
      } catch {
        // Units are optional, ignore errors
      }
    }
    fetchUnits();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body: Record<string, string> = { email, role };
      if (unitId) {
        body.unitId = unitId;
        body.relationship = relationship;
      }

      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError(data.error);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Failed to send invitation");
        return;
      }

      // Show invite link if available
      if (data.inviteLink) {
        setInviteLink(data.inviteLink);
      } else {
        onSuccess();
      }
    } catch {
      setError("Failed to send invitation");
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900">{t("inviteUser")}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {inviteLink ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700">
              {t("inviteSent")}
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                {t("inviteLink")}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                />
                <button
                  onClick={copyLink}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  {t("copyLink")}
                </button>
              </div>
            </div>
            <button
              onClick={onSuccess}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {t("actions")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="invite-email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1"
              >
                {t("email")}
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="user@example.com"
              />
            </div>

            {/* Role */}
            <div>
              <label
                htmlFor="invite-role"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1"
              >
                {t("role")}
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="ADMIN">Admin</option>
                <option value="BOARD_MEMBER">Board Member</option>
                <option value="RESIDENT">Resident</option>
                <option value="TENANT">Tenant</option>
              </select>
            </div>

            {/* Unit (optional) */}
            <div>
              <label
                htmlFor="invite-unit"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1"
              >
                {t("unit")} <span className="font-normal normal-case">({t("optional")})</span>
              </label>
              <select
                id="invite-unit"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.number}
                  </option>
                ))}
              </select>
            </div>

            {/* Relationship (shown when unit is selected) */}
            {unitId && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  {t("relationship")}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="relationship"
                      value="OWNER"
                      checked={relationship === "OWNER"}
                      onChange={(e) => setRelationship(e.target.value)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    {t("owner")}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="relationship"
                      value="TENANT"
                      checked={relationship === "TENANT"}
                      onChange={(e) => setRelationship(e.target.value)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    {t("tenant")}
                  </label>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {t("actions")}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("sendInvitation")
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

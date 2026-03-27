"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Plus, Star, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { RoleGuard } from "@/components/auth/role-guard";
import { ContractorDetail } from "./ContractorDetail";

interface ContractorSummary {
  id: string;
  name: string;
  specialty: string;
  contactInfo: string;
  taxId: string | null;
  averageRating: number | null;
  totalJobs: number;
  createdAt: string;
}

export function ContractorList() {
  const t = useTranslations("maintenance.contractors");
  const tMaint = useTranslations("maintenance");
  const tCommon = useTranslations("common");
  const { hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN");

  const [contractors, setContractors] = useState<ContractorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSpecialty, setFormSpecialty] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formTaxId, setFormTaxId] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchContractors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/maintenance/contractors");
      if (res.ok) {
        const data = await res.json();
        setContractors(data.contractors || []);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContractors();
  }, [fetchContractors]);

  async function handleCreateContractor(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formName.trim() || !formSpecialty.trim() || !formContact.trim()) {
      setFormError(tMaint("missingFields"));
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch("/api/maintenance/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          specialty: formSpecialty.trim(),
          contactInfo: formContact.trim(),
          taxId: formTaxId.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || tCommon("error"));
        return;
      }

      setFormName("");
      setFormSpecialty("");
      setFormContact("");
      setFormTaxId("");
      setShowForm(false);
      fetchContractors();
    } catch {
      setFormError(tCommon("error"));
    } finally {
      setFormLoading(false);
    }
  }

  if (selectedId) {
    return (
      <ContractorDetail
        contractorId={selectedId}
        onBack={() => {
          setSelectedId(null);
          fetchContractors();
        }}
      />
    );
  }

  return (
    <RoleGuard role="BOARD_MEMBER" fallback={
      <div className="flex min-h-[30vh] items-center justify-center">
        <p className="text-slate-500">{t("accessRestricted")}</p>
      </div>
    }>
      <div>
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-4xl font-extrabold text-[#002045]">
            {t("title")}
          </h1>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 rounded-md bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#002045]/90"
            >
              <Plus className="h-4 w-4" />
              {t("addContractor")}
            </button>
          )}
        </div>

        {/* Add contractor form */}
        {showForm && isAdmin && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#002045]">{t("addContractor")}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateContractor}>
              {formError && (
                <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t("name")}</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t("specialty")}</label>
                  <input
                    type="text"
                    value={formSpecialty}
                    onChange={(e) => setFormSpecialty(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t("contactInfo")}</label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t("taxId")}</label>
                  <input
                    type="text"
                    value={formTaxId}
                    onChange={(e) => setFormTaxId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {tCommon("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-md bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#002045]/90 disabled:opacity-50"
                >
                  {formLoading ? tCommon("loading") : tCommon("create")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Contractor list */}
        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <p className="text-slate-500">{tCommon("loading")}</p>
          </div>
        ) : contractors.length === 0 ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <p className="text-slate-500">{t("noContractors")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contractors.map((contractor) => (
              <div
                key={contractor.id}
                onClick={() => setSelectedId(contractor.id)}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-xl"
              >
                <h3 className="mb-1 text-lg font-semibold text-[#002045]">
                  {contractor.name}
                </h3>
                <p className="mb-3 text-sm text-slate-500">{contractor.specialty}</p>
                <p className="mb-3 text-sm text-slate-600">{contractor.contactInfo}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium text-slate-700">
                      {contractor.averageRating?.toFixed(1) ?? "—"}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {contractor.totalJobs} {t("completedJobs").toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}

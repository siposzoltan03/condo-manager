"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Star, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface TicketSummary {
  id: string;
  trackingNumber: string;
  title: string;
  status: string;
  urgency: string;
  createdAt: string;
  reporter: { id: string; name: string };
}

interface RatingData {
  id: string;
  rating: number;
  notes: string | null;
  rater: { id: string; name: string };
  ticket: { id: string; trackingNumber: string; title: string };
  createdAt: string;
}

interface ContractorData {
  id: string;
  name: string;
  specialty: string;
  contactInfo: string;
  taxId: string | null;
  tickets: TicketSummary[];
  ratings: RatingData[];
  averageRating: number | null;
  completedJobs: number;
  createdAt: string;
}

interface ContractorDetailProps {
  contractorId: string;
  onBack: () => void;
}

export function ContractorDetail({ contractorId, onBack }: ContractorDetailProps) {
  const t = useTranslations("maintenance.contractors");
  const tMaint = useTranslations("maintenance");
  const tCommon = useTranslations("common");
  const { hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN");

  const [contractor, setContractor] = useState<ContractorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchContractor = useCallback(async () => {
    try {
      const res = await fetch(`/api/maintenance/contractors/${contractorId}`);
      if (res.ok) {
        setContractor(await res.json());
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [contractorId]);

  useEffect(() => {
    fetchContractor();
  }, [fetchContractor]);

  async function handleDelete() {
    if (!confirm(t("confirmDelete"))) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/maintenance/contractors/${contractorId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onBack();
      }
    } catch {
      // Error handled silently
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">{tCommon("loading")}</p>
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">{tMaint("notFound")}</p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-slate-600 hover:text-[#002045]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("title")}
      </button>

      {/* Contractor info */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#002045]">{contractor.name}</h1>
            <p className="text-sm text-slate-500">{contractor.specialty}</p>
            <p className="mt-2 text-sm text-slate-600">{contractor.contactInfo}</p>
            {contractor.taxId && (
              <p className="mt-1 text-sm text-slate-500">{t("taxId")}: {contractor.taxId}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 text-amber-400" />
                <span className="text-xl font-bold text-slate-800">
                  {contractor.averageRating?.toFixed(1) ?? "—"}
                </span>
              </div>
              <span className="text-xs text-slate-500">{t("averageRating")}</span>
            </div>
            <div className="text-center">
              <span className="text-xl font-bold text-slate-800">{contractor.completedJobs}</span>
              <p className="text-xs text-slate-500">{t("completedJobs")}</p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="flex items-center gap-2 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {t("deleteContractor")}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Job history */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#002045]">{t("jobHistory")}</h2>
          {contractor.tickets.length === 0 ? (
            <p className="text-sm text-slate-500">{tMaint("noTickets")}</p>
          ) : (
            <div className="space-y-3">
              {contractor.tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{ticket.trackingNumber}</span>
                    <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {tMaint(`status_${ticket.status}`)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-800">{ticket.title}</p>
                  <p className="text-xs text-slate-500">
                    {ticket.reporter.name} — {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rating history */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#002045]">{t("ratingHistory")}</h2>
          {contractor.ratings.length === 0 ? (
            <p className="text-sm text-slate-500">{t("noRatingsYet")}</p>
          ) : (
            <div className="space-y-3">
              {contractor.ratings.map((rating) => (
                <div key={rating.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i <= rating.rating ? "text-amber-400 fill-amber-400" : "text-slate-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-mono text-xs text-slate-500">
                      {rating.ticket.trackingNumber}
                    </span>
                  </div>
                  {rating.notes && (
                    <p className="mt-1 text-sm text-slate-700">{rating.notes}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    {rating.rater.name} — {new Date(rating.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

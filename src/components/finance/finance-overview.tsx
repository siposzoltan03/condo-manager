"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { PaymentSummaryCards } from "./payment-summary-cards";
import { PaymentTrendsChart } from "./payment-trends-chart";
import { PaymentHistoryTable } from "./payment-history-table";

interface ChargeSummary {
  currentBalance: string | number;
  nextDue: { amount: string | number; month: string } | null;
  lastPayment: { amount: string | number; paidAt: string } | null;
}

interface Charge {
  id: string;
  month: string;
  amount: string | number;
  dueDate: string | null;
  paidAt: string | null;
  status: string;
  invoiceId: string | null;
}

interface ChargesResponse {
  charges: Charge[];
  total: number;
  page: number;
  totalPages: number;
}

export function FinanceOverview() {
  const t = useTranslations("finance");
  const { hasRole } = useAuth();

  const [summary, setSummary] = useState<ChargeSummary | null>(null);
  const [chargesData, setChargesData] = useState<ChargesResponse | null>(null);
  const [allCharges, setAllCharges] = useState<Charge[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const isBoardPlus = hasRole("BOARD_MEMBER");

  const fetchData = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const [summaryRes, chargesRes, allChargesRes] = await Promise.all([
        fetch("/api/finance/charges/summary"),
        fetch(`/api/finance/charges?page=${currentPage}&limit=10`),
        fetch("/api/finance/charges?page=1&limit=50"),
      ]);

      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
      if (chargesRes.ok) {
        setChargesData(await chargesRes.json());
      }
      if (allChargesRes.ok) {
        const data = await allChargesRes.json();
        setAllCharges(data.charges);
      }
    } catch (error) {
      console.error("Failed to fetch finance data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(page);
  }, [page, fetchData]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="space-y-8">
      {/* Title and Building Finance link */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">{t("title")}</h1>
        </div>
        {isBoardPlus && (
          <Link
            href="/finance/building"
            className="flex items-center gap-2 rounded-lg border border-[#002045] px-4 py-2 text-sm font-medium text-[#002045] transition-colors hover:bg-[#002045] hover:text-white"
          >
            <Building2 className="h-4 w-4" />
            {t("buildingTitle")}
          </Link>
        )}
      </div>

      {/* Summary Cards */}
      <PaymentSummaryCards summary={summary} loading={loading} />

      {/* Trends Chart */}
      <PaymentTrendsChart charges={allCharges} loading={loading} />

      {/* Payment History Table */}
      <PaymentHistoryTable
        charges={chargesData?.charges ?? []}
        total={chargesData?.total ?? 0}
        page={chargesData?.page ?? 1}
        totalPages={chargesData?.totalPages ?? 1}
        onPageChange={handlePageChange}
        loading={loading}
      />
    </div>
  );
}

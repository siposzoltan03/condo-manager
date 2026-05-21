"use client";

import { useState, useCallback } from "react";
import { PaymentSummaryCards } from "./payment-summary-cards";
import { PaymentTrendsChart } from "./payment-trends-chart";
import { PaymentHistoryTable } from "./payment-history-table";
import type { FinanceOverviewData, ChargeItem } from "@/lib/dal";

interface FinanceOverviewProps {
  initialData: FinanceOverviewData;
}

export function FinanceOverview({ initialData }: FinanceOverviewProps) {
  const [summary] = useState(initialData.summary);
  const [chargesData, setChargesData] = useState({
    charges: initialData.charges,
    total: initialData.total,
    page: initialData.page,
    totalPages: initialData.totalPages,
  });
  const [allCharges] = useState<ChargeItem[]>(initialData.allCharges);
  const [loading, setLoading] = useState(false);

  const handlePageChange = useCallback(async (newPage: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/charges?page=${newPage}&limit=10`);
      if (res.ok) {
        setChargesData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <PaymentSummaryCards summary={summary} loading={false} />

      {/* Trends Chart */}
      <PaymentTrendsChart charges={allCharges} loading={false} />

      {/* Payment History Table */}
      <PaymentHistoryTable
        charges={chargesData.charges}
        total={chargesData.total}
        page={chargesData.page}
        totalPages={chargesData.totalPages}
        onPageChange={handlePageChange}
        loading={loading}
      />
    </div>
  );
}

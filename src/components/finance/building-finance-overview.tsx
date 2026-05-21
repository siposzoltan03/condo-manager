"use client";

import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BudgetSummaryCards } from "./budget-summary-cards";
import { BudgetActionBar } from "./budget-action-bar";
import { BudgetTable } from "./budget-table";
import { ImportChargesButton } from "./import-charges-button";
import { ImportAccountsButton } from "./import-accounts-button";
import { LedgerTable } from "./ledger-table";
import { MonthlyFinancePdfButton } from "@/components/reports/monthly-finance-pdf-button";
import { YearEndPdfButton } from "@/components/reports/year-end-pdf-button";
import { UtilityStatementPdfButton } from "@/components/reports/utility-statement-pdf-button";
import { AddExpenseModal } from "./add-expense-modal";
import { AddIncomeModal } from "./add-income-modal";
import { CsvImportDialog } from "./csv-import-dialog";
import type { BuildingFinanceData, LedgerEntryData } from "@/lib/dal";

interface BuildingFinanceOverviewProps {
  initialData: BuildingFinanceData;
}

export function BuildingFinanceOverview({ initialData }: BuildingFinanceOverviewProps) {
  const t = useTranslations("finance");
  const router = useRouter();

  const currentYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState(`${currentYear}-12-31`);
  const [summary, setSummary] = useState(initialData.summary);
  const [budgetItems, setBudgetItems] = useState(initialData.budgetItems);
  const [ledgerData, setLedgerData] = useState(initialData.ledger);
  const [accounts] = useState(initialData.accounts);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  const fetchData = useCallback(async (from: string, to: string, page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const [summaryRes, budgetRes, ledgerRes] = await Promise.all([
        fetch(`/api/finance/summary?${params}`),
        fetch(`/api/finance/budget?year=${currentYear}`),
        fetch(`/api/finance/ledger?${params}&page=${page}&limit=10`),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (budgetRes.ok) {
        const data = await budgetRes.json();
        setBudgetItems(data.items);
      }
      if (ledgerRes.ok) setLedgerData(await ledgerRes.json());
    } catch (error) {
      console.error("Failed to fetch building finance data:", error);
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  const handleDateChange = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
    setLedgerPage(1);
    fetchData(from, to, 1);
  };

  const handleLedgerPageChange = (page: number) => {
    setLedgerPage(page);
    fetchData(fromDate, toDate, page);
  };

  const handleLedgerSubmit = async (data: {
    date: string;
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
    description: string;
    receiptUrl?: string;
  }) => {
    const res = await fetch("/api/finance/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      router.refresh();
    }
  };

  const handleCsvImport = async (csv: string) => {
    const res = await fetch("/api/finance/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    if (res.ok) {
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <BudgetSummaryCards summary={summary} loading={loading} />

      {/* Action Bar */}
      <BudgetActionBar
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={(from) => handleDateChange(from, toDate)}
        onToDateChange={(to) => handleDateChange(fromDate, to)}
        onAddExpense={() => setExpenseModalOpen(true)}
        onAddIncome={() => setIncomeModalOpen(true)}
        onImportStatement={() => setCsvDialogOpen(true)}
        onGenerateReport={() => {
          const params = new URLSearchParams();
          if (fromDate) params.set("from", fromDate);
          if (toDate) params.set("to", toDate);
          window.open(`/api/finance/ledger/export?${params.toString()}`, "_blank");
        }}
      />

      {/* Import buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <ImportChargesButton />
        <ImportAccountsButton />
      </div>

      {/* PDF reports */}
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-ink/8 bg-card p-3">
        <UtilityStatementPdfButton />
        <YearEndPdfButton />
        <MonthlyFinancePdfButton />
      </div>

      {/* Budget + Ledger grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <BudgetTable items={budgetItems} loading={loading} />
        </div>
        <div className="lg:col-span-7">
          <LedgerTable
            entries={ledgerData.entries}
            total={ledgerData.total}
            page={ledgerData.page}
            totalPages={ledgerData.totalPages}
            onPageChange={handleLedgerPageChange}
            loading={loading}
          />
        </div>
      </div>

      {/* Modals */}
      <AddExpenseModal
        open={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        accounts={accounts}
        onSubmit={handleLedgerSubmit}
      />
      <AddIncomeModal
        open={incomeModalOpen}
        onClose={() => setIncomeModalOpen(false)}
        accounts={accounts}
        onSubmit={handleLedgerSubmit}
      />
      <CsvImportDialog
        open={csvDialogOpen}
        onClose={() => setCsvDialogOpen(false)}
        onSubmit={handleCsvImport}
      />
    </div>
  );
}

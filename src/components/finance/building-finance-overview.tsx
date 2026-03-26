"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BudgetSummaryCards } from "./budget-summary-cards";
import { BudgetActionBar } from "./budget-action-bar";
import { BudgetTable } from "./budget-table";
import { LedgerTable } from "./ledger-table";
import { AddExpenseModal } from "./add-expense-modal";
import { AddIncomeModal } from "./add-income-modal";
import { CsvImportDialog } from "./csv-import-dialog";

interface FinanceSummary {
  currentFundBalance: number;
  reserveFundBalance: number;
  totalIncome: number;
  totalExpenses: number;
}

interface BudgetItem {
  accountId: string;
  name: string;
  plannedAmount: number;
  actualAmount: number;
}

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: string | number;
  debitAccount: { name: string };
  creditAccount: { name: string };
  createdBy: { name: string } | null;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

export function BuildingFinanceOverview() {
  const t = useTranslations("finance");
  const { hasRole } = useAuth();

  const currentYear = new Date().getFullYear();
  const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState(`${currentYear}-12-31`);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [ledgerData, setLedgerData] = useState<{
    entries: LedgerEntry[];
    total: number;
    page: number;
    totalPages: number;
  }>({ entries: [], total: 0, page: 1, totalPages: 1 });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const [summaryRes, budgetRes, ledgerRes] = await Promise.all([
        fetch(`/api/finance/summary?${params}`),
        fetch(`/api/finance/budget?year=${currentYear}`),
        fetch(`/api/finance/ledger?${params}&page=${ledgerPage}&limit=10`),
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
  }, [fromDate, toDate, currentYear, ledgerPage]);

  // Fetch accounts for modals
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("/api/finance/accounts");
        if (res.ok) {
          const data = await res.json();
          setAccounts(data);
        }
      } catch {
        // ignore
      }
    }
    fetchAccounts();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      await fetchData();
    }
  };

  const handleCsvImport = async (csv: string) => {
    const res = await fetch("/api/finance/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    if (res.ok) {
      await fetchData();
    }
  };

  if (!hasRole("BOARD_MEMBER")) {
    return (
      <div className="py-16 text-center text-sm text-[#515f74]">
        {t("accessRestricted")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/finance"
          className="rounded-lg p-2 text-[#515f74] transition-colors hover:bg-gray-100 hover:text-[#002045]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-[#002045]">{t("buildingTitle")}</h1>
      </div>

      {/* Summary Cards */}
      <BudgetSummaryCards summary={summary} loading={loading} />

      {/* Action Bar */}
      <BudgetActionBar
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        onAddExpense={() => setExpenseModalOpen(true)}
        onAddIncome={() => setIncomeModalOpen(true)}
        onImportStatement={() => setCsvDialogOpen(true)}
        onGenerateReport={() => {
          // Generate report - could trigger CSV export of ledger
          window.print();
        }}
      />

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
            onPageChange={setLedgerPage}
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

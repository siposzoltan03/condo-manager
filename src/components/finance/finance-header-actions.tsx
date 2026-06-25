"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AddIncomeModal } from "./add-income-modal";
import { AddExpenseModal } from "./add-expense-modal";

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Props {
  accounts: Account[];
  /** Whether to show all four buttons or only Bank CSV + PDF (e.g. on /finance/ledger). */
  full?: boolean;
}

/**
 * Client wrapper for the four header action buttons that need state
 * (modal open/closed) on a server-rendered FinanceShell.
 *
 * Pass via FinanceShell's `headerActions` slot.
 */
export function FinanceHeaderActions({ accounts, full = true }: Props) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  async function postLedger(data: {
    date: string;
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
    description: string;
    receiptUrl?: string;
  }) {
    const res = await fetch("/api/finance/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => "submit failed"));
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" icon={<UploadIcon />} disabled>
        {t("headerActions.bankCsv")}
      </Button>
      <Button variant="ghost" icon={<DocIcon />} disabled>
        {t("headerActions.pdfReport")}
      </Button>
      {full && (
        <>
          <Button
            variant="danger"
            icon={<MinusIcon />}
            onClick={() => setExpenseOpen(true)}
          >
            {t("headerActions.expense")}
          </Button>
          <Button
            variant="primary"
            icon={<PlusIcon />}
            onClick={() => setIncomeOpen(true)}
          >
            {t("headerActions.income")}
          </Button>
        </>
      )}

      <AddIncomeModal
        open={incomeOpen}
        onClose={() => setIncomeOpen(false)}
        accounts={accounts}
        onSubmit={postLedger}
      />
      <AddExpenseModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        accounts={accounts}
        onSubmit={postLedger}
      />
    </>
  );
}

// ─── Local button helper (mirrors FinanceButton variants but as a real <button>) ──

function Button({
  variant,
  icon,
  onClick,
  disabled,
  children,
}: {
  variant: "ghost" | "primary" | "danger";
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const styles = {
    ghost: {
      background: "var(--color-card)",
      color: "var(--color-ink)",
      border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
    },
    primary: {
      background: "var(--color-ink)",
      color: "var(--color-bg)",
      border: "1px solid var(--color-ink)",
    },
    danger: {
      background: "var(--color-card)",
      color: "var(--color-danger)",
      border: "1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)",
    },
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50 sm:min-h-0"
      style={{
        padding: "9px 14px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        ...styles,
      }}
      title={disabled ? "Hamarosan" : undefined}
    >
      {icon}
      {children}
    </button>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" />
    </svg>
  );
}

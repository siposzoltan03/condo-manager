"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  FinanceModalShell,
  FinanceField,
  financeInputStyle,
} from "./finance-modal-shell";

interface Account {
  id: string;
  name: string;
  type: string;
}

interface AddIncomeModalProps {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  onSubmit: (data: {
    date: string;
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
    description: string;
    receiptUrl?: string;
  }) => Promise<void>;
}

export function AddIncomeModal({
  open,
  onClose,
  accounts,
  onSubmit,
}: AddIncomeModalProps) {
  const t = useTranslations("finance");

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const assetAccounts = accounts.filter((a) => a.type === "ASSET");
  const incomeAccounts = accounts.filter((a) => a.type === "INCOME");

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!debitAccountId) errs.debitAccountId = t("modalErrors.required");
    if (!creditAccountId) errs.creditAccountId = t("modalErrors.required");
    if (!description.trim()) errs.description = t("modalErrors.required");
    if (!amount || parseFloat(amount) <= 0)
      errs.amount = t("modalErrors.positiveAmount");
    return errs;
  }

  function clearError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit({
        date,
        debitAccountId,
        creditAccountId,
        amount: parseFloat(amount),
        description: description.trim(),
        receiptUrl: receiptUrl || undefined,
      });
      // Reset and close on success.
      setDate(new Date().toISOString().slice(0, 10));
      setDebitAccountId("");
      setCreditAccountId("");
      setDescription("");
      setAmount("");
      setReceiptUrl("");
      onClose();
    } catch {
      setErrors({ submit: t("modalErrors.submitFailed") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FinanceModalShell
      open={open}
      onClose={onClose}
      variant="income"
      title={t("addIncome")}
      subtitle={t("modal.incomeSubtitle")}
    >
      <form onSubmit={handleSubmit} style={{ padding: "0 24px 22px" }}>
        {errors.submit && (
          <div
            role="alert"
            className="mb-4"
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "12.5px",
              background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
              color: "var(--color-danger)",
            }}
          >
            {errors.submit}
          </div>
        )}

        <FinanceField label={t("date")} htmlFor="income-date">
          <input
            id="income-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={financeInputStyle(false)}
          />
        </FinanceField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FinanceField
            label={t("debitAccount")}
            htmlFor="income-debit"
            error={errors.debitAccountId}
            hint={t("modal.debitAssetHint")}
          >
            <select
              id="income-debit"
              required
              value={debitAccountId}
              onChange={(e) => {
                setDebitAccountId(e.target.value);
                clearError("debitAccountId");
              }}
              style={financeInputStyle(!!errors.debitAccountId)}
            >
              <option value="">{t("selectAccount")}</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FinanceField>

          <FinanceField
            label={t("creditAccount")}
            htmlFor="income-credit"
            error={errors.creditAccountId}
            hint={t("modal.creditIncomeHint")}
          >
            <select
              id="income-credit"
              required
              value={creditAccountId}
              onChange={(e) => {
                setCreditAccountId(e.target.value);
                clearError("creditAccountId");
              }}
              style={financeInputStyle(!!errors.creditAccountId)}
            >
              <option value="">{t("selectAccount")}</option>
              {incomeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FinanceField>
        </div>

        <FinanceField
          label={t("description")}
          htmlFor="income-description"
          error={errors.description}
        >
          <input
            id="income-description"
            type="text"
            required
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              clearError("description");
            }}
            placeholder="3.em 12. · közös költség"
            style={financeInputStyle(!!errors.description)}
          />
        </FinanceField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FinanceField
            label={t("amount")}
            htmlFor="income-amount"
            error={errors.amount}
          >
            <div className="relative">
              <input
                id="income-amount"
                type="number"
                step="0.01"
                min="0"
                required
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  clearError("amount");
                }}
                placeholder="0"
                style={{
                  ...financeInputStyle(!!errors.amount),
                  paddingRight: "44px",
                  textAlign: "right",
                  fontFamily: "var(--font-ibm-plex-mono), monospace",
                }}
              />
              <span
                className="absolute font-mono pointer-events-none"
                style={{
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "11px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.05em",
                }}
              >
                FT
              </span>
            </div>
          </FinanceField>

          <FinanceField label={t("receiptUrl")} htmlFor="income-receipt" hint="https://...">
            <input
              id="income-receipt"
              type="url"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="https://"
              style={financeInputStyle(false)}
            />
          </FinanceField>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end items-center gap-2"
          style={{
            marginTop: "22px",
            paddingTop: "16px",
            borderTop: "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              background: "var(--color-card)",
              color: "var(--color-ink-soft)",
              border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {t("close")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              border: "1px solid var(--color-ink)",
            }}
          >
            {submitting ? (
              <>
                <Spinner /> {t("modal.saving")}
              </>
            ) : (
              <>
                <PlusIcon /> {t("save")}
              </>
            )}
          </button>
        </div>
      </form>
    </FinanceModalShell>
  );
}

function PlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

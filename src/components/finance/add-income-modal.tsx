"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { X } from "lucide-react";

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

export function AddIncomeModal({ open, onClose, accounts, onSubmit }: AddIncomeModalProps) {
  const t = useTranslations("finance");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const assetAccounts = accounts.filter((a) => a.type === "ASSET");
  const incomeAccounts = accounts.filter((a) => a.type === "INCOME");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debitAccountId || !creditAccountId || !amount || !description) return;
    setSubmitting(true);
    try {
      await onSubmit({
        date,
        debitAccountId,
        creditAccountId,
        amount: parseFloat(amount),
        description,
        receiptUrl: receiptUrl || undefined,
      });
      onClose();
      setDate(new Date().toISOString().slice(0, 10));
      setDebitAccountId("");
      setCreditAccountId("");
      setDescription("");
      setAmount("");
      setReceiptUrl("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#002045]">{t("addIncome")}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-[#515f74]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#515f74]">{t("date")}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#515f74]">{t("debitAccount")}</label>
            <select
              value={debitAccountId}
              onChange={(e) => setDebitAccountId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            >
              <option value="">{t("selectAccount")}</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#515f74]">{t("creditAccount")}</label>
            <select
              value={creditAccountId}
              onChange={(e) => setCreditAccountId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            >
              <option value="">{t("selectAccount")}</option>
              {incomeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#515f74]">{t("description")}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#515f74]">{t("amount")}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#515f74]">{t("receiptUrl")}</label>
            <input
              type="url"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-[#515f74] hover:bg-gray-50"
            >
              {t("close")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#003060] disabled:opacity-50"
            >
              {t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

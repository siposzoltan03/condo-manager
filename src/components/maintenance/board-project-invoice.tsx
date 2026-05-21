"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";

export interface BoardInvoiceDTO {
  id: string;
  invoiceNumber: string;
  grossAmount: number;
  issuedAt: string;
  dueAt: string;
  status: "PENDING" | "PAID";
  paidAt: string | null;
  hasFile: boolean;
  contractorName: string;
}

/**
 * Board-side block on the ticket detail page that shows the contractor's
 * submitted invoice. The board's "Számla kifizetve" action both records
 * payment and advances the ticket COMPLETED → VERIFIED, which is how the
 * project officially closes.
 */
export function BoardProjectInvoice({
  ticketId,
  invoice,
  isBoardPlus,
}: {
  ticketId: string;
  invoice: BoardInvoiceDTO;
  isBoardPlus: boolean;
}) {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const confirm = useConfirm();
  const [marking, setMarking] = useState(false);

  async function markPaid() {
    const ok = await confirm({
      title: t("invoicePaidConfirmTitle"),
      description: t("invoicePaidConfirm"),
      confirmLabel: t("invoicePaidConfirmYes"),
      cancelLabel: t("projectActionConfirmCancel"),
    });
    if (!ok) return;
    setMarking(true);
    try {
      const res = await fetch(
        `/api/maintenance/tickets/${ticketId}/marketplace-invoice/paid`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(data?.error ?? t("invoicePaidFailed"));
        return;
      }
      toast.success(t("invoicePaidSuccess"));
      router.refresh();
    } catch {
      toast.error(t("invoicePaidFailed"));
    } finally {
      setMarking(false);
    }
  }

  const paid = invoice.status === "PAID";
  const tone = paid ? "var(--color-good)" : "var(--color-ochre)";
  const label = paid ? t("invoiceStatusPaid") : t("invoiceStatusPending");

  return (
    <section
      className="rounded-xl border"
      style={{
        marginTop: "16px",
        padding: "18px 20px",
        background: paid
          ? "color-mix(in srgb, var(--color-good) 8%, var(--color-bg-3))"
          : "var(--color-bg-3)",
        borderColor: `color-mix(in srgb, ${tone} 30%, transparent)`,
      }}
    >
      <div
        className="flex items-center justify-between gap-3 flex-wrap"
        style={{ marginBottom: "10px" }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {t("invoiceHeading")} · {invoice.contractorName}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "10.5px",
            padding: "3px 9px",
            borderRadius: "5px",
            background: tone,
            color: "var(--color-bg)",
            letterSpacing: "0.06em",
            fontWeight: 700,
          }}
        >
          {label}
        </span>
      </div>

      <div
        className="flex items-baseline justify-between gap-3 flex-wrap"
        style={{ marginBottom: "10px" }}
      >
        <p
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "24px",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          {invoice.grossAmount.toLocaleString("hu")}{" "}
          <small
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.06em",
            }}
          >
            FT
          </small>
        </p>
        <p
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
            margin: 0,
          }}
        >
          № {invoice.invoiceNumber}
        </p>
      </div>

      <dl
        className="grid"
        style={{
          gridTemplateColumns: "max-content 1fr",
          gap: "5px 16px",
          fontSize: "12px",
        }}
      >
        <Term>{t("invoiceIssuedAt")}</Term>
        <dd>{new Date(invoice.issuedAt).toLocaleDateString("hu")}</dd>
        <Term>{t("invoiceDueAt")}</Term>
        <dd>{new Date(invoice.dueAt).toLocaleDateString("hu")}</dd>
        {invoice.paidAt && (
          <>
            <Term>{t("invoicePaidAt")}</Term>
            <dd style={{ color: "var(--color-good)" }}>
              {new Date(invoice.paidAt).toLocaleDateString("hu")}
            </dd>
          </>
        )}
      </dl>

      <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: "12px" }}>
        {invoice.hasFile && (
          <a
            href={`/api/marketplace/invoices/${invoice.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="font-mono"
            style={{
              fontSize: "11.5px",
              color: "var(--color-ink)",
              textDecoration: "underline",
              letterSpacing: "0.04em",
            }}
          >
            {t("invoiceDownload")} ↗
          </a>
        )}
        {!paid && isBoardPlus && (
          <button
            type="button"
            onClick={markPaid}
            disabled={marking}
            className="disabled:opacity-60"
            style={{
              marginLeft: "auto",
              padding: "9px 14px",
              borderRadius: "8px",
              fontSize: "12.5px",
              fontWeight: 600,
              background: "var(--color-good)",
              color: "var(--color-bg)",
              letterSpacing: "0.02em",
            }}
          >
            {marking ? "…" : t("invoicePaidButton")}
          </button>
        )}
      </div>
    </section>
  );
}

function Term({ children }: { children: React.ReactNode }) {
  return (
    <dt
      className="font-mono"
      style={{
        color: "var(--color-muted)",
        fontSize: "10px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </dt>
  );
}

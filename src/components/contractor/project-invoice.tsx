"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type TFn = ReturnType<typeof useTranslations>;

export interface ProjectInvoiceDTO {
  id: string;
  invoiceNumber: string;
  grossAmount: number;
  issuedAt: string;
  dueAt: string;
  status: "PENDING" | "PAID";
  paidAt: string | null;
  hasFile: boolean;
  fileName: string | null;
}

/**
 * Invoice block on the contractor project-detail page. Three states:
 *   - ticket not yet COMPLETED: hidden (parent skips rendering)
 *   - COMPLETED + no invoice: upload form
 *   - invoice present: summary card (incl. PAID badge once the board flips it)
 */
export function ProjectInvoice({
  bidId,
  invoice,
  locale,
}: {
  bidId: string;
  invoice: ProjectInvoiceDTO | null;
  locale: string;
}) {
  const t = useTranslations("marketplace");

  if (invoice) {
    return <InvoiceCard invoice={invoice} locale={locale} t={t} />;
  }
  return <InvoiceForm bidId={bidId} t={t} />;
}

function InvoiceForm({
  bidId,
  t,
}: {
  bidId: string;
  t: TFn;
}) {
  const router = useRouter();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [gross, setGross] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!invoiceNumber.trim()) {
      setError(t("invoiceErrorNumber"));
      return;
    }
    const grossNum = Number(gross.replace(/\s/g, ""));
    if (!Number.isFinite(grossNum) || grossNum <= 0) {
      setError(t("invoiceErrorGross"));
      return;
    }
    if (!issuedAt) {
      setError(t("invoiceErrorIssuedAt"));
      return;
    }
    if (!dueAt) {
      setError(t("invoiceErrorDueAt"));
      return;
    }
    if (file && file.type && file.type.toLowerCase() !== "application/pdf") {
      setError(t("invoiceErrorFileType"));
      return;
    }

    const fd = new FormData();
    fd.set("invoiceNumber", invoiceNumber.trim());
    fd.set("grossAmount", String(grossNum));
    fd.set("issuedAt", issuedAt);
    fd.set("dueAt", dueAt);
    if (file) fd.set("file", file);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/contractor/projects/${bidId}/invoice`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          reason?: string;
        } | null;
        setError(
          data?.reason === "FILE_SIZE"
            ? t("invoiceErrorFileSize")
            : data?.reason === "FILE_TYPE"
              ? t("invoiceErrorFileType")
              : t("invoiceErrorGeneric"),
        );
        return;
      }
      router.refresh();
    } catch {
      setError(t("invoiceErrorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="rounded-xl border"
      style={{
        padding: "20px 22px",
        background: "var(--color-bg-3)",
        borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <span
        className="font-mono block"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "8px",
        }}
      >
        {t("invoiceHeading")}
      </span>
      <p
        style={{
          color: "var(--color-ink-soft)",
          fontSize: "13px",
          lineHeight: 1.55,
          margin: "0 0 14px",
        }}
      >
        {t("invoiceUploadHint")}
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-md border"
          style={{
            padding: "8px 12px",
            marginBottom: "10px",
            fontSize: "12.5px",
            background:
              "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--color-danger) 30%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          {error}
        </div>
      )}

      <Field label={t("invoiceNumber")}>
        <input
          type="text"
          maxLength={64}
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          placeholder={t("invoiceNumberPlaceholder")}
          style={inputStyle}
        />
      </Field>
      <Field label={t("invoiceGross")}>
        <input
          type="text"
          inputMode="numeric"
          value={gross}
          onChange={(e) => setGross(e.target.value)}
          placeholder={t("invoiceGrossPlaceholder")}
          style={inputStyle}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("invoiceIssuedAt")}>
          <input
            type="date"
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label={t("invoiceDueAt")}>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>
      <Field label={t("invoiceFile")}>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ ...inputStyle, padding: "8px 10px" }}
        />
        <p
          className="font-mono"
          style={{
            fontSize: "10.5px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
            marginTop: "4px",
          }}
        >
          {t("invoiceFileHint")}
        </p>
      </Field>

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-full disabled:opacity-60"
        style={{
          marginTop: "10px",
          padding: "11px 16px",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 600,
          background: "var(--color-ink)",
          color: "var(--color-bg)",
        }}
      >
        {submitting ? t("invoiceSubmitting") : t("invoiceSubmit")}
      </button>
    </section>
  );
}

function InvoiceCard({
  invoice,
  locale,
  t,
}: {
  invoice: ProjectInvoiceDTO;
  locale: string;
  t: TFn;
}) {
  const paid = invoice.status === "PAID";
  const tone = paid ? "var(--color-good)" : "var(--color-ochre)";
  const label = paid ? t("invoiceStatusPaid") : t("invoiceStatusPending");

  return (
    <section
      className="rounded-xl border"
      style={{
        padding: "20px 22px",
        background: paid
          ? "color-mix(in srgb, var(--color-good) 8%, var(--color-bg-3))"
          : "var(--color-bg-3)",
        borderColor: `color-mix(in srgb, ${tone} 30%, transparent)`,
      }}
    >
      <div
        className="flex items-center justify-between gap-3"
        style={{ marginBottom: "12px" }}
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
          {t("invoiceHeading")}
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

      <p
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "22px",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          margin: "0 0 4px",
        }}
      >
        {invoice.grossAmount.toLocaleString(locale)}{" "}
        <small
          className="font-mono"
          style={{
            fontSize: "10.5px",
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
          margin: "0 0 12px",
        }}
      >
        № {invoice.invoiceNumber}
      </p>

      <dl
        className="grid"
        style={{
          gridTemplateColumns: "max-content 1fr",
          gap: "5px 14px",
          fontSize: "12px",
        }}
      >
        <Term>{t("invoiceIssuedAt")}</Term>
        <dd>{new Date(invoice.issuedAt).toLocaleDateString(locale)}</dd>
        <Term>{t("invoiceDueAt")}</Term>
        <dd>{new Date(invoice.dueAt).toLocaleDateString(locale)}</dd>
        {invoice.paidAt && (
          <>
            <Term>{t("invoicePaidAt")}</Term>
            <dd style={{ color: "var(--color-good)" }}>
              {new Date(invoice.paidAt).toLocaleDateString(locale)}
            </dd>
          </>
        )}
      </dl>

      {invoice.hasFile && (
        <a
          href={`/api/marketplace/invoices/${invoice.id}/file`}
          target="_blank"
          rel="noreferrer"
          className="font-mono inline-block"
          style={{
            marginTop: "12px",
            fontSize: "11.5px",
            color: "var(--color-ink)",
            textDecoration: "underline",
            letterSpacing: "0.04em",
          }}
        >
          {t("invoiceDownload")} ↗
        </a>
      )}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <label
        className="font-mono block"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "4px",
        }}
      >
        {label}
      </label>
      {children}
    </div>
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: "7px",
  border: "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
  background: "var(--color-bg)",
  fontSize: "13px",
  color: "var(--color-ink)",
};

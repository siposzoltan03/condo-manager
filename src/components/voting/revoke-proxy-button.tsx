"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";

interface Props {
  proxyId: string;
}

export function RevokeProxyButton({ proxyId }: Props) {
  const t = useTranslations("voting.proxy");
  const router = useRouter();
  const confirm = useConfirm();
  const [submitting, setSubmitting] = useState(false);

  async function handleRevoke() {
    const ok = await confirm({ title: t("revokeConfirm"), danger: true });
    if (!ok) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/voting/proxy?id=${encodeURIComponent(proxyId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t("errorRevoke"));
        return;
      }
      toast.success(t("revoked"));
      router.refresh();
    } catch {
      toast.error(t("errorRevoke"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRevoke}
      disabled={submitting}
      className="font-mono transition-opacity hover:opacity-70 disabled:opacity-50"
      style={{
        fontSize: "10px",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontWeight: 600,
        color: "var(--color-danger)",
        background: "transparent",
        border: 0,
        padding: "4px 0",
        cursor: submitting ? "not-allowed" : "pointer",
      }}
    >
      {submitting ? t("revoking") : t("revokeAction")}
    </button>
  );
}

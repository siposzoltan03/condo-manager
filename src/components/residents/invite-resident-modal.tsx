"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  VotingModalShell,
  VotingField,
  votingInputStyle,
} from "@/components/voting/voting-modal-shell";

interface UnitOption {
  id: string;
  number: string;
  stairwell: string | null;
}

interface Props {
  open: boolean;
  units: UnitOption[];
  onClose: () => void;
  onCreated: () => void;
}

const ROLES = ["BOARD_MEMBER", "OWNER", "TENANT"] as const;
const RELATIONSHIPS = ["OWNER", "TENANT"] as const;

export function InviteResidentModal({
  open,
  units,
  onClose,
  onCreated,
}: Props) {
  const t = useTranslations("residents");
  const tCommon = useTranslations("common");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("OWNER");
  const [unitId, setUnitId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function clearError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function reset() {
    setEmail("");
    setRole("OWNER");
    setUnitId("");
    setErrors({});
  }

  // A person's unit relationship follows from their role: a TENANT rents,
  // while an OWNER owns — and board members must be owners (Tht. § 27),
  // so anything that isn't a TENANT is recorded as the unit's OWNER. Derived
  // (not user-picked) to keep the two consistent — no "tenant owner" or
  // "board-member tenant" combinations.
  const relationship: (typeof RELATIONSHIPS)[number] =
    role === "TENANT" ? "TENANT" : "OWNER";

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = t("invite.emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = t("invite.emailInvalid");
    }
    return errs;
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
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          role,
          unitId: unitId || undefined,
          relationship: unitId ? relationship : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ submit: data.error || tCommon("error") });
        return;
      }
      toast.success(t("invite.sent"));
      reset();
      onCreated();
    } catch {
      const msg = tCommon("error");
      setErrors({ submit: msg });
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const sortedUnits = [...units].sort((a, b) => {
    const sa = a.stairwell ?? "";
    const sb = b.stairwell ?? "";
    if (sa !== sb) return sa.localeCompare(sb);
    return a.number.localeCompare(b.number, "hu", { numeric: true });
  });

  return (
    <VotingModalShell
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      eyebrow={t("invite.eyebrow")}
      title={t("invite.title")}
      subtitle={t("invite.subtitle")}
      accent="moss"
      maxWidth={520}
    >
      <form
        onSubmit={handleSubmit}
        style={{ padding: "0 24px 22px", overflowY: "auto", flex: 1 }}
      >
        {errors.submit && (
          <div
            role="alert"
            className="mb-4"
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "12.5px",
              background:
                "color-mix(in srgb, var(--color-danger) 10%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
              color: "var(--color-danger)",
            }}
          >
            {errors.submit}
          </div>
        )}

        <VotingField
          label={t("invite.emailLabel")}
          htmlFor="invite-email"
          error={errors.email}
        >
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError("email");
            }}
            placeholder="lakó@example.com"
            style={votingInputStyle(!!errors.email)}
          />
        </VotingField>

        <VotingField
          label={t("invite.roleLabel")}
          htmlFor="invite-role"
          hint={t("invite.roleHint")}
        >
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
            style={votingInputStyle(false)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`invite.role_${r}`)}
              </option>
            ))}
          </select>
        </VotingField>

        <VotingField
          label={t("invite.unitLabel")}
          htmlFor="invite-unit"
          hint={t("invite.unitHint")}
        >
          <select
            id="invite-unit"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            style={votingInputStyle(false)}
          >
            <option value="">{t("invite.unitNone")}</option>
            {sortedUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.stairwell ? `${u.stairwell} · ` : ""}
                {u.number}
              </option>
            ))}
          </select>
        </VotingField>

        <div
          className="flex justify-end items-center gap-2"
          style={{
            marginTop: "22px",
            paddingTop: "16px",
            borderTop:
              "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={submitting}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              background: "var(--color-card)",
              color: "var(--color-ink-soft)",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
              opacity: submitting ? 0.5 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {tCommon("cancel")}
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
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? tCommon("loading") : t("invite.sendCta")}
          </button>
        </div>
      </form>
    </VotingModalShell>
  );
}

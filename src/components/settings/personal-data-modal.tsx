"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updatePersonalData } from "@/app/actions/profile";
import {
  VotingModalShell,
  VotingField,
  votingInputStyle,
} from "@/components/voting/voting-modal-shell";

interface Props {
  open: boolean;
  initial: {
    phone: string | null;
    secondaryEmail: string | null;
    birthDate: string | null;
    permanentAddress: string | null;
    mailingAddress: string | null;
  };
  onClose: () => void;
}

export function PersonalDataModal({ open, initial, onClose }: Props) {
  const t = useTranslations("profile.personal");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [phone, setPhone] = useState(initial.phone ?? "");
  const [secondaryEmail, setSecondaryEmail] = useState(
    initial.secondaryEmail ?? "",
  );
  const [birthDate, setBirthDate] = useState(
    initial.birthDate ? initial.birthDate.slice(0, 10) : "",
  );
  const [permanentAddress, setPermanentAddress] = useState(
    initial.permanentAddress ?? "",
  );
  const [mailingAddress, setMailingAddress] = useState(
    initial.mailingAddress ?? "",
  );
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      secondaryEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(secondaryEmail.trim())
    ) {
      setErrors({ secondaryEmail: t("invalidEmail") });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await updatePersonalData({
        phone: phone.trim() || null,
        secondaryEmail: secondaryEmail.trim() || null,
        birthDate: birthDate || null,
        permanentAddress: permanentAddress.trim() || null,
        mailingAddress: mailingAddress.trim() || null,
      });
      if (result.error) {
        setErrors({ submit: result.error });
        return;
      }
      toast.success(t("saved"));
      router.refresh();
      onClose();
    } catch {
      const msg = tCommon("error");
      setErrors({ submit: msg });
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <VotingModalShell
      open={open}
      onClose={onClose}
      eyebrow={t("modalEyebrow")}
      title={t("modalTitle")}
      subtitle={t("modalSubtitle")}
      accent="moss"
      maxWidth={560}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <VotingField label={t("phoneLabel")} htmlFor="prof-phone">
            <input
              id="prof-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+36 30 ..."
              style={votingInputStyle(false)}
            />
          </VotingField>
          <VotingField
            label={t("birthDateLabel")}
            htmlFor="prof-birth"
            hint={t("birthDateHint")}
          >
            <input
              id="prof-birth"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              style={votingInputStyle(false)}
            />
          </VotingField>
        </div>

        <VotingField
          label={t("secondaryEmailLabel")}
          htmlFor="prof-email-2"
          hint={t("secondaryEmailHint")}
          error={errors.secondaryEmail}
        >
          <input
            id="prof-email-2"
            type="email"
            value={secondaryEmail}
            onChange={(e) => {
              setSecondaryEmail(e.target.value);
              clearError("secondaryEmail");
            }}
            placeholder="munkahely@example.com"
            style={votingInputStyle(!!errors.secondaryEmail)}
          />
        </VotingField>

        <VotingField
          label={t("permanentAddressLabel")}
          htmlFor="prof-perm-addr"
        >
          <input
            id="prof-perm-addr"
            type="text"
            value={permanentAddress}
            onChange={(e) => setPermanentAddress(e.target.value)}
            placeholder="1027 Budapest, Duna sor 14. A. 5/4."
            style={votingInputStyle(false)}
          />
        </VotingField>

        <VotingField
          label={t("mailingAddressLabel")}
          htmlFor="prof-mail-addr"
          hint={t("mailingAddressHint")}
        >
          <input
            id="prof-mail-addr"
            type="text"
            value={mailingAddress}
            onChange={(e) => setMailingAddress(e.target.value)}
            placeholder={t("mailingAddressPlaceholder")}
            style={votingInputStyle(false)}
          />
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
            onClick={onClose}
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
            {submitting ? tCommon("loading") : t("saveCta")}
          </button>
        </div>
      </form>
    </VotingModalShell>
  );
}

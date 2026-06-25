"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createVote } from "@/app/actions/voting";
import {
  VotingModalShell,
  VotingField,
  votingInputStyle,
} from "./voting-modal-shell";

interface MeetingOption {
  id: string;
  title: string;
  date: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  meetingId?: string;
  meetingTitle?: string;
}

const DEFAULT_OPTIONS = ["Igen", "Nem", "Tartózkodom"];

export function CreateVoteModal({
  open,
  onClose,
  onCreated,
  meetingId,
  meetingTitle,
}: Props) {
  const t = useTranslations("voting");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [voteType, setVoteType] = useState("YES_NO");
  const [isSecret, setIsSecret] = useState(false);
  const [majorityType, setMajorityType] = useState("SIMPLE_MAJORITY");
  const [deadline, setDeadline] = useState("");
  const [selectedMeetingId, setSelectedMeetingId] = useState(meetingId ?? "");
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [options, setOptions] = useState<{ label: string }[]>(
    DEFAULT_OPTIONS.map((label) => ({ label }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || meetingId) return;
    setLoadingMeetings(true);
    fetch("/api/voting/meetings?limit=50&upcoming=true")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.meetings) {
          setMeetings(
            data.meetings.map((m: { id: string; title: string; date: string }) => ({
              id: m.id,
              title: m.title,
              date: m.date,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMeetings(false));
  }, [open, meetingId]);

  function clearError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function addOption() {
    setOptions([...options, { label: "" }]);
  }
  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  }
  function updateOption(index: number, label: string) {
    const updated = [...options];
    updated[index] = { label };
    setOptions(updated);
    clearError(`option-${index}`);
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = t("missingFields");
    if (!deadline) errs.deadline = t("missingFields");
    options.forEach((o, i) => {
      if (!o.label.trim()) errs[`option-${i}`] = t("missingFields");
    });
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
      const result = await createVote({
        title,
        description: description || undefined,
        voteType,
        isSecret,
        majorityType,
        deadline,
        meetingId: selectedMeetingId || undefined,
        options: options.map((o) => ({ label: o.label.trim() })),
      });

      if (result.success) {
        toast.success(t("voteCreated"));
        // Reset and close on success.
        setTitle("");
        setDescription("");
        setVoteType("YES_NO");
        setIsSecret(false);
        setMajorityType("SIMPLE_MAJORITY");
        setDeadline("");
        setSelectedMeetingId(meetingId ?? "");
        setOptions(DEFAULT_OPTIONS.map((label) => ({ label })));
        onCreated();
      } else {
        setErrors({ submit: result.error || t("createFailed") });
      }
    } catch {
      toast.error(t("createFailed"));
      setErrors({ submit: t("createFailed") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <VotingModalShell
      open={open}
      onClose={onClose}
      eyebrow={t("modal.voteEyebrow")}
      title={t("createVote")}
      subtitle={
        meetingId && meetingTitle
          ? `${t("linkedToMeeting")}: ${meetingTitle}`
          : t("modal.voteSubtitle")
      }
      accent="moss"
    >
      <form
        onSubmit={handleSubmit}
        style={{
          padding: "0 24px 22px",
          overflowY: "auto",
          flex: 1,
        }}
      >
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

        <VotingField
          label={t("voteTitle")}
          htmlFor="vote-title"
          error={errors.title}
        >
          <input
            id="vote-title"
            type="text"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clearError("title");
            }}
            placeholder={t("modal.voteTitlePlaceholder")}
            style={votingInputStyle(!!errors.title)}
          />
        </VotingField>

        <VotingField label={t("description")} htmlFor="vote-description">
          <textarea
            id="vote-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t("modal.voteDescriptionPlaceholder")}
            style={{
              ...votingInputStyle(false),
              resize: "vertical",
              minHeight: "70px",
            }}
          />
        </VotingField>

        {!meetingId && (
          <VotingField
            label={t("linkToMeeting")}
            htmlFor="vote-meeting"
            hint={t("linkToMeetingHint")}
          >
            <select
              id="vote-meeting"
              value={selectedMeetingId}
              onChange={(e) => setSelectedMeetingId(e.target.value)}
              disabled={loadingMeetings}
              style={votingInputStyle(false)}
            >
              <option value="">{t("standaloneVote")}</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({new Date(m.date).toLocaleDateString("hu-HU")})
                </option>
              ))}
            </select>
          </VotingField>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <VotingField label={t("voteTypeLabel")} htmlFor="vote-type">
            <select
              id="vote-type"
              value={voteType}
              onChange={(e) => setVoteType(e.target.value)}
              style={votingInputStyle(false)}
            >
              <option value="YES_NO">{t("voteType_YES_NO")}</option>
              <option value="MULTIPLE_CHOICE">{t("voteType_MULTIPLE_CHOICE")}</option>
              <option value="RANKED_CHOICE">{t("voteType_RANKED_CHOICE")}</option>
            </select>
          </VotingField>

          <VotingField
            label={t("majorityType")}
            htmlFor="vote-majority"
            hint={t(`majorityTypeHint_${majorityType}`)}
          >
            <select
              id="vote-majority"
              value={majorityType}
              onChange={(e) => setMajorityType(e.target.value)}
              style={votingInputStyle(false)}
            >
              <option value="SIMPLE_MAJORITY">{t("majorityType_SIMPLE_MAJORITY")}</option>
              <option value="TWO_THIRDS">{t("majorityType_TWO_THIRDS")}</option>
              <option value="FOUR_FIFTHS">{t("majorityType_FOUR_FIFTHS")}</option>
              <option value="UNANIMOUS">{t("majorityType_UNANIMOUS")}</option>
              <option value="PLURALITY">{t("majorityType_PLURALITY")}</option>
            </select>
          </VotingField>
        </div>

        <VotingField
          label={t("deadline")}
          htmlFor="vote-deadline"
          error={errors.deadline}
        >
          <input
            id="vote-deadline"
            type="datetime-local"
            required
            value={deadline}
            onChange={(e) => {
              setDeadline(e.target.value);
              clearError("deadline");
            }}
            style={votingInputStyle(!!errors.deadline)}
          />
        </VotingField>

        <label
          className="flex items-center gap-2.5"
          style={{
            padding: "10px 12px",
            background: "var(--color-bg-3)",
            border: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
            borderRadius: "8px",
            marginBottom: "14px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          <input
            type="checkbox"
            checked={isSecret}
            onChange={(e) => setIsSecret(e.target.checked)}
            style={{ accentColor: "var(--color-moss-2)", width: "16px", height: "16px" }}
          />
          <span>{t("secretBallotToggle")}</span>
        </label>

        <div style={{ marginBottom: "14px" }}>
          <label
            className="block font-mono"
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--color-muted)",
              marginBottom: "6px",
            }}
          >
            {t("options")}
          </label>
          <div className="space-y-2">
            {options.map((opt, index) => {
              const optErr = errors[`option-${index}`];
              return (
                <div key={index} className="flex items-center gap-2">
                  <span
                    className="font-mono grid place-items-center flex-shrink-0"
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "6px",
                      background:
                        index === 0
                          ? "color-mix(in srgb, var(--color-moss-2) 22%, transparent)"
                          : index === 1
                            ? "color-mix(in srgb, var(--color-danger) 12%, transparent)"
                            : "color-mix(in srgb, var(--color-ink) 8%, transparent)",
                      color:
                        index === 0
                          ? "var(--color-moss-2)"
                          : index === 1
                            ? "var(--color-danger)"
                            : "var(--color-ink-soft)",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`${t("optionLabel")} ${index + 1}`}
                    style={{
                      ...votingInputStyle(!!optErr),
                      flex: 1,
                    }}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="grid place-items-center transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] flex-shrink-0"
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "6px",
                        color: "var(--color-muted)",
                      }}
                      aria-label="Remove option"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addOption}
            className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
            style={{
              marginTop: "10px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-ink-soft)",
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
            }}
          >
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
            {t("addOption")}
          </button>
        </div>

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
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {t("cancel")}
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
            {submitting ? (
              <>
                <Spinner /> {t("creating")}
              </>
            ) : (
              <>
                <PlusIcon /> {t("createVote")}
              </>
            )}
          </button>
        </div>
      </form>
    </VotingModalShell>
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

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AgendaEditor, AgendaItem } from "./agenda-editor";
import {
  VotingModalShell,
  VotingField,
  votingInputStyle,
} from "./voting-modal-shell";

interface PendingItem {
  id: string;
  kind: "COMPLAINT_ESCALATION" | "BOARD_RESIGNATION";
  title: string;
  description: string | null;
  complaintTrackingNumber: string | null;
  resignationResidentName: string | null;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateMeetingModal({ open, onClose, onCreated }: Props) {
  const t = useTranslations("voting");
  const tPending = useTranslations("voting.pendingAgenda");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [isRepeated, setIsRepeated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pending-agenda queue — fetched on open, items the board can pull onto
  // this new meeting's agenda.
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/pending-agenda-items?status=unattached")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items: PendingItem[] } | null) => {
        if (!cancelled && d?.items) setPending(d.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  function clearError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = t("missingFields");
    if (!date) errs.date = t("missingFields");
    if (!time) errs.time = t("missingFields");
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
      const res = await fetch("/api/voting/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          date,
          time,
          location: location || null,
          agenda: agenda.filter((a) => a.title.trim()),
          isRepeated,
          pendingAgendaItemIds: Array.from(selectedIds),
        }),
      });

      if (res.ok) {
        toast.success(t("meetingCreated"));
        // Reset on success.
        setTitle("");
        setDescription("");
        setDate("");
        setTime("");
        setLocation("");
        setAgenda([]);
        setIsRepeated(false);
        setSelectedIds(new Set());
        setPending([]);
        onCreated();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrors({ submit: data.error || t("createFailed") });
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
      eyebrow={t("modal.meetingEyebrow")}
      title={t("createMeeting")}
      subtitle={t("modal.meetingSubtitle")}
      accent="ochre"
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
          label={t("meetingTitle")}
          htmlFor="meeting-title"
          error={errors.title}
        >
          <input
            id="meeting-title"
            type="text"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clearError("title");
            }}
            placeholder={t("modal.meetingTitlePlaceholder")}
            style={votingInputStyle(!!errors.title)}
          />
        </VotingField>

        <VotingField label={t("description")} htmlFor="meeting-description">
          <textarea
            id="meeting-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t("modal.meetingDescriptionPlaceholder")}
            style={{
              ...votingInputStyle(false),
              resize: "vertical",
              minHeight: "70px",
            }}
          />
        </VotingField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <VotingField
            label={t("meetingDate")}
            htmlFor="meeting-date"
            error={errors.date}
          >
            <input
              id="meeting-date"
              type="date"
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                clearError("date");
              }}
              style={votingInputStyle(!!errors.date)}
            />
          </VotingField>
          <VotingField
            label={t("meetingTime")}
            htmlFor="meeting-time"
            error={errors.time}
          >
            <input
              id="meeting-time"
              type="time"
              required
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                clearError("time");
              }}
              style={votingInputStyle(!!errors.time)}
            />
          </VotingField>
        </div>

        <VotingField label={t("meetingLocation")} htmlFor="meeting-location">
          <input
            id="meeting-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("locationPlaceholder")}
            style={votingInputStyle(false)}
          />
        </VotingField>

        <label
          className="flex items-start gap-2.5"
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
            checked={isRepeated}
            onChange={(e) => setIsRepeated(e.target.checked)}
            style={{
              accentColor: "var(--color-ochre)",
              width: "16px",
              height: "16px",
              marginTop: "2px",
              flexShrink: 0,
            }}
          />
          <span>
            <span style={{ display: "block", fontWeight: 600 }}>
              {t("isRepeated")}
            </span>
            {isRepeated && (
              <span
                style={{
                  display: "block",
                  fontSize: "11.5px",
                  color: "var(--color-ink-soft)",
                  marginTop: "2px",
                }}
              >
                {t("isRepeatedHint")}
              </span>
            )}
          </span>
        </label>

        {pending.length > 0 && (
          <div
            style={{
              background:
                "color-mix(in srgb, var(--color-ochre) 8%, var(--color-bg))",
              border:
                "1px solid color-mix(in srgb, var(--color-ochre) 30%, transparent)",
              borderRadius: "10px",
              padding: "12px 14px",
              marginBottom: "16px",
            }}
          >
            <div
              className="flex items-baseline justify-between"
              style={{ marginBottom: "8px" }}
            >
              <div
                className="font-mono"
                style={{
                  fontSize: "10.5px",
                  color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                📋 {tPending("title", { n: pending.length.toString() })}
              </div>
              {selectedIds.size < pending.length ? (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(new Set(pending.map((p) => p.id)))
                  }
                  className="font-mono"
                  style={{
                    background: "transparent",
                    border: 0,
                    fontSize: "10px",
                    color: "var(--color-ink-soft)",
                    cursor: "pointer",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {tPending("selectAll")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="font-mono"
                  style={{
                    background: "transparent",
                    border: 0,
                    fontSize: "10px",
                    color: "var(--color-ink-soft)",
                    cursor: "pointer",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {tPending("clearAll")}
                </button>
              )}
            </div>
            <p
              style={{
                fontSize: "11.5px",
                color: "var(--color-ink-soft)",
                marginBottom: "10px",
              }}
            >
              {tPending("subtitle")}
            </p>
            <div className="flex flex-col gap-1">
              {pending.map((p) => {
                const checked = selectedIds.has(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex items-start gap-2 transition-colors"
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: checked
                        ? "var(--color-card)"
                        : "transparent",
                      border: checked
                        ? "1px solid color-mix(in srgb, var(--color-ochre) 40%, transparent)"
                        : "1px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(p.id);
                          else next.delete(p.id);
                          return next;
                        })
                      }
                      style={{
                        accentColor: "var(--color-ochre)",
                        marginTop: "3px",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        className="flex items-center gap-1.5"
                        style={{ marginBottom: "2px" }}
                      >
                        <KindIcon kind={p.kind} />
                        <span
                          style={{
                            fontSize: "12.5px",
                            fontWeight: 600,
                          }}
                        >
                          {p.title}
                        </span>
                        {p.complaintTrackingNumber && (
                          <span
                            className="font-mono"
                            style={{
                              fontSize: "9.5px",
                              color: "var(--color-muted)",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {p.complaintTrackingNumber}
                          </span>
                        )}
                      </span>
                      {p.description && (
                        <span
                          className="block"
                          style={{
                            fontSize: "11.5px",
                            color: "var(--color-ink-soft)",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {p.description}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <AgendaEditor items={agenda} onChange={setAgenda} />

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
                <CalendarPlusIcon /> {t("createMeeting")}
              </>
            )}
          </button>
        </div>
      </form>
    </VotingModalShell>
  );
}

function KindIcon({
  kind,
}: {
  kind: "COMPLAINT_ESCALATION" | "BOARD_RESIGNATION";
}) {
  return (
    <span
      aria-hidden
      style={{
        fontSize: "12px",
        lineHeight: 1,
      }}
    >
      {kind === "COMPLAINT_ESCALATION" ? "⚠️" : "👋"}
    </span>
  );
}

function CalendarPlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 11v6M9 14h6" />
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

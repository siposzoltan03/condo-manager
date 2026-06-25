"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ALLOWED_TRANSITIONS } from "@/lib/complaint-transitions";
import type { ComplaintStatus } from "@prisma/client";
import type { ComplaintDetailData } from "@/lib/dal";

interface MeetingOption {
  id: string;
  title: string;
  date: string;
}

type StatusKey =
  | "REPORTED"
  | "ACKNOWLEDGED"
  | "WARNING_SENT"
  | "MEDIATION"
  | "RESOLVED"
  | "ESCALATED";

const STATUS_PILL: Record<
  StatusKey,
  { bg: string; fg: string }
> = {
  REPORTED: { bg: "var(--color-bg-3)", fg: "var(--color-ink)" },
  ACKNOWLEDGED: {
    bg: "color-mix(in srgb, var(--color-moss) 18%, transparent)",
    fg: "var(--color-moss)",
  },
  WARNING_SENT: {
    bg: "color-mix(in srgb, var(--color-ochre) 25%, transparent)",
    fg: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
  },
  MEDIATION: {
    bg: "color-mix(in srgb, var(--color-ink) 12%, transparent)",
    fg: "var(--color-ink)",
  },
  RESOLVED: {
    bg: "color-mix(in srgb, var(--color-moss) 70%, transparent)",
    fg: "#fff",
  },
  ESCALATED: { bg: "#c44", fg: "#fff" },
};

interface Props {
  complaint: ComplaintDetailData;
  locale: string;
}

export function ComplaintDetailView({ complaint, locale }: Props) {
  const t = useTranslations("complaints");
  const router = useRouter();

  // Status-transition modal state.
  const [pendingTransition, setPendingTransition] =
    useState<ComplaintStatus | null>(null);
  const [transitionNote, setTransitionNote] = useState("");
  const [submittingTransition, setSubmittingTransition] = useState(false);
  const [meetingId, setMeetingId] = useState<string>("");
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [meetingsLoaded, setMeetingsLoaded] = useState(false);

  // Resolve / re-open modal state for the pending agenda item.
  type AgendaInfo = NonNullable<ComplaintDetailData["pendingAgenda"]>;
  const [resolvingItem, setResolvingItem] = useState<AgendaInfo | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [createNewMeeting, setCreateNewMeeting] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [newMeetingDate, setNewMeetingDate] = useState("");
  const [newMeetingTime, setNewMeetingTime] = useState("18:00");

  // Lazy-load upcoming meetings the first time the user opens the escalate
  // modal — irrelevant otherwise.
  useEffect(() => {
    if (pendingTransition !== "ESCALATED") return;
    if (meetingsLoaded || meetingsLoading) return;
    setMeetingsLoading(true);
    fetch("/api/meetings/upcoming")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { meetings: MeetingOption[] } | null) => {
        setMeetings(d?.meetings ?? []);
      })
      .catch(() => {})
      .finally(() => {
        setMeetingsLoaded(true);
        setMeetingsLoading(false);
      });
  }, [pendingTransition, meetingsLoaded, meetingsLoading]);

  // Note composer state.
  const [noteBody, setNoteBody] = useState("");
  const [noteIsInternal, setNoteIsInternal] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);

  const allowedNext = ALLOWED_TRANSITIONS[complaint.status as ComplaintStatus];

  function isEscalateReady(): boolean {
    if (pendingTransition !== "ESCALATED") return true;
    if (createNewMeeting) {
      return Boolean(
        newMeetingTitle.trim() && newMeetingDate && newMeetingTime,
      );
    }
    return Boolean(meetingId);
  }

  async function applyTransition() {
    if (!pendingTransition || submittingTransition) return;
    if (pendingTransition === "ESCALATED" && !isEscalateReady()) {
      toast.error(t("escalate.meetingRequired"));
      return;
    }
    setSubmittingTransition(true);
    try {
      const res = await fetch(`/api/complaints/${complaint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: pendingTransition,
          note: transitionNote.trim() || undefined,
          escalatedMeetingId:
            pendingTransition === "ESCALATED" && !createNewMeeting
              ? meetingId
              : undefined,
          newMeeting:
            pendingTransition === "ESCALATED" && createNewMeeting
              ? {
                  title: newMeetingTitle,
                  date: newMeetingDate,
                  time: newMeetingTime,
                }
              : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "transition failed");
      }
      setPendingTransition(null);
      setTransitionNote("");
      setMeetingId("");
      setCreateNewMeeting(false);
      setNewMeetingTitle("");
      setNewMeetingDate("");
      setNewMeetingTime("18:00");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "transition failed");
    } finally {
      setSubmittingTransition(false);
    }
  }

  async function postNote() {
    if (!noteBody.trim() || submittingNote) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/complaints/${complaint.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: noteBody,
          isInternal: complaint.isBoardPlus ? noteIsInternal : false,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "save failed");
      }
      setNoteBody("");
      setNoteIsInternal(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "save failed");
    } finally {
      setSubmittingNote(false);
    }
  }

  const pill = STATUS_PILL[complaint.status as StatusKey];

  return (
    <>
      {/* Title row */}
      <div
        className="flex items-start justify-between gap-6 flex-wrap"
        style={{ marginBottom: "20px" }}
      >
        <div className="flex-1 min-w-0">
          <a
            href={`/${locale}/complaints`}
            className="font-mono"
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.05em",
              textDecoration: "none",
            }}
          >
            {t("detail.back")}
          </a>
          <div
            className="flex items-center gap-2.5 flex-wrap"
            style={{ marginTop: "8px" }}
          >
            {complaint.category.icon && (
              <span aria-hidden style={{ fontSize: "26px", lineHeight: 1 }}>
                {complaint.category.icon}
              </span>
            )}
            <h1
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "32px",
                fontWeight: 500,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginRight: "auto",
              }}
            >
              {complaint.title ?? complaint.trackingNumber}
            </h1>
          </div>
          <div
            className="font-mono flex items-center gap-3 flex-wrap"
            style={{
              marginTop: "10px",
              fontSize: "11px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                padding: "3px 9px",
                borderRadius: "4px",
                background: pill.bg,
                color: pill.fg,
                fontWeight: 600,
                fontSize: "10px",
              }}
            >
              {t(`status_${complaint.status as StatusKey}` as const)}
            </span>
            <span>{complaint.category.name}</span>
            <span>{complaint.trackingNumber}</span>
            {complaint.isPrivate && <span>🔒 {t("card.private")}</span>}
          </div>
        </div>
      </div>

      {/* 2-column layout — stacks on phone, sidebar collapses below
          main content. Tablet/desktop gets the original side-by-side. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        {/* Main column */}
        <div className="min-w-0 flex flex-col gap-4">
          {/* Description */}
          <Section title={t("detail.section.description")}>
            <p
              style={{
                fontSize: "14px",
                lineHeight: 1.6,
                color: "var(--color-ink)",
                whiteSpace: "pre-wrap",
              }}
            >
              {complaint.description}
            </p>
          </Section>

          {/* Photos */}
          {complaint.photos.length > 0 && (
            <Section title={t("detail.section.photos")}>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                }}
              >
                {complaint.photos.map((p, i) => (
                  <a
                    key={i}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      aspectRatio: "4 / 3",
                      borderRadius: "10px",
                      background: "var(--color-bg-3)",
                      border:
                        "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
                      display: "grid",
                      placeItems: "center",
                      color: "var(--color-ink-soft)",
                      textDecoration: "none",
                      fontSize: "11px",
                      padding: "8px",
                      textAlign: "center",
                      overflow: "hidden",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "20px" }}>📷</div>
                      <div
                        className="font-mono"
                        style={{
                          marginTop: "4px",
                          fontSize: "9.5px",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {p.name}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* Timeline */}
          <Section title={t("detail.section.timeline")}>
            <div className="flex flex-col gap-3">
              {complaint.statusChanges.map((evt, i) => (
                <TimelineRow
                  key={i}
                  evt={evt}
                  fromLabel={
                    evt.fromStatus
                      ? t(`status_${evt.fromStatus as StatusKey}` as const)
                      : null
                  }
                  toLabel={t(`status_${evt.toStatus as StatusKey}` as const)}
                />
              ))}
            </div>
          </Section>

          {/* Notes */}
          <Section title={t("detail.section.notes")}>
            {complaint.notes.length === 0 ? (
              <div
                style={{
                  color: "var(--color-muted)",
                  fontSize: "12.5px",
                  fontStyle: "italic",
                  padding: "8px 0",
                }}
              >
                {t("notes.empty")}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {complaint.notes.map((n) => (
                  <NoteRow key={n.id} note={n} />
                ))}
              </div>
            )}

            {/* Note composer */}
            <div
              style={{
                marginTop: "14px",
                paddingTop: "14px",
                borderTop:
                  "1px solid color-mix(in srgb, var(--color-ink) 7%, transparent)",
              }}
            >
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder={t("notes.placeholder")}
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    postNote();
                  }
                }}
                style={{
                  width: "100%",
                  background: "var(--color-bg)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "13.5px",
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <div
                className="flex items-center gap-2"
                style={{ marginTop: "8px" }}
              >
                {complaint.isBoardPlus && (
                  <label
                    className="font-mono inline-flex items-center gap-1.5"
                    style={{
                      fontSize: "10px",
                      color: noteIsInternal ? "var(--color-ink)" : "var(--color-muted)",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={noteIsInternal}
                      onChange={(e) => setNoteIsInternal(e.target.checked)}
                    />
                    {t("notes.internal")}
                  </label>
                )}
                <button
                  type="button"
                  onClick={postNote}
                  disabled={submittingNote || !noteBody.trim()}
                  className="ml-auto transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{
                    padding: "7px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "7px",
                    background: "var(--color-ink)",
                    color: "var(--color-bg)",
                    border: 0,
                    cursor: submittingNote ? "not-allowed" : "pointer",
                  }}
                >
                  {t("notes.send")}
                </button>
              </div>
            </div>
          </Section>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <Sidecard>
            <Field label={t("detail.reporter")}>
              <div className="flex items-center gap-2">
                <span
                  className="grid place-items-center flex-shrink-0"
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    background: "var(--color-ochre)",
                    color: "var(--color-ink)",
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                    fontWeight: 600,
                    fontSize: "10px",
                  }}
                >
                  {initials(complaint.author.name)}
                </span>
                <span style={{ fontSize: "13px", fontWeight: 500 }}>
                  {complaint.author.name}
                </span>
              </div>
            </Field>
            <Field label={t("detail.respondent")}>
              {complaint.respondentUnit ? (
                <a
                  href={`/${locale}/units`}
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--color-ink)",
                    textDecoration: "none",
                  }}
                >
                  {complaint.respondentUnit.label}
                </a>
              ) : (
                <span
                  style={{
                    fontSize: "12.5px",
                    color: "var(--color-muted)",
                    fontStyle: "italic",
                  }}
                >
                  {t("detail.noRespondent")}
                </span>
              )}
            </Field>
            {complaint.pendingAgenda && (
              <AgendaStatusField
                locale={locale}
                pa={complaint.pendingAgenda}
                isBoardPlus={complaint.isBoardPlus}
                onResolveClick={() => setResolvingItem(complaint.pendingAgenda)}
              />
            )}
            <div
              className="font-mono"
              style={{
                fontSize: "10px",
                color: "var(--color-muted)",
                letterSpacing: "0.04em",
                paddingTop: "12px",
                borderTop:
                  "1px solid color-mix(in srgb, var(--color-ink) 7%, transparent)",
                marginTop: "4px",
              }}
            >
              {t("detail.createdAt", {
                date: new Date(complaint.createdAt).toLocaleString("hu-HU", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </div>
          </Sidecard>

          {complaint.isBoardPlus && allowedNext.length > 0 && (
            <Sidecard>
              <div
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  marginBottom: "10px",
                }}
              >
                {t("detail.actionsTitle")}
              </div>
              <div className="flex flex-col gap-1.5">
                {allowedNext.map((next) => (
                  <button
                    key={next}
                    type="button"
                    onClick={() => setPendingTransition(next)}
                    className="text-left transition-colors hover:bg-[var(--color-bg-3)]"
                    style={{
                      padding: "9px 12px",
                      fontSize: "12.5px",
                      fontWeight: 500,
                      borderRadius: "8px",
                      background: "transparent",
                      color: "var(--color-ink)",
                      border:
                        "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                      cursor: "pointer",
                    }}
                  >
                    {transitionLabel(next, t)}
                  </button>
                ))}
              </div>
            </Sidecard>
          )}
        </div>
      </div>

      {/* Transition modal */}
      {pendingTransition && (
        <div
          className="fixed inset-0 z-50 grid place-items-center"
          style={{
            background: "color-mix(in srgb, var(--color-ink) 50%, transparent)",
          }}
          onClick={() => !submittingTransition && setPendingTransition(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(480px, 92vw)",
              background: "var(--color-card)",
              borderRadius: "16px",
              padding: "22px 24px",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "18px",
                fontWeight: 600,
                letterSpacing: "-0.018em",
                marginBottom: "10px",
              }}
            >
              {transitionLabel(pendingTransition, t)}
            </h2>

            {pendingTransition === "ESCALATED" && (
              <div style={{ marginBottom: "14px" }}>
                <div
                  className="flex items-baseline justify-between"
                  style={{ marginBottom: "6px" }}
                >
                  <label
                    className="font-mono"
                    style={{
                      fontSize: "10px",
                      color: "var(--color-muted)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {t("escalate.meetingLabel")}
                  </label>
                  {meetingsLoaded && meetings.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCreateNewMeeting((v) => !v)}
                      className="font-mono"
                      style={{
                        background: "transparent",
                        border: 0,
                        color: "var(--color-ink-soft)",
                        fontSize: "10px",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      {createNewMeeting
                        ? t("escalate.useExistingCta")
                        : t("escalate.newMeetingCta")}
                    </button>
                  )}
                </div>

                {createNewMeeting || (meetingsLoaded && meetings.length === 0) ? (
                  <NewMeetingForm
                    title={newMeetingTitle}
                    date={newMeetingDate}
                    time={newMeetingTime}
                    onTitle={setNewMeetingTitle}
                    onDate={setNewMeetingDate}
                    onTime={setNewMeetingTime}
                    hint={t("escalate.newMeetingHint")}
                    titleLabel={t("escalate.newMeetingTitle")}
                    titlePh={t("escalate.newMeetingTitlePh")}
                    dateLabel={t("escalate.newMeetingDate")}
                    timeLabel={t("escalate.newMeetingTime")}
                    showRevertButton={
                      meetingsLoaded && meetings.length === 0
                        ? false
                        : createNewMeeting
                    }
                  />
                ) : (
                  <select
                    value={meetingId}
                    onChange={(e) => setMeetingId(e.target.value)}
                    disabled={meetingsLoading}
                    style={{
                      width: "100%",
                      background: "var(--color-bg)",
                      border:
                        "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      fontSize: "13.5px",
                      outline: "none",
                    }}
                  >
                    <option value="">— {t("escalate.meetingPlaceholder")} —</option>
                    {meetings.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} ·{" "}
                        {new Date(m.date).toLocaleDateString("hu-HU", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </option>
                    ))}
                  </select>
                )}

                {meetingsLoaded && meetings.length === 0 && (
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "11px",
                      color: "var(--color-muted)",
                      fontStyle: "italic",
                    }}
                  >
                    {t("escalate.noMeetings")}
                  </div>
                )}
              </div>
            )}

            <label
              className="font-mono block"
              style={{
                fontSize: "10px",
                color: "var(--color-muted)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              {t("detail.noteOptional")}
            </label>
            <textarea
              value={transitionNote}
              onChange={(e) => setTransitionNote(e.target.value)}
              placeholder={t("detail.notePlaceholder")}
              rows={3}
              style={{
                width: "100%",
                background: "var(--color-bg)",
                border:
                  "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "13.5px",
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
                marginBottom: "16px",
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingTransition(null)}
                disabled={submittingTransition}
                style={{
                  padding: "8px 14px",
                  fontSize: "12.5px",
                  fontWeight: 500,
                  borderRadius: "8px",
                  background: "transparent",
                  color: "var(--color-ink)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
                  cursor: "pointer",
                }}
              >
                {t("detail.cancel")}
              </button>
              <button
                type="button"
                onClick={applyTransition}
                disabled={submittingTransition || !isEscalateReady()}
                className="transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  padding: "8px 18px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  background: "var(--color-ink)",
                  color: "var(--color-bg)",
                  border: 0,
                  cursor: submittingTransition ? "not-allowed" : "pointer",
                }}
              >
                {t("detail.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve modal */}
      {resolvingItem && (
        <div
          className="fixed inset-0 z-50 grid place-items-center"
          style={{
            background: "color-mix(in srgb, var(--color-ink) 50%, transparent)",
          }}
          onClick={() => !resolveSubmitting && setResolvingItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(480px, 92vw)",
              background: "var(--color-card)",
              borderRadius: "16px",
              padding: "22px 24px",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "18px",
                fontWeight: 600,
                letterSpacing: "-0.018em",
                marginBottom: "4px",
              }}
            >
              {t("agenda.resolveModalTitle")}
            </h2>
            <p
              style={{
                fontSize: "12.5px",
                color: "var(--color-ink-soft)",
                marginBottom: "14px",
              }}
            >
              {t("agenda.resolveModalSubtitle")}
            </p>
            <label
              className="font-mono block"
              style={{
                fontSize: "10px",
                color: "var(--color-muted)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              {t("agenda.resolveNoteLabel")}
            </label>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder={t("agenda.resolveNotePh")}
              rows={3}
              style={{
                width: "100%",
                background: "var(--color-bg)",
                border:
                  "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "13.5px",
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
                marginBottom: "16px",
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolvingItem(null)}
                disabled={resolveSubmitting}
                style={{
                  padding: "8px 14px",
                  fontSize: "12.5px",
                  fontWeight: 500,
                  borderRadius: "8px",
                  background: "transparent",
                  color: "var(--color-ink)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
                  cursor: "pointer",
                }}
              >
                {t("detail.cancel")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!resolvingItem || resolveSubmitting) return;
                  setResolveSubmitting(true);
                  try {
                    const r = await fetch(
                      `/api/pending-agenda-items/${resolvingItem.id}/resolve`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          note: resolveNote.trim() || undefined,
                        }),
                      },
                    );
                    if (!r.ok) {
                      const d = await r.json().catch(() => ({}));
                      throw new Error(d.error || "resolve failed");
                    }
                    setResolvingItem(null);
                    setResolveNote("");
                    router.refresh();
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "resolve failed",
                    );
                  } finally {
                    setResolveSubmitting(false);
                  }
                }}
                disabled={resolveSubmitting}
                className="transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  padding: "8px 18px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  background: "var(--color-ink)",
                  color: "var(--color-bg)",
                  border: 0,
                  cursor: resolveSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {t("agenda.resolveCta")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────

function transitionLabel(
  s: ComplaintStatus,
  t: ReturnType<typeof useTranslations<"complaints">>,
): string {
  // RESOLVED -> MEDIATION = reopen
  if (s === "MEDIATION") {
    // can be either "Mediáció indítása" or reopen — context-free we use the
    // more common label.
    return t("transition.MEDIATION");
  }
  return t(`transition.${s}` as const);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function relativeDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NewMeetingForm({
  title,
  date,
  time,
  onTitle,
  onDate,
  onTime,
  hint,
  titleLabel,
  titlePh,
  dateLabel,
  timeLabel,
}: {
  title: string;
  date: string;
  time: string;
  onTitle: (v: string) => void;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
  hint: string;
  titleLabel: string;
  titlePh: string;
  dateLabel: string;
  timeLabel: string;
  // tolerated for backwards-compat with the call site, currently unused
  showRevertButton?: boolean;
}) {
  return (
    <div
      style={{
        background:
          "color-mix(in srgb, var(--color-moss) 8%, var(--color-bg))",
        border:
          "1px solid color-mix(in srgb, var(--color-moss) 30%, transparent)",
        borderRadius: "10px",
        padding: "12px",
      }}
    >
      <FieldLabel>{titleLabel}</FieldLabel>
      <input
        type="text"
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder={titlePh}
        style={{
          width: "100%",
          background: "var(--color-bg)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
          borderRadius: "8px",
          padding: "8px 10px",
          fontSize: "13.5px",
          outline: "none",
          marginBottom: "10px",
        }}
      />
      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 130px" }}>
        <div>
          <FieldLabel>{dateLabel}</FieldLabel>
          <input
            type="date"
            value={date}
            onChange={(e) => onDate(e.target.value)}
            style={{
              width: "100%",
              background: "var(--color-bg)",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
              borderRadius: "8px",
              padding: "8px 10px",
              fontSize: "13.5px",
              outline: "none",
            }}
          />
        </div>
        <div>
          <FieldLabel>{timeLabel}</FieldLabel>
          <input
            type="time"
            value={time}
            onChange={(e) => onTime(e.target.value)}
            style={{
              width: "100%",
              background: "var(--color-bg)",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
              borderRadius: "8px",
              padding: "8px 10px",
              fontSize: "13.5px",
              outline: "none",
            }}
          />
        </div>
      </div>
      <div
        className="font-mono"
        style={{
          marginTop: "8px",
          fontSize: "10.5px",
          color: "var(--color-moss)",
          letterSpacing: "0.04em",
        }}
      >
        ✓ {hint}
      </div>
    </div>
  );
}

function AgendaStatusField({
  locale,
  pa,
  isBoardPlus,
  onResolveClick,
}: {
  locale: string;
  pa: NonNullable<ComplaintDetailData["pendingAgenda"]>;
  isBoardPlus: boolean;
  onResolveClick: () => void;
}) {
  const t = useTranslations("complaints.agenda");
  const tDetail = useTranslations("complaints.detail");

  const pillBg =
    pa.state === "resolved"
      ? "color-mix(in srgb, var(--color-moss) 70%, transparent)"
      : pa.state === "attached"
        ? "color-mix(in srgb, var(--color-ochre) 25%, transparent)"
        : "var(--color-bg-3)";
  const pillFg =
    pa.state === "resolved"
      ? "#fff"
      : pa.state === "attached"
        ? "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))"
        : "var(--color-ink-soft)";
  const pillLabel =
    pa.state === "resolved"
      ? t("resolved")
      : pa.state === "attached"
        ? t("attached")
        : t("queued");

  return (
    <div>
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: "6px",
          fontWeight: 600,
        }}
      >
        {tDetail("escalation")}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="font-mono"
          style={{
            fontSize: "9.5px",
            padding: "3px 8px",
            borderRadius: "4px",
            background: pillBg,
            color: pillFg,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {pillLabel}
        </span>
        {pa.state === "queued" && (
          <span
            style={{
              fontSize: "11.5px",
              color: "var(--color-ink-soft)",
              fontStyle: "italic",
            }}
          >
            {t("queuedHint")}
          </span>
        )}
      </div>

      {pa.attachedMeeting && (
        <a
          href={`/${locale}/voting/meetings/${pa.attachedMeeting.id}`}
          className="block"
          style={{
            marginTop: "8px",
            fontSize: "12.5px",
            color: "var(--color-ink)",
            textDecoration: "none",
          }}
        >
          {pa.attachedMeeting.title}
          <span
            className="font-mono block"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              marginTop: "2px",
              letterSpacing: "0.04em",
            }}
          >
            {new Date(pa.attachedMeeting.date).toLocaleDateString("hu-HU", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </a>
      )}

      {pa.state === "resolved" && pa.resolvedAt && pa.resolvedBy && (
        <div
          className="font-mono"
          style={{
            marginTop: "8px",
            fontSize: "10.5px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
          }}
        >
          ✓{" "}
          {t("resolvedBy", {
            name: pa.resolvedBy.name,
            date: new Date(pa.resolvedAt).toLocaleDateString("hu-HU", {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
          })}
        </div>
      )}
      {pa.state === "resolved" && pa.resolutionNote && (
        <p
          style={{
            marginTop: "6px",
            fontSize: "12px",
            color: "var(--color-ink-soft)",
            fontStyle: "italic",
            lineHeight: 1.45,
          }}
        >
          “{pa.resolutionNote}”
        </p>
      )}

      {isBoardPlus && pa.state !== "resolved" && (
        <button
          type="button"
          onClick={onResolveClick}
          className="font-mono transition-opacity hover:opacity-90"
          style={{
            marginTop: "8px",
            background: "transparent",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
            color: "var(--color-ink)",
            fontSize: "10px",
            padding: "5px 10px",
            borderRadius: "6px",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ✓ {t("resolveCta")}
        </button>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="font-mono block"
      style={{
        fontSize: "10px",
        color: "var(--color-muted)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        marginBottom: "4px",
        fontWeight: 600,
      }}
    >
      {children}
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
        borderRadius: "14px",
        padding: "18px 22px",
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: "10.5px",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: "12px",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Sidecard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
        borderRadius: "14px",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {children}
    </div>
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
    <div>
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: "4px",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function TimelineRow({
  evt,
  fromLabel,
  toLabel,
}: {
  evt: ComplaintDetailData["statusChanges"][number];
  fromLabel: string | null;
  toLabel: string;
}) {
  return (
    <div
      className="flex gap-3"
      style={{
        paddingBottom: "10px",
        borderBottom:
          "1px dashed color-mix(in srgb, var(--color-ink) 8%, transparent)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: "10px",
          height: "10px",
          marginTop: "5px",
          borderRadius: "50%",
          background: "var(--color-ochre)",
          flexShrink: 0,
        }}
      />
      <div className="flex-1 min-w-0">
        <div
          style={{ fontSize: "13px", fontWeight: 500 }}
        >
          {fromLabel ? (
            <>
              <span style={{ color: "var(--color-muted)" }}>
                {fromLabel}
              </span>
              <span style={{ color: "var(--color-muted)" }}> → </span>
              <span style={{ fontWeight: 600 }}>{toLabel}</span>
            </>
          ) : (
            <span style={{ fontWeight: 600 }}>{toLabel}</span>
          )}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
            marginTop: "2px",
          }}
        >
          {evt.actor.name} · {relativeDate(evt.date)}
        </div>
        {evt.note && (
          <div
            style={{
              fontSize: "12.5px",
              color: "var(--color-ink-soft)",
              marginTop: "4px",
              fontStyle: "italic",
            }}
          >
            “{evt.note}”
          </div>
        )}
      </div>
    </div>
  );
}

function NoteRow({
  note,
}: {
  note: ComplaintDetailData["notes"][number];
}) {
  const t = useTranslations("complaints");
  return (
    <div
      style={{
        background: note.isInternal
          ? "color-mix(in srgb, var(--color-ochre) 12%, transparent)"
          : "var(--color-bg)",
        border: note.isInternal
          ? "1px solid color-mix(in srgb, var(--color-ochre) 32%, transparent)"
          : "1px solid color-mix(in srgb, var(--color-ink) 7%, transparent)",
        borderRadius: "10px",
        padding: "10px 12px",
      }}
    >
      <div
        className="flex items-baseline gap-2"
        style={{ marginBottom: "4px" }}
      >
        <strong style={{ fontSize: "12.5px", fontWeight: 600 }}>
          {note.author.name}
        </strong>
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
          }}
        >
          {relativeDate(note.createdAt)}
        </span>
        {note.isInternal && (
          <span
            className="font-mono"
            style={{
              fontSize: "9px",
              padding: "1px 6px",
              borderRadius: "3px",
              background: "var(--color-ochre)",
              color: "var(--color-ink)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {t("notes.internalBadge")}
          </span>
        )}
      </div>
      <p
        style={{
          fontSize: "13px",
          lineHeight: 1.5,
          color: "var(--color-ink)",
          whiteSpace: "pre-wrap",
        }}
      >
        {note.body}
      </p>
    </div>
  );
}

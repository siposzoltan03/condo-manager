"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  ClipboardList,
  Vote,
  Calendar,
  MapPin,
  Clock,
  Pencil,
  Check,
  X,
  Loader2,
  Plus,
} from "lucide-react";
import { PdfDownloadButton } from "@/components/reports/pdf-download-button";
import { AttendeesPanel } from "./attendees-panel";
import { AttendancePanel } from "./attendance-panel";
import { VoteResultCard } from "./vote-result-card";
import { MinutesViewer } from "./minutes-viewer";
import { MinutesEditor } from "./minutes-editor";
import { AgendaEditor, AgendaItem } from "./agenda-editor";
import { CreateVoteModal } from "./create-vote-modal";
import { QuickVotePanel } from "./quick-vote-panel";
import { MinutesSignaturesPanel } from "./minutes-signatures-panel";
import type { MeetingDetailData } from "@/lib/dal";

interface MeetingDetailProps {
  meeting: MeetingDetailData;
}

const PILL_BASE =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-mono uppercase tracking-wider";

export function MeetingDetail({ meeting }: MeetingDetailProps) {
  const t = useTranslations("voting");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "minutes">("overview");
  const [editingAgenda, setEditingAgenda] = useState(false);
  const [agendaDraft, setAgendaDraft] = useState<AgendaItem[]>([]);
  const [agendaSaving, setAgendaSaving] = useState(false);
  const [showCreateVote, setShowCreateVote] = useState(false);

  const meetingDate = new Date(meeting.date);
  const day = meetingDate.getDate();
  const month = meetingDate.toLocaleDateString(undefined, { month: "short" });
  const fullDate = meetingDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const agendaItems = Array.isArray(meeting.agenda) ? meeting.agenda : [];

  const attendingCount = meeting.attendees.filter((a) => a.status === "ATTENDING").length;
  const notAttendingCount = meeting.attendees.filter((a) => a.status === "NOT_ATTENDING").length;
  const proxyCount = meeting.attendees.filter((a) => a.status === "PROXY").length;

  return (
    <div className="space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between no-print">
        <Link
          href="/voting"
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("backToMeetings")}
        </Link>
        <div className="flex items-center gap-2">
          <PdfDownloadButton
            kind="meeting-summary"
            refId={meeting.id}
            label={t("downloadMeetingPdf")}
            title={t("downloadMeetingPdfTitle")}
            className="inline-flex items-center gap-2 rounded-lg border border-ink/15 bg-card px-4 py-2 text-sm text-ink-soft hover:text-ink hover:border-ink/30 transition-colors disabled:opacity-60"
          />
          <PdfDownloadButton
            kind="minutes"
            refId={meeting.id}
            label={t("downloadMinutesPdf")}
            title={t("downloadMinutesPdfTitle")}
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 transition-opacity disabled:opacity-60"
          />
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-ink/15 bg-card px-4 py-2 text-sm text-ink-soft hover:text-ink hover:border-ink/30 transition-colors"
          >
            <Printer className="h-4 w-4" />
            {t("printMeeting")}
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start gap-5">
        <div
          className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-ink text-bg"
          style={{ borderRadius: "14px" }}
        >
          <span className="font-display text-3xl leading-none">{day}</span>
          <span className="mt-1 font-mono text-[10.5px] uppercase tracking-wider opacity-80">
            {month}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl text-ink leading-tight">
            {meeting.title}
          </h1>
          {/* Meeting type + quorum badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            {meeting.isRepeated && (
              <span
                className={PILL_BASE}
                style={{
                  background:
                    "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
                  color:
                    "color-mix(in srgb, var(--color-ochre) 75%, var(--color-ink))",
                }}
              >
                {t("isRepeated")}
              </span>
            )}
            <span
              className={PILL_BASE}
              style={
                meeting.quorum.isQuorate
                  ? {
                      background:
                        "color-mix(in srgb, var(--color-good) 18%, transparent)",
                      color: "var(--color-good)",
                    }
                  : {
                      background:
                        "color-mix(in srgb, var(--color-danger) 18%, transparent)",
                      color: "var(--color-danger)",
                    }
              }
            >
              {meeting.quorum.isQuorate ? t("quorate") : t("notQuorate")} ·{" "}
              {meeting.quorum.presentPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted" />
              {fullDate}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted" />
              {meeting.time}
            </span>
            {meeting.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted" />
                {meeting.location}
              </span>
            )}
            <span className="text-muted">
              {t("organizedBy", { name: meeting.createdBy.name })}
            </span>
          </div>

          {/* RSVP badges */}
          {(attendingCount > 0 || notAttendingCount > 0 || proxyCount > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {attendingCount > 0 && (
                <span
                  className={PILL_BASE}
                  style={{
                    background:
                      "color-mix(in srgb, var(--color-good) 18%, transparent)",
                    color: "var(--color-good)",
                  }}
                >
                  {attendingCount} {t("rsvpAttending").toLowerCase()}
                </span>
              )}
              {notAttendingCount > 0 && (
                <span
                  className={PILL_BASE}
                  style={{
                    background:
                      "color-mix(in srgb, var(--color-danger) 16%, transparent)",
                    color: "var(--color-danger)",
                  }}
                >
                  {notAttendingCount} {t("rsvpNotAttending").toLowerCase()}
                </span>
              )}
              {proxyCount > 0 && (
                <span
                  className={PILL_BASE}
                  style={{
                    background:
                      "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
                    color:
                      "color-mix(in srgb, var(--color-ochre) 75%, var(--color-ink))",
                  }}
                >
                  {proxyCount} {t("rsvpProxy").toLowerCase()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-ink/10 no-print">
        {(["overview", "minutes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 font-mono text-xs uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? "border-b-2 border-ink text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            {t(tab === "overview" ? "tabOverview" : "tabMinutes")}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Agenda + Votes */}
          <div className="lg:col-span-8 space-y-6">
            {/* Agenda */}
            <div className="rounded-xl border border-ink/8 bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted" />
                  <h3 className="font-mono text-xs uppercase tracking-wider text-ink">
                    {t("agendaTitle")}
                  </h3>
                </div>
                {meeting.canEditMinutes && !editingAgenda && (
                  <button
                    onClick={() => {
                      setAgendaDraft(
                        agendaItems.map((item: unknown) => ({
                          title:
                            typeof item === "string"
                              ? item
                              : String((item as Record<string, unknown>)?.title ?? ""),
                          description:
                            typeof item === "object" && item !== null
                              ? String((item as Record<string, unknown>)?.description ?? "")
                              : "",
                        }))
                      );
                      setEditingAgenda(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-muted hover:bg-bg-3 hover:text-ink transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    {t("editAgenda")}
                  </button>
                )}
              </div>

              {editingAgenda ? (
                <div className="space-y-4">
                  <AgendaEditor items={agendaDraft} onChange={setAgendaDraft} />
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-ink/10">
                    <button
                      onClick={() => setEditingAgenda(false)}
                      className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:bg-bg-3 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      {t("cancel")}
                    </button>
                    <button
                      onClick={async () => {
                        setAgendaSaving(true);
                        try {
                          const res = await fetch(`/api/voting/meetings/${meeting.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              agenda: agendaDraft.filter((a) => a.title.trim()),
                            }),
                          });
                          if (res.ok) {
                            setEditingAgenda(false);
                            toast.success(t("agendaSaved"));
                            router.refresh();
                          } else {
                            toast.error(t("agendaSaveFailed"));
                          }
                        } catch {
                          toast.error(t("agendaSaveFailed"));
                        } finally {
                          setAgendaSaving(false);
                        }
                      }}
                      disabled={agendaSaving}
                      className="inline-flex items-center gap-1 rounded-md bg-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {agendaSaving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      {t("saveAgenda")}
                    </button>
                  </div>
                </div>
              ) : agendaItems.length === 0 ? (
                <p className="text-sm text-muted">{t("noAgenda")}</p>
              ) : (
                <ol className="space-y-3">
                  {agendaItems.map((item: unknown, i: number) => {
                    const obj =
                      typeof item === "object" && item !== null
                        ? (item as Record<string, unknown>)
                        : null;
                    const title =
                      typeof item === "string"
                        ? item
                        : obj?.title ?? `Item ${i + 1}`;
                    const desc = obj?.description;
                    const isAwardVote = obj?.kind === "award_vote";

                    if (isAwardVote) {
                      return (
                        <li
                          key={i}
                          className="flex items-center gap-3 rounded-xl border border-ink/15 bg-bg-3 p-3"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[11px] text-bg">
                            {i + 1}
                          </span>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/10 text-ink">
                            <Vote className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink">{String(title)}</p>
                            {typeof desc === "string" && (
                              <p className="mt-0.5 text-xs text-muted">{desc}</p>
                            )}
                          </div>
                          <Link
                            href="/voting"
                            className="shrink-0 rounded-lg bg-ink px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90"
                          >
                            {t("awardVoteAgendaCta")}
                          </Link>
                        </li>
                      );
                    }

                    return (
                      <li key={i} className="flex gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-3 font-mono text-[11px] text-ink-soft">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm text-ink">{String(title)}</p>
                          {typeof desc === "string" && (
                            <p className="mt-0.5 text-xs text-muted">{desc}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* Votes */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Vote className="h-4 w-4 text-muted" />
                  <h3 className="font-mono text-xs uppercase tracking-wider text-ink">
                    {t("votesInMeeting")}
                  </h3>
                </div>
                {meeting.canEditMinutes && (
                  <button
                    onClick={() => setShowCreateVote(true)}
                    className="inline-flex items-center gap-1 rounded-md bg-ink px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-bg hover:opacity-90 transition-opacity"
                  >
                    <Plus className="h-3 w-3" />
                    {t("addVote")}
                  </button>
                )}
              </div>
              {meeting.votes.length === 0 ? (
                <p className="text-sm text-muted">{t("noVotesInMeeting")}</p>
              ) : (
                <div className="space-y-4">
                  {meeting.votes.map((vote) => (
                    <div key={vote.id} className="space-y-2">
                      <VoteResultCard
                        vote={vote}
                        canClose={meeting.canEditMinutes}
                        onClosed={() => router.refresh()}
                      />
                      {meeting.canEditMinutes && vote.status === "OPEN" && (
                        <QuickVotePanel
                          voteId={vote.id}
                          voteTitle={vote.title}
                          options={vote.options}
                          buildingId={meeting.buildingId}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Attendance + RSVP */}
          <div className="lg:col-span-4 space-y-4">
            <AttendancePanel
              meetingId={meeting.id}
              isBoardMember={meeting.canEditMinutes}
              isRepeated={meeting.isRepeated}
            />
            <AttendeesPanel attendees={meeting.attendees} />
          </div>
        </div>
      )}

      {/* Minutes Tab */}
      {activeTab === "minutes" && (
        <div className="space-y-6">
          {meeting.canEditMinutes ? (
            <MinutesEditor
              meetingId={meeting.id}
              initialMinutes={meeting.minutes}
              updatedAt={meeting.minutesUpdatedAt}
              updatedBy={meeting.minutesUpdatedBy}
              meetingTitle={meeting.title}
              meetingDate={fullDate}
              agenda={agendaItems}
            />
          ) : (
            <MinutesViewer
              minutes={meeting.minutes}
              updatedAt={meeting.minutesUpdatedAt}
              updatedBy={meeting.minutesUpdatedBy}
            />
          )}
          <MinutesSignaturesPanel
            meetingId={meeting.id}
            signatures={meeting.signatures}
            canSign={meeting.canSignMinutes}
            currentUserId={meeting.currentUserId}
          />
        </div>
      )}

      {showCreateVote && (
        <CreateVoteModal
          open
          meetingId={meeting.id}
          meetingTitle={meeting.title}
          onClose={() => setShowCreateVote(false)}
          onCreated={() => {
            setShowCreateVote(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

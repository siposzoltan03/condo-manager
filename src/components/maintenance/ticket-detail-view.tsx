"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { TicketDetailData } from "@/lib/maintenance-dal";
import { AssignContractorPanel } from "./assign-contractor-panel";
import { PublishWizard } from "@/components/marketplace/publish-wizard";
import { MarketplaceStatusStrip } from "@/components/marketplace/marketplace-status-strip";
import { MarketplaceRatingPrompt } from "@/components/marketplace/rating-prompt";
import {
  BoardProjectInvoice,
  type BoardInvoiceDTO,
} from "@/components/maintenance/board-project-invoice";

interface Props {
  ticket: TicketDetailData;
  locale: string;
  invoice?: BoardInvoiceDTO | null;
}

const STATUS_ORDER: TicketDetailData["status"][] = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "VERIFIED",
];

function nextStatus(current: TicketDetailData["status"]): TicketDetailData["status"] | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx < 0 || idx === STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

export function TicketDetailView({ ticket, locale, invoice }: Props) {
  const t = useTranslations("maintenance");
  const tMarket = useTranslations("marketplace");
  const router = useRouter();
  const [advancing, setAdvancing] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentInternal, setCommentInternal] = useState(false);
  const [posting, setPosting] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const next = nextStatus(ticket.status);
  const canPublish =
    ticket.isBoardPlus &&
    !ticket.publication &&
    ticket.status !== "SUBMITTED" &&
    ticket.status !== "COMPLETED" &&
    ticket.status !== "VERIFIED";

  async function advanceStatus() {
    if (!next) return;
    setAdvancing(true);
    try {
      const res = await fetch(`/api/maintenance/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "advance failed");
      }
      toast.success(t("detail.movedToast", { status: t(`status.${next}`) }));
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("detail.advanceError"),
      );
    } finally {
      setAdvancing(false);
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/maintenance/tickets/${ticket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: commentBody.trim(),
          isInternal: commentInternal,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "post failed");
      }
      setCommentBody("");
      setCommentInternal(false);
      toast.success(t("detail.commentPosted"));
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("detail.commentError"),
      );
    } finally {
      setPosting(false);
    }
  }

  const urgencyTone = {
    CRITICAL: { bg: "var(--color-danger-soft)", color: "var(--color-danger)" },
    HIGH: {
      bg: "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
      color: "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
    },
    MEDIUM: {
      bg: "color-mix(in srgb, var(--color-moss-2) 18%, transparent)",
      color: "var(--color-moss-2)",
    },
    LOW: {
      bg: "color-mix(in srgb, var(--color-ink) 8%, transparent)",
      color: "var(--color-muted)",
    },
  }[ticket.urgency];

  return (
    <div style={{ padding: "32px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <Link
          href={`/${locale}/maintenance`}
          className="font-mono inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            letterSpacing: "0.05em",
            textDecoration: "none",
            marginBottom: "16px",
          }}
        >
          ← {t("detail.backToBoard")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-mono"
                style={{
                  fontSize: "11px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {ticket.trackingNumber}
              </span>
              <span
                className="font-mono inline-block"
                style={{
                  fontSize: "10px",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  background: urgencyTone.bg,
                  color: urgencyTone.color,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {t(`urgency.${ticket.urgency}`)}
              </span>
              {ticket.slaAtRisk && ticket.slaHours != null && (
                <span
                  className="font-mono inline-block"
                  style={{
                    fontSize: "10px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background:
                      "color-mix(in srgb, var(--color-danger) 15%, transparent)",
                    color: "var(--color-danger)",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {t("kanban.slaTag", { hours: ticket.slaHours.toString() })}
                </span>
              )}
            </div>
            <h1
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: "32px",
                fontWeight: 500,
                letterSpacing: "-0.025em",
                lineHeight: 1.15,
                marginTop: "8px",
              }}
            >
              {ticket.title}
            </h1>
            <p
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                letterSpacing: "0.04em",
                marginTop: "8px",
              }}
            >
              {t(`category.${ticket.category}`)} ·{" "}
              {t("detail.reportedBy", { name: ticket.reporter.name })} ·{" "}
              {new Date(ticket.createdAt).toLocaleDateString("hu-HU", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canPublish && (
              <button
                type="button"
                onClick={() => setPublishOpen(true)}
                className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "var(--color-bg)",
                  color: "var(--color-ink)",
                  border: "1px solid var(--color-ink)",
                  cursor: "pointer",
                }}
              >
                {tMarket("publishCta")}
              </button>
            )}
            {ticket.isBoardPlus && next && (
              <button
                type="button"
                onClick={advanceStatus}
                disabled={advancing}
                className="inline-flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "var(--color-ink)",
                  color: "var(--color-bg)",
                  border: "1px solid var(--color-ink)",
                  cursor: advancing ? "not-allowed" : "pointer",
                }}
              >
                {advancing
                  ? t("detail.advancing")
                  : t("detail.advanceTo", { status: t(`status.${next}`) })}
              </button>
            )}
          </div>
        </div>
        {ticket.publication && (
          <MarketplaceStatusStrip
            publication={ticket.publication}
            ticketId={ticket.id}
            isBoardPlus={ticket.isBoardPlus}
            locale={locale}
            onChanged={() => router.refresh()}
          />
        )}
        {invoice && (
          <BoardProjectInvoice
            ticketId={ticket.id}
            invoice={invoice}
            isBoardPlus={ticket.isBoardPlus}
          />
        )}
        {ticket.isBoardPlus &&
          ticket.awardedContractorOrgId &&
          (ticket.status === "COMPLETED" || ticket.status === "VERIFIED") && (
            <MarketplaceRatingPrompt
              ticketId={ticket.id}
              initialRating={ticket.viewerRating?.rating ?? null}
              initialNotes={ticket.viewerRating?.notes ?? null}
              onSaved={() => router.refresh()}
            />
          )}
        {ticket.scheduledSource && (
          <Link
            href={`/${locale}/maintenance/scheduled`}
            className="inline-flex items-center gap-2 transition-opacity hover:opacity-80"
            style={{
              marginTop: "14px",
              padding: "8px 12px",
              borderRadius: "8px",
              background:
                "color-mix(in srgb, var(--color-moss-2) 12%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--color-moss-2) 30%, transparent)",
              color: "var(--color-ink)",
              fontSize: "12px",
              textDecoration: "none",
              maxWidth: "fit-content",
            }}
          >
            <ScheduleIcon />
            <span>
              <span
                className="font-mono"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--color-muted)",
                  marginRight: "6px",
                }}
              >
                {t("detail.fromSchedule")}
              </span>
              <b style={{ fontWeight: 600 }}>{ticket.scheduledSource.title}</b>
              {ticket.scheduledSource.isRecurring && (
                <span
                  className="font-mono"
                  style={{
                    fontSize: "9px",
                    marginLeft: "6px",
                    padding: "1px 5px",
                    borderRadius: "3px",
                    background:
                      "color-mix(in srgb, var(--color-moss-2) 22%, transparent)",
                    color: "var(--color-moss-2)",
                    letterSpacing: "0.06em",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {t("detail.recurring")}
                </span>
              )}
            </span>
          </Link>
        )}
      </div>

      {/* Status timeline */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5"
        style={{ marginBottom: "28px" }}
      >
        {STATUS_ORDER.map((s) => {
          const item = ticket.timeline.find((it) => it.key === s);
          const isCurrent = ticket.status === s;
          const isPast =
            STATUS_ORDER.indexOf(s) < STATUS_ORDER.indexOf(ticket.status);
          const dot =
            isCurrent
              ? "var(--color-moss-2)"
              : isPast
                ? "var(--color-good)"
                : "color-mix(in srgb, var(--color-ink) 12%, transparent)";
          return (
            <div
              key={s}
              style={{
                background: "var(--color-card)",
                border: isCurrent
                  ? "1px solid var(--color-moss-2)"
                  : "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
                borderRadius: "10px",
                padding: "12px",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: dot,
                  }}
                />
                <span
                  className="font-mono"
                  style={{
                    fontSize: "10px",
                    color: isCurrent ? "var(--color-ink)" : "var(--color-muted)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight: isCurrent ? 700 : 500,
                  }}
                >
                  {t(`status.${s}`)}
                </span>
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-muted)",
                  marginTop: "4px",
                  letterSpacing: "0.04em",
                }}
              >
                {item?.reachedAt
                  ? new Date(item.reachedAt).toLocaleDateString("hu-HU", {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Body grid — stacks on phone, main + sidebar on lg:+. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* Main column */}
        <div>
          <Section title={t("detail.descriptionTitle")}>
            <div
              style={{
                fontSize: "14px",
                color: "var(--color-ink)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {ticket.description}
            </div>
            {ticket.location && (
              <div
                className="font-mono"
                style={{
                  marginTop: "12px",
                  paddingTop: "12px",
                  borderTop:
                    "1px dashed color-mix(in srgb, var(--color-ink) 6%, transparent)",
                  fontSize: "11px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.04em",
                }}
              >
                <span style={{ textTransform: "uppercase" }}>
                  {t("detail.locationLabel")}:
                </span>{" "}
                <b style={{ color: "var(--color-ink)", fontWeight: 600 }}>
                  {ticket.location}
                </b>
              </div>
            )}
          </Section>

          {ticket.attachments.length > 0 && (
            <Section title={t("detail.attachmentsTitle")} marginTop="20px">
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: "8px",
                }}
              >
                {ticket.attachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={a.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 transition-colors hover:bg-[var(--color-bg-3)]"
                      style={{
                        padding: "10px 12px",
                        background: "var(--color-bg-3)",
                        borderRadius: "8px",
                        textDecoration: "none",
                        color: "var(--color-ink)",
                        fontSize: "13px",
                      }}
                    >
                      <PaperclipIcon />
                      {a.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section
            title={t("detail.commentsTitle", {
              n: ticket.comments.length.toString(),
            })}
            marginTop="20px"
          >
            {ticket.comments.length === 0 ? (
              <div
                className="font-mono"
                style={{
                  fontSize: "11px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.04em",
                  padding: "16px 0",
                  textAlign: "center",
                }}
              >
                {t("detail.commentsEmpty")}
              </div>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: "12px",
                }}
              >
                {ticket.comments.map((c) => (
                  <li
                    key={c.id}
                    style={{
                      padding: "12px",
                      background: c.isInternal
                        ? "color-mix(in srgb, var(--color-ochre) 10%, transparent)"
                        : "var(--color-bg-3)",
                      border: c.isInternal
                        ? "1px solid color-mix(in srgb, var(--color-ochre) 35%, transparent)"
                        : "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
                      borderRadius: "10px",
                    }}
                  >
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
                          fontSize: "10px",
                          fontWeight: 600,
                        }}
                      >
                        {c.authorInitials}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>
                        {c.authorName}
                      </span>
                      {c.isInternal && (
                        <span
                          className="font-mono"
                          style={{
                            fontSize: "9px",
                            padding: "2px 6px",
                            borderRadius: "3px",
                            background:
                              "color-mix(in srgb, var(--color-ochre) 25%, transparent)",
                            color:
                              "color-mix(in srgb, var(--color-ochre) 80%, var(--color-ink))",
                            letterSpacing: "0.06em",
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          {t("detail.internal")}
                        </span>
                      )}
                      <span
                        className="font-mono"
                        style={{
                          marginLeft: "auto",
                          fontSize: "10px",
                          color: "var(--color-muted)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {new Date(c.createdAt).toLocaleDateString("hu-HU", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        marginTop: "6px",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.5,
                      }}
                    >
                      {c.body}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Composer */}
            <form onSubmit={postComment} style={{ marginTop: "12px" }}>
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder={t("detail.commentPlaceholder")}
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  color: "var(--color-ink)",
                  background: "var(--color-bg-3)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                  borderRadius: "8px",
                  outline: "none",
                  resize: "vertical",
                  minHeight: "70px",
                }}
              />
              <div
                className="flex items-center justify-between"
                style={{ marginTop: "8px", flexWrap: "wrap", gap: "8px" }}
              >
                {ticket.isBoardPlus ? (
                  <label
                    className="flex items-center gap-2"
                    style={{ fontSize: "12px", cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={commentInternal}
                      onChange={(e) => setCommentInternal(e.target.checked)}
                      style={{
                        accentColor: "var(--color-ochre)",
                        width: "14px",
                        height: "14px",
                      }}
                    />
                    {t("detail.markInternal")}
                  </label>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  disabled={posting || !commentBody.trim()}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: "var(--color-ink)",
                    color: "var(--color-bg)",
                    border: "1px solid var(--color-ink)",
                    cursor:
                      posting || !commentBody.trim()
                        ? "not-allowed"
                        : "pointer",
                    opacity: posting || !commentBody.trim() ? 0.6 : 1,
                  }}
                >
                  {posting ? t("detail.posting") : t("detail.postComment")}
                </button>
              </div>
            </form>
          </Section>
        </div>

        {/* Sidebar */}
        <aside>
          <SidebarPanel title={t("detail.assigneeTitle")}>
            <AssignContractorPanel
              ticketId={ticket.id}
              status={ticket.status}
              contractor={ticket.contractor}
              options={ticket.contractorOptions}
              isBoardPlus={ticket.isBoardPlus}
            />
          </SidebarPanel>

          <SidebarPanel title={t("detail.metaTitle")} marginTop="14px">
            <DefRow label={t("detail.statusLabel")}>
              {t(`status.${ticket.status}`)}
            </DefRow>
            <DefRow label={t("detail.urgencyLabel")}>
              {t(`urgency.${ticket.urgency}`)}
            </DefRow>
            <DefRow label={t("detail.categoryLabel")}>
              {t(`category.${ticket.category}`)}
            </DefRow>
            <DefRow label={t("detail.slaLabel")}>
              {ticket.slaHours != null
                ? `${ticket.slaHours} ó`
                : t("detail.noSla")}
            </DefRow>
            <DefRow label={t("detail.ageLabel")}>
              {ticket.ageHours < 24
                ? `${ticket.ageHours} ó`
                : `${Math.floor(ticket.ageHours / 24)} nap`}
            </DefRow>
            <DefRow label={t("detail.reporterLabel")}>
              {ticket.reporter.name}
            </DefRow>
          </SidebarPanel>

          {ticket.ratings.length > 0 && (
            <SidebarPanel title={t("detail.ratingsTitle")} marginTop="14px">
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: "10px",
                }}
              >
                {ticket.ratings.map((r) => (
                  <li key={r.id}>
                    <div
                      className="flex items-center justify-between"
                      style={{ marginBottom: "4px" }}
                    >
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>
                        {r.raterName}
                      </span>
                      <span
                        style={{
                          color: "var(--color-ochre)",
                          fontSize: "12px",
                        }}
                      >
                        {"★".repeat(r.rating)}
                        <span
                          style={{
                            color:
                              "color-mix(in srgb, var(--color-ink) 15%, transparent)",
                          }}
                        >
                          {"★".repeat(5 - r.rating)}
                        </span>
                      </span>
                    </div>
                    {r.notes && (
                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--color-ink-soft)",
                          margin: 0,
                          fontStyle: "italic",
                        }}
                      >
                        “{r.notes}”
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </SidebarPanel>
          )}
        </aside>
      </div>
      {canPublish && (
        <PublishWizard
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          ticket={{
            id: ticket.id,
            title: ticket.title,
            description: ticket.description,
            category: ticket.category,
            urgency: ticket.urgency,
            city: ticket.buildingCity,
            zip: ticket.buildingZip,
            publisherDisplayName: ticket.viewer.name,
            defaultContactEmail: ticket.viewer.email,
          }}
          onPublished={() => {
            setPublishOpen(false);
            toast.success(tMarket("publishedBadge"));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Section({
  title,
  marginTop,
  children,
}: {
  title: string;
  marginTop?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: "20px",
        marginTop: marginTop,
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "14px",
          fontWeight: 600,
          letterSpacing: "-0.015em",
          marginBottom: "14px",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function SidebarPanel({
  title,
  marginTop,
  children,
}: {
  title: string;
  marginTop?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: "18px",
        marginTop: marginTop,
      }}
    >
      <h4
        className="font-mono"
        style={{
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-muted)",
          marginBottom: "12px",
        }}
      >
        {title}
      </h4>
      {children}
    </div>
  );
}

function DefRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex justify-between gap-3"
      style={{
        padding: "7px 0",
        borderBottom: "1px dashed color-mix(in srgb, var(--color-ink) 6%, transparent)",
        fontSize: "12.5px",
      }}
    >
      <span
        className="font-mono"
        style={{
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          fontSize: "10px",
        }}
      >
        {label}
      </span>
      <span style={{ fontWeight: 500, textAlign: "right" }}>{children}</span>
    </div>
  );
}

function PaperclipIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
    </svg>
  );
}

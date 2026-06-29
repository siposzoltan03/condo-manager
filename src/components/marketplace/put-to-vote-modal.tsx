"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface BidPreview {
  id: string;
  bidderName: string;
  amount: number;
  etaDays: number;
}

interface MeetingOption {
  id: string;
  title: string;
  date: string;
}

const fmtFt = (n: number) => new Intl.NumberFormat("hu-HU").format(n);

/**
 * "Közgyűlés elé visz" — board action that puts a publication's open bids to
 * an owners' vote at an upcoming meeting. Mirrors the design's modal: meeting
 * picker + a preview of the bid-options (plus the auto-added "Egyik sem") +
 * the auto-award note. On submit it POSTs put-to-vote and refreshes.
 */
export function PutToVoteModal({
  open,
  onClose,
  ticketId,
  bids,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  ticketId: string;
  bids: BidPreview[];
  locale: "hu" | "en";
}) {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const [meetings, setMeetings] = useState<MeetingOption[] | null>(null);
  const [meetingId, setMeetingId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/voting/meetings?upcoming=true", {
          cache: "no-store",
        });
        const data = res.ok ? await res.json() : { meetings: [] };
        if (!alive) return;
        const list: MeetingOption[] = (data.meetings ?? []).map(
          (m: { id: string; title: string; date: string }) => ({
            id: m.id,
            title: m.title,
            date: m.date,
          }),
        );
        setMeetings(list);
        if (list[0]) setMeetingId(list[0].id);
      } catch {
        if (alive) setMeetings([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  if (!open) return null;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "hu" ? "hu-HU" : "en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  async function submit() {
    if (!meetingId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/maintenance/tickets/${ticketId}/bids/put-to-vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingId }),
        },
      );
      if (!res.ok) {
        toast.error(t("putToVoteFailed"));
        return;
      }
      toast.success(t("putToVoteSuccess"));
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "color-mix(in srgb, var(--color-ink) 45%, transparent)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl"
        style={{ background: "var(--color-card)", boxShadow: "var(--shadow-lg, 0 20px 40px -12px rgba(0,0,0,.25))" }}
      >
        <div className="px-6 pt-5">
          <h3
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "19px",
              fontWeight: 600,
              letterSpacing: "-0.025em",
            }}
          >
            {t("putToVoteTitle")}
          </h3>
          <p style={{ fontSize: "13.5px", color: "var(--color-muted)", marginTop: "6px" }}>
            {t("putToVoteSubtitle")}
          </p>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span
              className="font-mono"
              style={{ fontSize: "10.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted)" }}
            >
              {t("putToVoteMeeting")}
            </span>
            {meetings === null ? (
              <span style={{ fontSize: "13px", color: "var(--color-muted)" }}>…</span>
            ) : meetings.length === 0 ? (
              <span style={{ fontSize: "13px", color: "var(--color-danger)" }}>
                {t("putToVoteNoMeetings")}
              </span>
            ) : (
              <select
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                className="rounded-lg"
                style={{
                  padding: "11px 13px",
                  fontSize: "14px",
                  fontWeight: 600,
                  border: "1px solid color-mix(in srgb, var(--color-ink) 15%, transparent)",
                  background: "var(--color-card)",
                  color: "var(--color-ink)",
                }}
              >
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} — {fmtDate(m.date)}
                  </option>
                ))}
              </select>
            )}
          </label>

          <div className="flex flex-col gap-2">
            <span
              className="font-mono"
              style={{ fontSize: "10.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-muted)" }}
            >
              {t("putToVoteOptionsPreview")}
            </span>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)" }}
            >
              {bids.map((b, i) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{ borderBottom: "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)" }}
                >
                  <span
                    className="grid place-items-center rounded-md font-mono"
                    style={{ width: 22, height: 22, fontSize: 11, fontWeight: 800, background: "var(--color-bg-2)", color: "var(--color-ink-soft)" }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{b.bidderName}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 800 }}>{fmtFt(b.amount)} Ft</span>
                </div>
              ))}
              <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: "var(--color-bg-2)" }}>
                <span
                  className="grid place-items-center rounded-md font-mono"
                  style={{ width: 22, height: 22, fontSize: 11, fontWeight: 800, background: "color-mix(in srgb, var(--color-ink) 12%, transparent)", color: "var(--color-ink-soft)" }}
                >
                  —
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "var(--color-ink-soft)" }}>
                  {t("putToVoteNoneOption")}
                </span>
              </div>
            </div>
          </div>

          <p
            className="rounded-lg"
            style={{
              fontSize: 12.5,
              lineHeight: 1.45,
              padding: "11px 13px",
              background: "color-mix(in srgb, var(--color-blue, #3a5a78) 12%, transparent)",
              color: "var(--color-ink-soft)",
            }}
          >
            {t("putToVoteInfo")}
          </p>
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg"
            style={{
              padding: "11px",
              fontSize: 14,
              fontWeight: 700,
              border: "1px solid color-mix(in srgb, var(--color-ink) 15%, transparent)",
              background: "var(--color-card)",
              color: "var(--color-ink-soft)",
            }}
          >
            {t("putToVoteCancel")}
          </button>
          <button
            onClick={submit}
            disabled={busy || !meetingId}
            className="flex-1 rounded-lg"
            style={{
              padding: "11px",
              fontSize: 14,
              fontWeight: 700,
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              opacity: busy || !meetingId ? 0.5 : 1,
            }}
          >
            {t("putToVoteConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

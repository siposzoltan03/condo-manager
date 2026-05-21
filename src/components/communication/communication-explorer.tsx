"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type {
  ChannelListItem,
  ChannelDetailData,
  CommunicationOverviewData,
} from "@/lib/communication-dal";
import {
  useCommunicationStream,
  type CommStreamEvent,
} from "@/hooks/use-communication-stream";
import { uploadFile } from "@/lib/upload";

interface Props {
  locale: string;
  isBoardPlus: boolean;
  currentUserId: string;
  overview: CommunicationOverviewData;
  detail: ChannelDetailData | null;
}

interface TypingUser {
  userId: string;
  firstName: string;
  at: number;
}

export function CommunicationExplorer({
  locale,
  isBoardPlus,
  currentUserId,
  overview,
  detail,
}: Props) {
  const t = useTranslations("communication");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typingByChannel, setTypingByChannel] = useState<
    Record<string, TypingUser[]>
  >({});

  // ── Real-time stream ────────────────────────────────────────────────
  // Debounce router.refresh() to avoid storms when many events land at once.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      router.refresh();
    }, 250);
  }, [router]);

  const handleStreamEvent = useCallback(
    (event: CommStreamEvent) => {
      if (event.type === "message:new" || event.type === "message:update") {
        // Don't refresh from your own actions — local mutators already
        // called router.refresh().
        if (
          event.type === "message:new" &&
          event.authorId === currentUserId
        ) {
          return;
        }
        scheduleRefresh();
        return;
      }
      if (event.type === "typing") {
        if (event.userId === currentUserId) return;
        setTypingByChannel((prev) => {
          const list = (prev[event.channelId] ?? []).filter(
            (u) => u.userId !== event.userId,
          );
          list.push({
            userId: event.userId,
            firstName: event.userFirstName,
            at: event.at,
          });
          return { ...prev, [event.channelId]: list };
        });
        return;
      }
      if (event.type === "presence") {
        if (event.userId === currentUserId) return;
        // Presence affects sidebar dots; cheap to refresh.
        scheduleRefresh();
        return;
      }
    },
    [currentUserId, scheduleRefresh],
  );

  useCommunicationStream({ onEvent: handleStreamEvent });

  // Drop stale typing entries (older than 4s).
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingByChannel((prev) => {
        const cutoff = Date.now() - 4_000;
        let changed = false;
        const next: Record<string, TypingUser[]> = {};
        for (const [chId, users] of Object.entries(prev)) {
          const fresh = users.filter((u) => u.at >= cutoff);
          if (fresh.length !== users.length) changed = true;
          if (fresh.length > 0) next[chId] = fresh;
        }
        return changed ? next : prev;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Heartbeat: presence ping every 30s while page is visible.
  useEffect(() => {
    function ping() {
      if (document.visibilityState !== "visible") return;
      fetch("/api/communication/presence", { method: "POST" }).catch(() => {});
    }
    ping();
    const id = setInterval(ping, 30_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  // Mark channel as read on mount / channel switch.
  const markedReadRef = useRef<string | null>(null);
  useEffect(() => {
    if (!detail) return;
    if (markedReadRef.current === detail.channel.id) return;
    markedReadRef.current = detail.channel.id;
    fetch(`/api/channels/${detail.channel.id}/read`, { method: "POST" })
      .then(() => router.refresh())
      .catch(() => {});
  }, [detail, router]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return overview.channelGroups;
    const q = search.toLowerCase();
    return overview.channelGroups.map((g) => ({
      ...g,
      items: g.items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.preview ?? "").toLowerCase().includes(q) ||
          (c.meta ?? "").toLowerCase().includes(q),
      ),
    }));
  }, [overview.channelGroups, search]);

  // Mobile messenger pattern: only one pane visible at a time.
  // Drive visibility from the URL `?channel=` param, NOT from `detail` —
  // the server-side DAL always returns a `detail` (defaults to the first
  // announcement channel), but on phone we want "no channel selected"
  // to mean "show channel list" even if the server fell back.
  // Desktop (lg:+): all three panes visible side-by-side (original layout).
  const searchParams = useSearchParams();
  const hasSelectedChannel = !!searchParams?.get("channel");
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:items-start">
      {/* ── Column 1: Channels list ──────────────────────────────────── */}
      <div className={hasSelectedChannel ? "hidden lg:contents" : "contents"}>
        <ChannelsList
          locale={locale}
          groups={filteredGroups}
          selectedId={overview.selectedChannelId}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("search")}
          groupLabels={{
            channels: t("groups.channels"),
            dms: t("groups.dms"),
          }}
          emptyText={t("noChannels")}
        />
      </div>

      {/* ── Column 2: Feed / Thread ─────────────────────────────────── */}
      <div className={!hasSelectedChannel ? "hidden lg:contents" : "contents"}>
        <ChannelView
          detail={detail}
          isBoardPlus={isBoardPlus}
          placeholder={t("selectChannel")}
          typingUsers={
            detail ? (typingByChannel[detail.channel.id] ?? []) : []
          }
          locale={locale}
        />
      </div>

      {/* ── Column 3: Channel info — desktop-only on this surface. ──── */}
      <div className="hidden lg:contents">
        <ChannelSidebar detail={detail} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Column 1: channels list
// ─────────────────────────────────────────────────────────────────────────

function ChannelsList({
  locale,
  groups,
  selectedId,
  search,
  onSearchChange,
  searchPlaceholder,
  groupLabels,
  emptyText,
}: {
  locale: string;
  groups: CommunicationOverviewData["channelGroups"];
  selectedId: string | null;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  groupLabels: { channels: string; dms: string };
  emptyText: string;
}) {
  const totalItems = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <div
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: "14px 12px",
        position: "sticky",
        top: "20px",
        maxHeight: "calc(100vh - 40px)",
        overflowY: "auto",
      }}
    >
      <div style={{ padding: "0 4px 10px" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            width: "100%",
            padding: "8px 12px",
            fontSize: "13px",
            color: "var(--color-ink)",
            background: "var(--color-bg-3)",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
            borderRadius: "8px",
            outline: "none",
          }}
        />
      </div>

      {totalItems === 0 ? (
        <div
          style={{
            padding: "24px 12px",
            textAlign: "center",
            color: "var(--color-muted)",
            fontSize: "12.5px",
          }}
        >
          {emptyText}
        </div>
      ) : (
        groups.map((g) => {
          if (g.items.length === 0) return null;
          return (
            <div key={g.key} style={{ marginBottom: "10px" }}>
              <div
                className="font-mono"
                style={{
                  fontSize: "10px",
                  color: "var(--color-muted)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "10px 6px 4px",
                }}
              >
                {groupLabels[g.key]}
              </div>
              {g.items.map((c) => (
                <ChannelRow
                  key={c.id}
                  locale={locale}
                  channel={c}
                  active={selectedId === c.id}
                />
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}

function ChannelRow({
  locale,
  channel,
  active,
}: {
  locale: string;
  channel: ChannelListItem;
  active: boolean;
}) {
  const tile =
    channel.kind === "ANNOUNCEMENT"
      ? { bg: "var(--color-moss)", color: "var(--color-bg)" }
      : channel.kind === "BOARD"
        ? { bg: "var(--color-ink)", color: "var(--color-bg)" }
        : channel.kind === "DM"
          ? { bg: "var(--color-ochre)", color: "var(--color-ink)" }
          : channel.kind === "GROUP_DM"
            ? {
                bg: "color-mix(in srgb, var(--color-ochre) 60%, var(--color-bg))",
                color: "var(--color-ink)",
              }
            : { bg: "var(--color-bg-3)", color: "var(--color-ink)" };

  return (
    <Link
      href={`/${locale}/communication?channel=${channel.id}`}
      className="flex items-start gap-2.5 transition-colors"
      style={{
        padding: "9px 8px",
        borderRadius: "8px",
        background: active ? "var(--color-ink)" : "transparent",
        color: active ? "var(--color-bg)" : "var(--color-ink)",
        textDecoration: "none",
        marginBottom: "1px",
      }}
    >
      <span
        className="relative grid place-items-center flex-shrink-0"
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          background: active
            ? "color-mix(in srgb, var(--color-bg) 18%, transparent)"
            : tile.bg,
          color: active ? "var(--color-bg)" : tile.color,
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontWeight: 600,
          fontSize: "12px",
        }}
      >
        {channel.initials ?? channel.name.slice(0, 2).toUpperCase()}
        {channel.isOnline && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: "-2px",
              bottom: "-2px",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#3aa66d",
              border: `2px solid ${active ? "var(--color-ink)" : "var(--color-card)"}`,
            }}
          />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className="truncate"
            style={{
              fontSize: "13px",
              fontWeight: channel.unreadCount > 0 ? 600 : 500,
              letterSpacing: "-0.005em",
            }}
          >
            {channel.name}
          </span>
          {channel.isOfficial && (
            <span
              style={{
                fontSize: "9px",
                color: active
                  ? "var(--color-bg)"
                  : "color-mix(in srgb, var(--color-moss) 80%, var(--color-ink))",
                opacity: 0.85,
              }}
              aria-hidden
            >
              ✓
            </span>
          )}
          {channel.previewAt && (
            <span
              className="font-mono ml-auto"
              style={{
                fontSize: "10px",
                color: active ? "var(--color-bg)" : "var(--color-muted)",
                opacity: 0.85,
                whiteSpace: "nowrap",
              }}
            >
              {channel.previewAt}
            </span>
          )}
        </div>
        {channel.preview && (
          <div
            className="truncate"
            style={{
              fontSize: "11.5px",
              color: active
                ? "color-mix(in srgb, var(--color-bg) 75%, var(--color-ink))"
                : "var(--color-ink-soft)",
              marginTop: "1px",
            }}
          >
            {channel.preview}
          </div>
        )}
        {!channel.preview && channel.meta && (
          <div
            className="truncate"
            style={{
              fontSize: "11.5px",
              color: active ? "var(--color-bg)" : "var(--color-muted)",
              marginTop: "1px",
              opacity: 0.85,
            }}
          >
            {channel.meta}
          </div>
        )}
      </div>
      {channel.unreadCount > 0 && (
        <span
          className="font-mono flex-shrink-0"
          style={{
            fontSize: "10px",
            padding: "1px 6px",
            borderRadius: "999px",
            background: active ? "var(--color-ochre)" : "var(--color-ink)",
            color: active ? "var(--color-ink)" : "var(--color-bg)",
            letterSpacing: "0.04em",
            fontWeight: 600,
            alignSelf: "center",
          }}
        >
          {channel.unreadCount}
        </span>
      )}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Column 2: feed / thread
// ─────────────────────────────────────────────────────────────────────────

function ChannelView({
  detail,
  isBoardPlus,
  placeholder,
  typingUsers,
  locale,
}: {
  detail: ChannelDetailData | null;
  isBoardPlus: boolean;
  placeholder: string;
  typingUsers: TypingUser[];
  locale: string;
}) {
  const t = useTranslations("communication");

  if (!detail) {
    return (
      <div
        style={{
          background: "var(--color-card)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "14px",
          minHeight: "560px",
          display: "grid",
          placeItems: "center",
          color: "var(--color-muted)",
          fontSize: "13.5px",
        }}
      >
        {placeholder}
      </div>
    );
  }

  const isFeed =
    detail.channel.kind === "ANNOUNCEMENT" ||
    detail.channel.kind === "TOPIC" ||
    detail.channel.kind === "BOARD";
  // For feed: top-level posts newest-first; replies grouped by parentId.
  const repliesByParent = new Map<
    string,
    ChannelDetailData["messages"]
  >();
  for (const m of detail.messages) {
    if (m.parentId) {
      const arr = repliesByParent.get(m.parentId) ?? [];
      arr.push(m);
      repliesByParent.set(m.parentId, arr);
    }
  }
  const topLevel = detail.messages.filter((m) => !m.parentId);
  const messages = isFeed
    ? [...topLevel].sort((a, b) => {
        // Pinned first, then newest first.
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
      })
    : detail.messages;

  return (
    <div
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 60px)",
        minHeight: "560px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 18px",
          borderBottom:
            "1px solid color-mix(in srgb, var(--color-ink) 7%, transparent)",
        }}
      >
        {/* Phone-only back link returning to the channel list. */}
        <Link
          href={`/${locale}/communication`}
          className="lg:hidden inline-flex min-h-11 items-center gap-1 -ml-2 mb-2 px-2 font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:text-ink transition-colors"
        >
          ← {t("backToChannels")}
        </Link>
        <div className="flex items-center gap-2">
          <h2
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "17px",
              fontWeight: 600,
              letterSpacing: "-0.018em",
            }}
          >
            {detail.channel.name}
          </h2>
          {detail.channel.isOfficial && (
            <span
              className="font-mono"
              style={{
                fontSize: "9px",
                padding: "2px 6px",
                borderRadius: "4px",
                background:
                  "color-mix(in srgb, var(--color-moss) 18%, transparent)",
                color: "var(--color-moss)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {t("official")}
            </span>
          )}
          {detail.channel.isPrivate && (
            <span
              className="font-mono"
              style={{
                fontSize: "9px",
                padding: "2px 6px",
                borderRadius: "4px",
                background:
                  "color-mix(in srgb, var(--color-ink) 8%, transparent)",
                color: "var(--color-ink-soft)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {t("private")}
            </span>
          )}
          <span
            className="font-mono ml-auto"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {t(`kind.${detail.channel.kind}` as const)}
          </span>
        </div>
        {detail.channel.description && (
          <p
            style={{
              fontSize: "12px",
              color: "var(--color-ink-soft)",
              marginTop: "4px",
            }}
          >
            {detail.channel.description}
          </p>
        )}
      </div>

      {/* Body: feed (cards) or thread (chat bubbles) */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: isFeed ? "20px 24px" : "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: isFeed ? "18px" : "10px",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              margin: "auto",
              color: "var(--color-muted)",
              fontSize: "13px",
            }}
          >
            {t("feed.empty")}
          </div>
        ) : isFeed ? (
          messages.map((m) => (
            <FeedCard
              key={m.id}
              m={m}
              channelId={detail.channel.id}
              isBoardPlus={isBoardPlus}
              repliesByParent={repliesByParent}
            />
          ))
        ) : (
          messages.map((m, i) => (
            <ChatBubble
              key={m.id}
              m={m}
              prevAuthorId={i > 0 ? messages[i - 1].authorId : null}
            />
          ))
        )}
      </div>

      {/* Typing indicator + composer */}
      {typingUsers.length > 0 && (
        <div
          style={{
            padding: "4px 18px 0",
            fontSize: "11.5px",
            color: "var(--color-muted)",
            fontStyle: "italic",
          }}
        >
          <TypingDots names={typingUsers.map((u) => u.firstName)} />
        </div>
      )}
      <Composer channelId={detail.channel.id} isFeed={isFeed} />
    </div>
  );
}

function TypingDots({ names }: { names: string[] }) {
  const text =
    names.length === 1
      ? `${names[0]} ír…`
      : names.length === 2
        ? `${names[0]} és ${names[1]} írnak…`
        : `${names[0]} és még ${names.length - 1} ír…`;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          gap: "2px",
        }}
      >
        <Dot />
        <Dot delay="0.15s" />
        <Dot delay="0.3s" />
      </span>
      {text}
    </span>
  );
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      style={{
        width: "4px",
        height: "4px",
        borderRadius: "50%",
        background: "var(--color-ink-soft)",
        opacity: 0.5,
        animation: `comm-typing 1s ${delay} infinite ease-in-out`,
      }}
    />
  );
}

// ─── Composer ────────────────────────────────────────────────────────────

interface PendingAttachment {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

function Composer({
  channelId,
  isFeed,
  parentId,
  onDone,
  compact = false,
}: {
  channelId: string;
  isFeed: boolean;
  parentId?: string;
  onDone?: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("communication");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Poll mode (only available on top-level feed posts).
  const [pollMode, setPollMode] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollClosesAt, setPollClosesAt] = useState("");

  // Mention autocomplete.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionItems, setMentionItems] = useState<
    { id: string; firstName: string; name: string; initials: string }[]
  >([]);
  const [mentionIdx, setMentionIdx] = useState(0);

  // Replies are CHAT-style; only top-level feed posts get the title field
  // and the poll/urgent toggles.
  const showTitle = isFeed && !parentId;
  const showPollToggle = isFeed && !parentId;

  function pickFile() {
    fileRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) {
      try {
        const stored = await uploadFile(f, "message-attachment");
        setAttachments((prev) => [
          ...prev,
          {
            fileName: stored.fileName,
            fileUrl: stored.url,
            fileSize: stored.fileSize,
            mimeType: stored.mimeType,
          },
        ]);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : `Upload failed: ${f.name}`,
        );
      }
    }
  }

  // Throttle typing pings to once per 2s while the user is actively typing.
  const lastTypingPing = useRef(0);
  function pingTyping() {
    const now = Date.now();
    if (now - lastTypingPing.current < 2_000) return;
    lastTypingPing.current = now;
    fetch(`/api/channels/${channelId}/typing`, { method: "POST" }).catch(
      () => {},
    );
  }

  // Detect @-token at the cursor and fetch suggestions.
  function handleBodyChange(value: string) {
    setBody(value);
    if (value.length > 0) pingTyping();
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? value.length;
    const prefix = value.slice(0, caret);
    const m = /(?:^|\s)@([\p{L}][\p{L}0-9_-]*)$/u.exec(prefix);
    if (m) {
      const q = m[1];
      setMentionQuery(q);
      setMentionIdx(0);
      fetch(
        `/api/communication/mention-suggestions?channelId=${channelId}&q=${encodeURIComponent(q)}`,
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.items) setMentionItems(d.items);
        })
        .catch(() => {});
    } else {
      setMentionQuery(null);
      setMentionItems([]);
    }
  }

  function applyMention(item: { firstName: string }) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? body.length;
    const prefix = body.slice(0, caret);
    const suffix = body.slice(caret);
    const replaced = prefix.replace(
      /(?:^|\s)@([\p{L}][\p{L}0-9_-]*)$/u,
      (match, _tok) =>
        match.startsWith("@")
          ? `@${item.firstName} `
          : `${match.slice(0, match.length - _tok.length - 1)}@${item.firstName} `,
    );
    const next = replaced + suffix;
    setBody(next);
    setMentionQuery(null);
    setMentionItems([]);
    requestAnimationFrame(() => {
      el.focus();
      const pos = replaced.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function setOption(i: number, v: string) {
    setPollOptions((prev) => prev.map((o, j) => (i === j ? v : o)));
  }

  async function send() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: showTitle ? title : null,
        body,
        parentId: parentId ?? null,
        isUrgent: showTitle && isUrgent ? true : false,
        attachments,
      };
      if (pollMode) {
        const cleaned = pollOptions
          .map((o) => o.trim())
          .filter((o) => o.length > 0);
        if (!pollQuestion.trim() || cleaned.length < 2) {
          toast.error(
            "A szavazáshoz legalább kérdés és 2 opció szükséges",
          );
          setSubmitting(false);
          return;
        }
        payload.kind = "POLL";
        payload.poll = {
          question: pollQuestion,
          options: cleaned,
          allowMultiple: pollAllowMultiple,
          closesAt: pollClosesAt || null,
        };
      } else if (
        !title.trim() &&
        !body.trim() &&
        attachments.length === 0
      ) {
        setSubmitting(false);
        return;
      }
      const res = await fetch(`/api/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "send failed");
      }
      setTitle("");
      setBody("");
      setIsUrgent(false);
      setAttachments([]);
      setPollMode(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setPollAllowMultiple(false);
      setPollClosesAt("");
      onDone?.();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "send failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        padding: compact ? "8px 0" : "12px 16px",
        borderTop: compact
          ? "none"
          : "1px solid color-mix(in srgb, var(--color-ink) 7%, transparent)",
        background: compact
          ? "transparent"
          : "color-mix(in srgb, var(--color-bg-3) 40%, transparent)",
      }}
    >
      {showTitle && !pollMode && (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("composer.placeholderPost")}
          style={{
            width: "100%",
            background: "var(--color-bg)",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
            borderRadius: "10px",
            padding: "10px 12px",
            fontSize: "14px",
            fontWeight: 600,
            outline: "none",
            marginBottom: "6px",
          }}
        />
      )}

      {pollMode && (
        <div
          style={{
            background: "var(--color-bg)",
            border:
              "1px solid color-mix(in srgb, var(--color-moss) 30%, transparent)",
            borderRadius: "10px",
            padding: "12px",
            marginBottom: "8px",
          }}
        >
          <input
            type="text"
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
            placeholder={t("poll.questionPlaceholder")}
            style={{
              width: "100%",
              background: "transparent",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
              borderRadius: "8px",
              padding: "8px 10px",
              fontSize: "13.5px",
              fontWeight: 600,
              outline: "none",
              marginBottom: "8px",
            }}
          />
          <div className="flex flex-col gap-1.5">
            {pollOptions.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={o}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={t("poll.optionPlaceholder")}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border:
                      "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
                    borderRadius: "8px",
                    padding: "7px 10px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPollOptions((prev) =>
                        prev.filter((_, j) => j !== i),
                      )
                    }
                    aria-label={t("poll.removeOption")}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "var(--color-muted)",
                      fontSize: "16px",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {pollOptions.length < 8 && (
            <button
              type="button"
              onClick={() => setPollOptions((prev) => [...prev, ""])}
              className="font-mono"
              style={{
                marginTop: "6px",
                fontSize: "10px",
                color: "var(--color-ink-soft)",
                background: "transparent",
                border: 0,
                cursor: "pointer",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              + {t("poll.addOption")}
            </button>
          )}
          <div
            className="flex flex-wrap items-center gap-3"
            style={{ marginTop: "10px" }}
          >
            <label
              className="font-mono inline-flex items-center gap-1.5"
              style={{
                fontSize: "10px",
                color: "var(--color-ink-soft)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={pollAllowMultiple}
                onChange={(e) => setPollAllowMultiple(e.target.checked)}
              />
              {t("poll.allowMultipleLabel")}
            </label>
            <label
              className="font-mono inline-flex items-center gap-1.5"
              style={{
                fontSize: "10px",
                color: "var(--color-ink-soft)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {t("poll.closesAtLabel")}
              <input
                type="datetime-local"
                value={pollClosesAt}
                onChange={(e) => setPollClosesAt(e.target.value)}
                style={{
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "6px",
                  border:
                    "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
                  background: "var(--color-bg-3)",
                }}
              />
            </label>
          </div>
        </div>
      )}

      <div
        style={{
          position: "relative",
          background: "var(--color-bg)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
          borderRadius: "10px",
          padding: "8px 10px",
        }}
      >
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          placeholder={t("composer.placeholder")}
          rows={compact ? 1 : 2}
          onKeyDown={(e) => {
            if (mentionQuery !== null && mentionItems.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIdx((i) => (i + 1) % mentionItems.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIdx(
                  (i) => (i - 1 + mentionItems.length) % mentionItems.length,
                );
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                applyMention(mentionItems[mentionIdx]);
                return;
              }
              if (e.key === "Escape") {
                setMentionQuery(null);
                return;
              }
            }
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
          style={{
            width: "100%",
            border: 0,
            outline: 0,
            resize: "none",
            background: "transparent",
            fontSize: "13.5px",
            color: "var(--color-ink)",
            fontFamily: "inherit",
          }}
        />
        {mentionQuery !== null && mentionItems.length > 0 && (
          <div
            className="absolute z-20"
            style={{
              bottom: "calc(100% + 4px)",
              left: 0,
              minWidth: "220px",
              background: "var(--color-card)",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
              borderRadius: "10px",
              padding: "5px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            }}
          >
            {mentionItems.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyMention(item);
                }}
                className="flex items-center gap-2 w-full text-left transition-colors"
                style={{
                  padding: "6px 8px",
                  borderRadius: "7px",
                  background:
                    i === mentionIdx ? "var(--color-bg-3)" : "transparent",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                <span
                  className="grid place-items-center flex-shrink-0"
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "var(--color-ochre)",
                    color: "var(--color-ink)",
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                    fontWeight: 600,
                    fontSize: "9px",
                  }}
                >
                  {item.initials}
                </span>
                <span style={{ fontSize: "12.5px", fontWeight: 500 }}>
                  @{item.firstName}
                </span>
                <span
                  className="font-mono ml-auto"
                  style={{
                    fontSize: "10px",
                    color: "var(--color-muted)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {item.name.split(" ").slice(1).join(" ")}
                </span>
              </button>
            ))}
          </div>
        )}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: "6px" }}>
            {attachments.map((a, i) => (
              <span
                key={i}
                className="font-mono inline-flex items-center gap-1.5"
                style={{
                  fontSize: "10px",
                  padding: "3px 8px",
                  borderRadius: "999px",
                  background: "var(--color-bg-3)",
                  color: "var(--color-ink-soft)",
                  letterSpacing: "0.04em",
                }}
              >
                📎 {a.fileName}
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((_, j) => j !== i))
                  }
                  aria-label="remove"
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "var(--color-muted)",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div
          className="flex items-center gap-2"
          style={{ marginTop: "6px" }}
        >
          <button
            type="button"
            onClick={pickFile}
            aria-label="attach"
            style={{
              border: 0,
              background: "transparent",
              color: "var(--color-muted)",
              fontSize: "16px",
              padding: "2px 6px",
              cursor: "pointer",
            }}
          >
            📎
          </button>
          {showPollToggle && (
            <button
              type="button"
              onClick={() => setPollMode((v) => !v)}
              aria-label="poll"
              className="font-mono"
              style={{
                border: pollMode
                  ? "1px solid var(--color-moss)"
                  : "1px solid transparent",
                background: pollMode
                  ? "color-mix(in srgb, var(--color-moss) 14%, transparent)"
                  : "transparent",
                color: pollMode ? "var(--color-moss)" : "var(--color-muted)",
                fontSize: "10px",
                padding: "3px 8px",
                borderRadius: "6px",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📊 {t("poll.createCta")}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            onChange={onFileChange}
            style={{ display: "none" }}
          />
          {showTitle && !pollMode && (
            <label
              className="font-mono inline-flex items-center gap-1.5"
              style={{
                fontSize: "10px",
                color: isUrgent ? "#c44" : "var(--color-muted)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                style={{ accentColor: "#c44" }}
              />
              {t("feed.urgent")}
            </label>
          )}
          <button
            type="button"
            onClick={send}
            disabled={
              submitting ||
              (pollMode
                ? !pollQuestion.trim() ||
                  pollOptions.filter((o) => o.trim()).length < 2
                : !title.trim() &&
                  !body.trim() &&
                  attachments.length === 0)
            }
            className="ml-auto transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "7px",
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              border: 0,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {t("composer.send")}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedCard({
  m,
  channelId,
  isBoardPlus,
  repliesByParent,
}: {
  m: ChannelDetailData["messages"][number];
  channelId: string;
  isBoardPlus: boolean;
  repliesByParent: Map<string, ChannelDetailData["messages"]>;
}) {
  const replies = repliesByParent.get(m.id) ?? [];
  const totalReplyCount = countReplies(m.id, repliesByParent);
  const t = useTranslations("communication");
  const router = useRouter();
  const date = new Date(m.createdAt);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [pinning, setPinning] = useState(false);

  async function togglePin() {
    if (pinning) return;
    setPinning(true);
    try {
      const res = await fetch(`/api/channel-messages/${m.id}/pin`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("Pin failed");
    } finally {
      setPinning(false);
    }
  }

  return (
    <article
      style={{
        background: "var(--color-bg)",
        border: m.isPinned
          ? "1px solid color-mix(in srgb, var(--color-ochre) 50%, transparent)"
          : "1px solid color-mix(in srgb, var(--color-ink) 7%, transparent)",
        borderRadius: "12px",
        padding: "16px 18px",
      }}
    >
      <header className="flex items-center gap-2.5" style={{ marginBottom: "8px" }}>
        <span
          className="grid place-items-center flex-shrink-0"
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            background: "var(--color-ochre)",
            color: "var(--color-ink)",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 600,
            fontSize: "11px",
          }}
        >
          {m.authorInitials}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <strong style={{ fontSize: "13.5px", fontWeight: 600 }}>
              {m.authorName}
            </strong>
            {m.authorRole && (
              <span
                className="font-mono"
                style={{
                  fontSize: "9px",
                  padding: "1px 5px",
                  borderRadius: "3px",
                  background:
                    "color-mix(in srgb, var(--color-ink) 7%, transparent)",
                  color: "var(--color-ink-soft)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                {m.authorRole}
              </span>
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
            {date.toLocaleString("hu-HU", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {m.editedAt && ` · ${t("feed.edited")}`}
          </div>
        </div>
        {m.isPinned && (
          <span
            className="font-mono"
            style={{
              fontSize: "9px",
              padding: "2px 6px",
              borderRadius: "4px",
              background: "var(--color-ochre)",
              color: "var(--color-ink)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {t("feed.pinned")}
          </span>
        )}
        {m.isUrgent && (
          <span
            className="font-mono"
            style={{
              fontSize: "9px",
              padding: "2px 6px",
              borderRadius: "4px",
              background: "#c44",
              color: "var(--color-bg)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {t("feed.urgent")}
          </span>
        )}
        {isBoardPlus && (
          <button
            type="button"
            onClick={togglePin}
            disabled={pinning}
            aria-label="pin"
            title={m.isPinned ? "Unpin" : "Pin"}
            style={{
              border: 0,
              background: "transparent",
              color: m.isPinned
                ? "var(--color-ochre)"
                : "var(--color-muted)",
              fontSize: "14px",
              padding: "2px 4px",
              cursor: pinning ? "wait" : "pointer",
            }}
          >
            📌
          </button>
        )}
      </header>
      {m.title && (
        <h3
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "16px",
            fontWeight: 600,
            letterSpacing: "-0.018em",
            marginBottom: "4px",
          }}
        >
          {m.title}
        </h3>
      )}
      {m.body && (
        <p
          style={{
            fontSize: "13.5px",
            lineHeight: 1.55,
            color: "var(--color-ink)",
            whiteSpace: "pre-wrap",
          }}
        >
          <MentionedBody body={m.body} mentions={m.mentions} />
        </p>
      )}
      {m.poll && <PollCard message={m} />}
      {m.attachments.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          style={{ marginTop: "10px" }}
        >
          {m.attachments.map((a) => (
            <AttachmentChip key={a.id} attachment={a} />
          ))}
        </div>
      )}

      <ReactionStrip message={m} />

      {/* Replies */}
      {replies.length > 0 && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "10px",
            paddingLeft: "12px",
            borderLeft:
              "2px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {replies.map((r) => (
            <ReplyRow
              key={r.id}
              m={r}
              channelId={channelId}
              repliesByParent={repliesByParent}
              depth={1}
            />
          ))}
        </div>
      )}

      <footer
        className="flex items-center gap-3 font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
          marginTop: "12px",
          paddingTop: "10px",
          borderTop:
            "1px dashed color-mix(in srgb, var(--color-ink) 8%, transparent)",
        }}
      >
        {m.kind === "POST" && (
          <span>
            {t("feed.readCount", {
              n: m.readCount.toString(),
              total: m.totalMembers.toString(),
            })}
          </span>
        )}
        {totalReplyCount > 0 && (
          <span>{t("feed.replies", { n: totalReplyCount.toString() })}</span>
        )}
        <button
          type="button"
          onClick={() => setShowReplyBox((v) => !v)}
          className="ml-auto"
          style={{
            background: "transparent",
            border: 0,
            color: "var(--color-ink-soft)",
            fontSize: "10px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 600,
            cursor: "pointer",
            padding: "2px 6px",
          }}
        >
          ↳ {t("feed.reply")}
        </button>
      </footer>

      {showReplyBox && (
        <div style={{ marginTop: "8px" }}>
          <Composer
            channelId={channelId}
            isFeed
            parentId={m.id}
            compact
            onDone={() => setShowReplyBox(false)}
          />
        </div>
      )}
    </article>
  );
}

/**
 * Recursive reply renderer. Indents children up to `MAX_INDENT_DEPTH`,
 * after which deeper replies render at the same indent as their parent
 * (still grouped under it, just no further stair-stepping).
 */
const MAX_INDENT_DEPTH = 2;

function countReplies(
  rootId: string,
  repliesByParent: Map<string, ChannelDetailData["messages"]>,
): number {
  const direct = repliesByParent.get(rootId) ?? [];
  let total = direct.length;
  for (const r of direct) total += countReplies(r.id, repliesByParent);
  return total;
}

function ReplyRow({
  m,
  channelId,
  repliesByParent,
  depth,
}: {
  m: ChannelDetailData["messages"][number];
  channelId: string;
  repliesByParent: Map<string, ChannelDetailData["messages"]>;
  depth: number;
}) {
  const t = useTranslations("communication");
  const date = new Date(m.createdAt);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const children = repliesByParent.get(m.id) ?? [];
  const indentChildren = depth < MAX_INDENT_DEPTH;
  const childDepth = indentChildren ? depth + 1 : depth;

  return (
    <div>
      <div className="flex items-start gap-2">
        <span
          className="grid place-items-center flex-shrink-0"
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            background: "var(--color-bg-3)",
            color: "var(--color-ink)",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 600,
            fontSize: "9px",
          }}
        >
          {m.authorInitials}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <strong style={{ fontSize: "12px", fontWeight: 600 }}>
              {m.authorName.split(" ")[0]}
            </strong>
            <span
              className="font-mono"
              style={{
                fontSize: "9.5px",
                color: "var(--color-muted)",
                letterSpacing: "0.04em",
              }}
            >
              {date.toLocaleString("hu-HU", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button
              type="button"
              onClick={() => setShowReplyBox((v) => !v)}
              className="ml-auto"
              style={{
                background: "transparent",
                border: 0,
                color: "var(--color-muted)",
                fontSize: "9.5px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 600,
                cursor: "pointer",
                padding: "0 2px",
              }}
            >
              ↳ {t("feed.reply")}
            </button>
          </div>
          {m.body && (
            <p
              style={{
                fontSize: "12.5px",
                lineHeight: 1.5,
                color: "var(--color-ink)",
                whiteSpace: "pre-wrap",
                marginTop: "2px",
              }}
            >
              <MentionedBody body={m.body} mentions={m.mentions} />
            </p>
          )}
          {m.attachments.length > 0 && (
            <div
              className="flex flex-wrap gap-1.5"
              style={{ marginTop: "4px" }}
            >
              {m.attachments.map((a) => (
                <AttachmentChip key={a.id} attachment={a} compact />
              ))}
            </div>
          )}
          {m.reactions.length > 0 && <ReactionStrip message={m} compact />}

          {showReplyBox && (
            <div style={{ marginTop: "6px" }}>
              <Composer
                channelId={channelId}
                isFeed
                parentId={m.id}
                compact
                onDone={() => setShowReplyBox(false)}
              />
            </div>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <div
          style={{
            marginTop: "8px",
            marginLeft: indentChildren ? "30px" : "30px",
            paddingLeft: indentChildren ? "10px" : 0,
            borderLeft: indentChildren
              ? "2px solid color-mix(in srgb, var(--color-ink) 7%, transparent)"
              : "none",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {children.map((c) => (
            <ReplyRow
              key={c.id}
              m={c}
              channelId={channelId}
              repliesByParent={repliesByParent}
              depth={childDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentChip({
  attachment,
  compact = false,
}: {
  attachment: ChannelDetailData["messages"][number]["attachments"][number];
  compact?: boolean;
}) {
  const sizeKb = Math.max(1, Math.round(attachment.fileSize / 1024));
  return (
    <a
      href={attachment.fileUrl}
      target="_blank"
      rel="noreferrer"
      className="font-mono inline-flex items-center gap-1.5 transition-colors hover:underline"
      style={{
        fontSize: compact ? "10px" : "11px",
        padding: compact ? "2px 8px" : "4px 10px",
        borderRadius: "999px",
        background: "var(--color-bg-3)",
        color: "var(--color-ink-soft)",
        letterSpacing: "0.04em",
        textDecoration: "none",
      }}
    >
      📎 {attachment.fileName}
      <span style={{ color: "var(--color-muted)" }}>· {sizeKb} kB</span>
    </a>
  );
}

function ChatBubble({
  m,
  prevAuthorId,
}: {
  m: ChannelDetailData["messages"][number];
  prevAuthorId: string | null;
}) {
  const isMine = m.isMine;
  const isContinuation = prevAuthorId === m.authorId;
  const date = new Date(m.createdAt);

  return (
    <div
      className="flex"
      style={{
        justifyContent: isMine ? "flex-end" : "flex-start",
        marginTop: isContinuation ? "0" : "6px",
      }}
    >
      <div
        className="flex items-end gap-2"
        style={{
          maxWidth: "76%",
          flexDirection: isMine ? "row-reverse" : "row",
        }}
      >
        {!isMine && !isContinuation && (
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
            {m.authorInitials}
          </span>
        )}
        {!isMine && isContinuation && (
          <span style={{ width: "26px", flexShrink: 0 }} />
        )}
        <div
          style={{
            background: isMine ? "var(--color-ink)" : "var(--color-bg-3)",
            color: isMine ? "var(--color-bg)" : "var(--color-ink)",
            borderRadius: isMine
              ? "14px 14px 4px 14px"
              : "14px 14px 14px 4px",
            padding: "8px 12px",
            fontSize: "13.5px",
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {!isMine && !isContinuation && (
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--color-ink-soft)",
                marginBottom: "2px",
              }}
            >
              {m.authorName.split(" ")[0]}
            </div>
          )}
          {m.body && (
            <MentionedBody
              body={m.body}
              mentions={m.mentions}
              textColor={isMine ? "var(--color-bg)" : "var(--color-ink)"}
            />
          )}
          {m.attachments.length > 0 && (
            <div
              className="flex flex-wrap gap-1.5"
              style={{ marginTop: "6px" }}
            >
              {m.attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono inline-flex items-center gap-1.5"
                  style={{
                    fontSize: "10px",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: isMine
                      ? "color-mix(in srgb, var(--color-bg) 15%, transparent)"
                      : "var(--color-bg)",
                    color: "inherit",
                    letterSpacing: "0.04em",
                    textDecoration: "none",
                    opacity: 0.9,
                  }}
                >
                  📎 {a.fileName}
                </a>
              ))}
            </div>
          )}
          <div
            className="font-mono"
            style={{
              fontSize: "9.5px",
              opacity: 0.6,
              marginTop: "3px",
              textAlign: isMine ? "right" : "left",
              letterSpacing: "0.04em",
            }}
          >
            {date.toLocaleTimeString("hu-HU", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>
      {m.reactions.length > 0 && (
        <div
          className="flex w-full"
          style={{
            justifyContent: isMine ? "flex-end" : "flex-start",
            paddingLeft: isMine ? 0 : "34px",
            marginTop: "-2px",
          }}
        >
          <ReactionStrip message={m} compact />
        </div>
      )}
    </div>
  );
}

// ─── Poll card ──────────────────────────────────────────────────────────

function PollCard({
  message,
}: {
  message: ChannelDetailData["messages"][number];
}) {
  const t = useTranslations("communication");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!message.poll) return null;
  const poll = message.poll;
  const isClosed =
    !!poll.closedAt ||
    (poll.closesAt ? new Date(poll.closesAt) < new Date() : false);

  async function vote(optionId: string) {
    if (busy || isClosed) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/channel-messages/${message.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("Vote failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background:
          "color-mix(in srgb, var(--color-moss) 6%, var(--color-bg))",
        border:
          "1px solid color-mix(in srgb, var(--color-moss) 25%, transparent)",
        borderRadius: "12px",
        padding: "14px 16px",
        marginTop: "10px",
      }}
    >
      <h4
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "14.5px",
          fontWeight: 600,
          letterSpacing: "-0.012em",
          marginBottom: "10px",
        }}
      >
        {poll.question}
      </h4>
      <div className="flex flex-col gap-1.5">
        {poll.options.map((o) => {
          const pct =
            poll.totalVotes > 0 ? (o.voteCount / poll.totalVotes) * 100 : 0;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => vote(o.id)}
              disabled={busy || isClosed}
              className="text-left transition-colors"
              style={{
                position: "relative",
                background: "var(--color-bg)",
                border: o.votedByMe
                  ? "1.5px solid var(--color-moss)"
                  : "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
                borderRadius: "9px",
                padding: "8px 12px",
                cursor: isClosed ? "default" : "pointer",
                overflow: "hidden",
              }}
            >
              {/* progress fill */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${pct}%`,
                  background: o.votedByMe
                    ? "color-mix(in srgb, var(--color-moss) 18%, transparent)"
                    : "color-mix(in srgb, var(--color-ink) 5%, transparent)",
                  transition: "width 250ms ease",
                }}
              />
              <span
                className="flex items-center gap-2"
                style={{ position: "relative" }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: o.votedByMe ? 600 : 500,
                    flex: 1,
                  }}
                >
                  {o.label}
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: "10.5px",
                    color: "var(--color-ink-soft)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {Math.round(pct)}% · {o.voteCount}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          color: isClosed ? "#c44" : "var(--color-muted)",
          letterSpacing: "0.05em",
          marginTop: "8px",
          textTransform: "uppercase",
        }}
      >
        {t("poll.totalVotes", { n: poll.totalVotes.toString() })}
        {isClosed && ` · ${t("poll.closed")}`}
        {!isClosed && poll.closesAt && (
          <>
            {" · "}
            {t("poll.closesIn", {
              date: new Date(poll.closesAt).toLocaleString("hu-HU", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Reaction strip ─────────────────────────────────────────────────────

const REACTION_EMOJI = ["👍", "❤️", "😂", "🎉", "🤔", "👀"] as const;

function ReactionStrip({
  message,
  compact = false,
}: {
  message: ChannelDetailData["messages"][number];
  compact?: boolean;
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle(emoji: string) {
    if (busy) return;
    setBusy(true);
    setPickerOpen(false);
    try {
      const res = await fetch(`/api/channel-messages/${message.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("React failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      style={{ marginTop: compact ? "4px" : "8px" }}
    >
      {message.reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => toggle(r.emoji)}
          disabled={busy}
          className="font-mono inline-flex items-center gap-1 transition-colors"
          style={{
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "999px",
            background: r.mine
              ? "color-mix(in srgb, var(--color-ochre) 28%, transparent)"
              : "var(--color-bg-3)",
            border: r.mine
              ? "1px solid var(--color-ochre)"
              : "1px solid transparent",
            color: "var(--color-ink)",
            letterSpacing: "0.02em",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: "12px" }}>{r.emoji}</span>
          <span style={{ fontWeight: r.mine ? 600 : 500 }}>{r.count}</span>
        </button>
      ))}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-label="add reaction"
          style={{
            border:
              "1px dashed color-mix(in srgb, var(--color-ink) 18%, transparent)",
            background: "transparent",
            borderRadius: "999px",
            padding: "1px 8px",
            fontSize: "11px",
            color: "var(--color-muted)",
            cursor: "pointer",
            lineHeight: 1.4,
          }}
        >
          + 😊
        </button>
        {pickerOpen && (
          <div
            className="absolute z-10"
            style={{
              top: "calc(100% + 4px)",
              left: 0,
              background: "var(--color-card)",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
              borderRadius: "10px",
              padding: "5px 6px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              display: "flex",
              gap: "2px",
            }}
            onMouseLeave={() => setPickerOpen(false)}
          >
            {REACTION_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => toggle(e)}
                style={{
                  fontSize: "16px",
                  padding: "4px 6px",
                  borderRadius: "6px",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Body with @-mentions highlighted ───────────────────────────────────

function MentionedBody({
  body,
  mentions,
  textColor,
}: {
  body: string;
  mentions: ChannelDetailData["messages"][number]["mentions"];
  textColor?: string;
}) {
  // Split body into runs of plain text and @-mentions whose firstName matches.
  const firstNames = new Set(
    mentions.map((m) => m.firstName.toLowerCase()),
  );
  const parts: { type: "text" | "mention"; value: string }[] = [];
  const re = /@([\p{L}][\p{L}0-9_-]{1,40})/gu;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const tok = match[1];
    if (firstNames.has(tok.toLowerCase())) {
      if (match.index > last) {
        parts.push({ type: "text", value: body.slice(last, match.index) });
      }
      parts.push({ type: "mention", value: `@${tok}` });
      last = match.index + match[0].length;
    }
  }
  if (last < body.length) {
    parts.push({ type: "text", value: body.slice(last) });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", value: body });
  }

  return (
    <>
      {parts.map((p, i) =>
        p.type === "mention" ? (
          <span
            key={i}
            style={{
              background:
                "color-mix(in srgb, var(--color-ochre) 22%, transparent)",
              color: textColor ?? "var(--color-ink)",
              padding: "0 4px",
              borderRadius: "4px",
              fontWeight: 600,
            }}
          >
            {p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Column 3: channel sidebar
// ─────────────────────────────────────────────────────────────────────────

function ChannelSidebar({ detail }: { detail: ChannelDetailData | null }) {
  const t = useTranslations("communication");
  if (!detail) return <div />;

  return (
    <div
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: "18px",
        position: "sticky",
        top: "20px",
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "8px",
        }}
      >
        {t(`kind.${detail.channel.kind}` as const)}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: "20px",
          fontWeight: 600,
          letterSpacing: "-0.022em",
          marginBottom: "8px",
        }}
      >
        {detail.channel.name}
      </h3>
      {detail.channel.description && (
        <p
          style={{
            fontSize: "12.5px",
            color: "var(--color-ink-soft)",
            lineHeight: 1.5,
            marginBottom: "14px",
          }}
        >
          {detail.channel.description}
        </p>
      )}
      <div
        className="flex items-center gap-2 font-mono"
        style={{
          fontSize: "11px",
          color: "var(--color-ink-soft)",
          letterSpacing: "0.04em",
          paddingTop: "12px",
          borderTop:
            "1px solid color-mix(in srgb, var(--color-ink) 7%, transparent)",
        }}
      >
        <span>
          {t("members.count", { n: detail.totalMembers.toString() })}
        </span>
      </div>
    </div>
  );
}

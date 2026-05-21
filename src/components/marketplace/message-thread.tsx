"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface ThreadMessage {
  id: string;
  side: "BOARD" | "CONTRACTOR";
  senderDisplayName: string;
  isSelf: boolean;
  body: string;
  createdAt: string;
}

interface AccessMeta {
  canWrite: boolean;
  side: "BOARD" | "CONTRACTOR";
  publicationStatus: string;
  isWinningThread: boolean;
}

/**
 * Anonymous message thread, scoped to a (publicationId, bidderId) pair.
 * Works for both sides of the marketplace — the API route resolves the
 * side from the session. Plain-text only.
 */
export function MessageThread({
  publicationId,
  bidderId,
  locale: _locale,
}: {
  publicationId: string;
  bidderId: string;
  locale: "hu" | "en";
}) {
  const t = useTranslations("marketplace");
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [access, setAccess] = useState<AccessMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/marketplace/threads/${publicationId}/${bidderId}/messages`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setError(t("loadFailed"));
        return;
      }
      const data = (await res.json()) as {
        messages: ThreadMessage[];
        access: AccessMeta;
      };
      setMessages(data.messages);
      setAccess(data.access);
    } catch {
      setError(t("loadFailed"));
    }
  }, [publicationId, bidderId, t]);

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/marketplace/threads/${publicationId}/${bidderId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      if (!res.ok) {
        setError(t("loadFailed"));
        return;
      }
      setDraft("");
      await reload();
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="rounded-xl border"
      style={{
        padding: "12px 14px",
        background: "var(--color-bg)",
        borderColor: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
      }}
    >
      <header
        className="flex items-center justify-between"
        style={{ marginBottom: "10px" }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {t("messagesHeading")}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
            fontStyle: "italic",
          }}
        >
          {access?.isWinningThread
            ? t("messagesPostAwardNote")
            : t("messagesAnonymousNote")}
        </span>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-md border mb-2"
          style={{
            padding: "6px 10px",
            fontSize: "11.5px",
            background:
              "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--color-danger) 30%, transparent)",
            color: "var(--color-danger)",
          }}
        >
          {error}
        </div>
      )}

      <ul
        className="flex flex-col gap-2"
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          maxHeight: "300px",
          overflowY: "auto",
        }}
      >
        {loading ? (
          <Muted>…</Muted>
        ) : messages.length === 0 ? (
          <Muted>{t("messagesEmpty")}</Muted>
        ) : (
          messages.map((m) => <MessageRow key={m.id} m={m} />)
        )}
      </ul>

      {access?.canWrite && (
        <div className="flex items-end gap-2 mt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("messagesPlaceholder")}
            rows={2}
            style={{
              flex: 1,
              padding: "8px 10px",
              fontSize: "13px",
              background: "var(--color-bg-3)",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
              borderRadius: "8px",
              outline: "none",
              resize: "vertical",
              minHeight: "44px",
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !draft.trim()}
            className="disabled:opacity-50"
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              flexShrink: 0,
            }}
          >
            {sending ? t("messagesSendingLabel") : t("messagesSend")}
          </button>
        </div>
      )}
    </div>
  );
}

function MessageRow({ m }: { m: ThreadMessage }) {
  const t = useTranslations("marketplace");
  const sideLabel = m.isSelf
    ? t("messagesYou")
    : m.side === "BOARD"
      ? t("messagesBoardSenderLabel")
      : t("messagesContractorSenderLabel");
  return (
    <li
      className="rounded-md"
      style={{
        padding: "8px 10px",
        background: m.isSelf
          ? "color-mix(in srgb, var(--color-moss) 10%, transparent)"
          : "var(--color-bg-3)",
        alignSelf: m.isSelf ? "flex-end" : "flex-start",
        maxWidth: "85%",
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.05em",
          marginBottom: "3px",
        }}
      >
        {sideLabel} ·{" "}
        {new Date(m.createdAt).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
      <p
        style={{
          fontSize: "13px",
          color: "var(--color-ink)",
          margin: 0,
          whiteSpace: "pre-wrap",
          lineHeight: 1.45,
        }}
      >
        {m.body}
      </p>
    </li>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono"
      style={{
        fontSize: "12px",
        color: "var(--color-muted)",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </span>
  );
}

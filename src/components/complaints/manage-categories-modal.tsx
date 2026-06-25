"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  _count: { complaints: number };
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ManageCategoriesModal({ open, onClose }: Props) {
  const t = useTranslations("complaints.categoriesModal");
  const router = useRouter();
  const confirm = useConfirm();
  const [items, setItems] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");

  // Load on open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/complaint-categories")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { categories: CategoryRow[] }) => {
        if (!cancelled) setItems(d.categories);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  async function refresh() {
    const r = await fetch("/api/complaint-categories");
    if (r.ok) {
      const d = (await r.json()) as { categories: CategoryRow[] };
      setItems(d.categories);
    }
    router.refresh();
  }

  async function add() {
    if (!newName.trim()) return;
    setBusyId("__new__");
    try {
      const r = await fetch("/api/complaint-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, icon: newIcon || null }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "create failed");
      }
      setNewName("");
      setNewIcon("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "create failed");
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/complaint-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, icon: editIcon || null }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "save failed");
      }
      setEditingId(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "save failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(id: string, isActive: boolean) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/complaint-categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "toggle failed");
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "toggle failed");
    } finally {
      setBusyId(null);
    }
  }

  async function destroy(id: string, name: string) {
    const ok = await confirm({
      title: t("deleteConfirm", { name }),
      danger: true,
    });
    if (!ok) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/complaint-categories/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "delete failed");
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center"
      style={{
        background: "color-mix(in srgb, var(--color-ink) 50%, transparent)",
        padding: "20px",
      }}
      onClick={() => onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 100%)",
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
          background: "var(--color-card)",
          borderRadius: "16px",
          padding: "24px 26px",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "22px",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            marginBottom: "4px",
          }}
        >
          {t("title")}
        </h2>
        <p
          style={{
            fontSize: "12.5px",
            color: "var(--color-ink-soft)",
            marginBottom: "18px",
          }}
        >
          {t("subtitle")}
        </p>

        {/* List */}
        <div className="flex flex-col gap-1.5" style={{ marginBottom: "18px" }}>
          {loading && items.length === 0 && (
            <div
              style={{
                fontSize: "12.5px",
                color: "var(--color-muted)",
                fontStyle: "italic",
              }}
            >
              …
            </div>
          )}
          {items.map((c) => {
            const isEditing = editingId === c.id;
            const isBusy = busyId === c.id;
            return (
              <div
                key={c.id}
                className="flex items-center gap-2"
                style={{
                  padding: "8px 10px",
                  borderRadius: "10px",
                  background: c.isActive
                    ? "var(--color-bg)"
                    : "var(--color-bg-3)",
                  border:
                    "1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)",
                  opacity: c.isActive ? 1 : 0.65,
                }}
              >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editIcon}
                      onChange={(e) => setEditIcon(e.target.value)}
                      maxLength={4}
                      style={{
                        width: "36px",
                        textAlign: "center",
                        fontSize: "16px",
                        padding: "4px",
                        border:
                          "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
                        borderRadius: "6px",
                        background: "var(--color-card)",
                        outline: "none",
                      }}
                    />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{
                        flex: 1,
                        fontSize: "13.5px",
                        padding: "6px 10px",
                        border:
                          "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
                        borderRadius: "6px",
                        background: "var(--color-card)",
                        outline: "none",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(c.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => saveEdit(c.id)}
                      disabled={isBusy || !editName.trim()}
                      className="font-mono"
                      style={{
                        fontSize: "10px",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        background: "var(--color-ink)",
                        color: "var(--color-bg)",
                        border: 0,
                        cursor: "pointer",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                      }}
                    >
                      {t("saveName")}
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      style={{ fontSize: "16px", width: "24px", textAlign: "center" }}
                      aria-hidden
                    >
                      {c.icon ?? "·"}
                    </span>
                    <span
                      style={{
                        fontSize: "13.5px",
                        fontWeight: 500,
                        flex: 1,
                      }}
                    >
                      {c.name}
                    </span>
                    {c.isDefault && (
                      <Badge tone="default">{t("defaultBadge")}</Badge>
                    )}
                    {!c.isActive && (
                      <Badge tone="muted">{t("hiddenBadge")}</Badge>
                    )}
                    {c._count.complaints > 0 && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: "10px",
                          color: "var(--color-muted)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {t("inUse", { n: c._count.complaints.toString() })}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditName(c.name);
                        setEditIcon(c.icon ?? "");
                      }}
                      disabled={isBusy}
                      className="font-mono"
                      style={{
                        fontSize: "10px",
                        padding: "4px 8px",
                        borderRadius: "5px",
                        background: "transparent",
                        color: "var(--color-ink-soft)",
                        border: 0,
                        cursor: "pointer",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                      }}
                    >
                      {t("rename")}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(c.id, c.isActive)}
                      disabled={isBusy}
                      className="font-mono"
                      style={{
                        fontSize: "10px",
                        padding: "4px 8px",
                        borderRadius: "5px",
                        background: "transparent",
                        color: "var(--color-ink-soft)",
                        border: 0,
                        cursor: "pointer",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                      }}
                    >
                      {c.isActive ? t("hide") : t("show")}
                    </button>
                    {!c.isDefault && c._count.complaints === 0 && (
                      <button
                        type="button"
                        onClick={() => destroy(c.id, c.name)}
                        disabled={isBusy}
                        className="font-mono"
                        style={{
                          fontSize: "10px",
                          padding: "4px 8px",
                          borderRadius: "5px",
                          background: "transparent",
                          color: "#c44",
                          border: 0,
                          cursor: "pointer",
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                        }}
                      >
                        {t("delete")}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* New row */}
        <div
          className="flex items-center gap-2"
          style={{
            padding: "10px 12px",
            borderRadius: "10px",
            background: "var(--color-bg-3)",
            border:
              "1px dashed color-mix(in srgb, var(--color-ink) 18%, transparent)",
            marginBottom: "20px",
          }}
        >
          <input
            type="text"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            placeholder="🏷️"
            maxLength={4}
            title={t("iconHint")}
            style={{
              width: "36px",
              textAlign: "center",
              fontSize: "16px",
              padding: "5px",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
              borderRadius: "6px",
              background: "var(--color-card)",
              outline: "none",
            }}
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("newName")}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            style={{
              flex: 1,
              fontSize: "13.5px",
              padding: "7px 10px",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)",
              borderRadius: "6px",
              background: "var(--color-card)",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={add}
            disabled={busyId === "__new__" || !newName.trim()}
            className="transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{
              padding: "7px 14px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "7px",
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              border: 0,
              cursor: "pointer",
            }}
          >
            + {t("addCta")}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 18px",
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
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "default" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className="font-mono"
      style={{
        fontSize: "9px",
        padding: "2px 6px",
        borderRadius: "4px",
        background:
          tone === "default"
            ? "color-mix(in srgb, var(--color-moss) 18%, transparent)"
            : "color-mix(in srgb, var(--color-ink) 10%, transparent)",
        color:
          tone === "default" ? "var(--color-moss)" : "var(--color-ink-soft)",
        letterSpacing: "0.06em",
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

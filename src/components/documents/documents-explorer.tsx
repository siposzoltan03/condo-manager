"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type {
  DocCategoryNode,
  DocumentRow,
  DocumentsOverviewData,
  VersionPanelData,
} from "@/lib/documents-dal";

interface Props {
  data: DocumentsOverviewData;
  initialSearch: string;
  initialFullText: boolean;
}

export function DocumentsExplorer({
  data,
  initialSearch,
  initialFullText,
}: Props) {
  const t = useTranslations("documents");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialSearch);
  const [fullText, setFullText] = useState(initialFullText);
  const [visibilityFilter, setVisibilityFilter] = useState<
    "ALL" | "PUBLIC" | "BOARD_ONLY" | "ADMIN_ONLY"
  >("ALL");
  const [fileTypeFilter, setFileTypeFilter] = useState<
    "ALL" | "pdf" | "doc" | "xls" | "img"
  >("ALL");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(
    data.pinnedDocument?.id ?? data.documents[0]?.id ?? null,
  );

  const [versionPanel, setVersionPanel] = useState<VersionPanelData | null>(null);
  const [loadingPanel, setLoadingPanel] = useState(false);

  // Push search to the URL on debounce so the server-rendered DAL re-runs.
  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search) params.set("q", search);
      else params.delete("q");
      if (fullText) params.set("ft", "1");
      else params.delete("ft");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, fullText]);

  // Load the version panel + record a view when selection changes.
  useEffect(() => {
    if (!selectedDocId) {
      setVersionPanel(null);
      return;
    }
    let cancelled = false;
    setLoadingPanel(true);
    fetch(`/api/documents/${selectedDocId}/version-panel`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setVersionPanel(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingPanel(false);
      });
    // Fire-and-forget view increment.
    fetch(`/api/documents/${selectedDocId}/view`, { method: "POST" }).catch(
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [selectedDocId]);

  function selectCategory(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("category", id);
    else params.delete("category");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Apply local filters (visibility + file type) without round-tripping.
  const filteredDocs = useMemo(() => {
    return data.documents.filter((d) => {
      if (visibilityFilter !== "ALL" && d.visibility !== visibilityFilter) {
        return false;
      }
      if (
        fileTypeFilter !== "ALL" &&
        d.latestVersion?.fileType !== fileTypeFilter
      ) {
        return false;
      }
      return true;
    });
  }, [data.documents, visibilityFilter, fileTypeFilter]);

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)_320px] items-start"
      style={{ gap: "24px" }}
    >
      <CategoryTree
        tree={data.tree}
        totalDocuments={data.totalDocuments}
        selectedCategoryId={data.selectedCategoryId}
        onSelect={selectCategory}
        totalBytesUsed={data.totalBytesUsed}
        storageQuotaBytes={data.storageQuotaBytes}
      />

      <div className="min-w-0">
        <CategoryHeader
          name={data.selectedCategoryName ?? t("tree.allCategories")}
          docCount={data.selectedDocumentCount}
          totalBytes={data.selectedTotalBytes}
          lastUpdate={data.selectedLastUpdateLabel}
        />

        {data.pinnedDocument && (
          <PinnedHero
            doc={data.pinnedDocument}
            onClick={() => setSelectedDocId(data.pinnedDocument!.id)}
          />
        )}

        <FilterBar
          search={search}
          onSearch={setSearch}
          fullText={fullText}
          onFullText={setFullText}
          visibility={visibilityFilter}
          onVisibility={setVisibilityFilter}
          fileType={fileTypeFilter}
          onFileType={setFileTypeFilter}
        />

        <DocumentTable
          docs={filteredDocs}
          selectedId={selectedDocId}
          onSelect={setSelectedDocId}
          expiringSoonCount={data.expiringSoonCount}
        />
      </div>

      <VersionPanel
        documentId={selectedDocId}
        panel={versionPanel}
        loading={loadingPanel}
      />
    </div>
  );
}

// ─── Category Tree ───────────────────────────────────────────────────────

function CategoryTree({
  tree,
  totalDocuments,
  selectedCategoryId,
  onSelect,
  totalBytesUsed,
  storageQuotaBytes,
}: {
  tree: DocCategoryNode[];
  totalDocuments: number;
  selectedCategoryId: string | null;
  onSelect: (id: string | null) => void;
  totalBytesUsed: number;
  storageQuotaBytes: number;
}) {
  const t = useTranslations("documents");

  return (
    <aside
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: "10px",
        position: "sticky",
        top: "24px",
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "8px 10px 4px",
        }}
      >
        {t("tree.label")}
      </div>
      <TreeNode
        node={null}
        label={t("tree.allCategories")}
        count={totalDocuments}
        selected={selectedCategoryId === null}
        onClick={() => onSelect(null)}
      />
      {tree.map((root) => (
        <TreeBranch
          key={root.id}
          node={root}
          selectedCategoryId={selectedCategoryId}
          onSelect={onSelect}
          depth={0}
        />
      ))}
      <StorageBar bytesUsed={totalBytesUsed} bytesQuota={storageQuotaBytes} />
    </aside>
  );
}

function TreeBranch({
  node,
  selectedCategoryId,
  onSelect,
  depth,
}: {
  node: DocCategoryNode;
  selectedCategoryId: string | null;
  onSelect: (id: string | null) => void;
  depth: number;
}) {
  return (
    <>
      <TreeNode
        node={node}
        label={node.name}
        count={node.documentCount}
        selected={selectedCategoryId === node.id}
        onClick={() => onSelect(node.id)}
        depth={depth}
      />
      {node.children.map((c) => (
        <TreeBranch
          key={c.id}
          node={c}
          selectedCategoryId={selectedCategoryId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

function TreeNode({
  label,
  count,
  selected,
  onClick,
  depth = 0,
}: {
  node: DocCategoryNode | null;
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  depth?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 transition-colors hover:bg-[var(--color-bg-3)]"
      style={{
        width: "100%",
        padding: "8px 10px",
        paddingLeft: `${10 + depth * 16}px`,
        borderRadius: "7px",
        fontSize: depth === 0 ? "13px" : "12px",
        color: selected
          ? "var(--color-bg)"
          : depth === 0
            ? "var(--color-ink-soft)"
            : "var(--color-muted)",
        fontWeight: selected ? 600 : depth === 0 ? 500 : 400,
        background: selected ? "var(--color-ink)" : "transparent",
        border: 0,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {depth > 0 && (
        <span
          aria-hidden
          style={{
            color: "color-mix(in srgb, var(--color-ink) 15%, transparent)",
          }}
        >
          —
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span
        className="font-mono"
        style={{
          fontSize: "10px",
          padding: "1px 6px",
          borderRadius: "4px",
          background: selected
            ? "var(--color-bg)"
            : "color-mix(in srgb, var(--color-ink) 7%, transparent)",
          color: selected ? "var(--color-ink)" : "var(--color-muted)",
          letterSpacing: "0.04em",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function StorageBar({
  bytesUsed,
  bytesQuota,
}: {
  bytesUsed: number;
  bytesQuota: number;
}) {
  const t = useTranslations("documents");
  const pctRaw = bytesQuota > 0 ? (bytesUsed / bytesQuota) * 100 : 0;
  const pct = Math.min(100, Math.max(2, Math.round(pctRaw)));
  return (
    <div
      style={{
        borderTop:
          "1px dashed color-mix(in srgb, var(--color-ink) 6%, transparent)",
        marginTop: "10px",
        paddingTop: "10px",
      }}
    >
      <div
        className="font-mono"
        style={{
          padding: "10px",
          fontSize: "10px",
          color: "var(--color-muted)",
          letterSpacing: "0.05em",
          lineHeight: 1.6,
        }}
      >
        <b
          style={{
            color: "var(--color-ink)",
            fontWeight: 600,
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "13px",
          }}
        >
          {formatBytes(bytesUsed)}
        </b>{" "}
        / {formatBytes(bytesQuota)} {t("tree.used")}
        <div
          style={{
            height: "4px",
            borderRadius: "4px",
            background:
              "color-mix(in srgb, var(--color-ink) 8%, transparent)",
            overflow: "hidden",
            margin: "6px 0 2px",
          }}
        >
          <span
            style={{
              display: "block",
              height: "100%",
              background: "var(--color-moss-2)",
              width: `${pct}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ─── Category header ─────────────────────────────────────────────────────

function CategoryHeader({
  name,
  docCount,
  totalBytes,
  lastUpdate,
}: {
  name: string;
  docCount: number;
  totalBytes: number;
  lastUpdate: string | null;
}) {
  const t = useTranslations("documents");
  return (
    <div
      className="flex justify-between items-end"
      style={{ marginBottom: "16px" }}
    >
      <div>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "26px",
            fontWeight: 500,
            letterSpacing: "-0.025em",
          }}
        >
          {name}
        </h2>
        <p
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-muted)",
            margin: "4px 0 0 0",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {t("header.summary", {
            count: docCount.toString(),
            size: formatBytes(totalBytes),
            updated: lastUpdate ?? "—",
          })}
        </p>
      </div>
    </div>
  );
}

// ─── Pinned hero ─────────────────────────────────────────────────────────

function PinnedHero({
  doc,
  onClick,
}: {
  doc: DocumentRow;
  onClick: () => void;
}) {
  const t = useTranslations("documents");
  const ft = doc.latestVersion?.fileType ?? "other";

  async function downloadDoc(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/documents/${doc.id}/download`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("download failed");
      const data = await res.json();
      window.open(data.fileUrl, "_blank");
    } catch {
      toast.error(t("errors.downloadFailed"));
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="grid items-start text-left transition-shadow hover:shadow-lg grid-cols-[64px_minmax(0,1fr)] gap-4 sm:items-center sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:gap-[22px]"
      style={{
        background: "var(--color-ink)",
        color: "var(--color-bg)",
        borderRadius: "14px",
        padding: "22px 26px",
        marginBottom: "20px",
        border: "1px solid var(--color-ink)",
        cursor: "pointer",
        width: "100%",
      }}
    >
      <div
        className="grid place-items-center"
        style={{
          width: "64px",
          height: "80px",
          borderRadius: "6px 10px 10px 6px",
          background: bgForFileType(ft, true),
          color: "#fff",
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontWeight: 700,
          fontSize: "14px",
          position: "relative",
        }}
      >
        {ft.toUpperCase()}
      </div>
      <div className="min-w-0">
        <div
          className="flex items-center gap-2.5 flex-wrap"
          style={{ marginBottom: "8px" }}
        >
          <Chip kind="pin">★ {t("hero.pinned")}</Chip>
          {doc.daysToExpiry != null && doc.daysToExpiry < 90 && doc.daysToExpiry >= 0 && (
            <Chip kind="warn">
              {t("hero.expiresIn", { n: doc.daysToExpiry.toString() })}
            </Chip>
          )}
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "color-mix(in srgb, var(--color-bg) 60%, transparent)",
              letterSpacing: "0.04em",
            }}
          >
            v{doc.latestVersion?.versionNumber ?? "?"} · {t("hero.modifiedAgo", { n: doc.ageDays.toString() })}
          </span>
        </div>
        <h3
          style={{
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontSize: "20px",
            fontWeight: 600,
            letterSpacing: "-0.015em",
            marginBottom: "6px",
          }}
        >
          {doc.title}
        </h3>
        {doc.description && (
          <div
            style={{
              fontSize: "12.5px",
              color: "color-mix(in srgb, var(--color-bg) 70%, transparent)",
              maxWidth: "58ch",
            }}
          >
            {doc.description}
          </div>
        )}
        <div
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
            letterSpacing: "0.04em",
            marginTop: "10px",
          }}
        >
          {doc.latestVersion ? `${formatBytes(doc.latestVersion.fileSize)} · ` : ""}
          <b style={{ color: "var(--color-bg)", fontWeight: 600 }}>
            {doc.uploaderName}
          </b>{" "}
          {t("hero.modifier")}
        </div>
      </div>
      {/* Action buttons — full-width row spanning both columns on phone,
          right-side stack on sm:+ where there's space for an auto column. */}
      <div className="col-span-2 flex flex-row gap-2 sm:col-span-1 sm:flex-col">
        <button
          type="button"
          onClick={downloadDoc}
          className="flex-1 sm:flex-none"
          style={{
            background: "var(--color-ochre)",
            color: "var(--color-ink)",
            border: 0,
            padding: "9px 14px",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          {t("hero.openCta")}
        </button>
        <button
          type="button"
          onClick={downloadDoc}
          className="flex-1 sm:flex-none"
          style={{
            background: "transparent",
            border:
              "1px solid color-mix(in srgb, var(--color-bg) 25%, transparent)",
            color: "var(--color-bg)",
            padding: "9px 14px",
            borderRadius: "8px",
            fontWeight: 500,
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          {t("hero.downloadCta")}
        </button>
      </div>
    </button>
  );
}

function Chip({
  kind,
  children,
}: {
  kind: "pin" | "warn" | "legal";
  children: React.ReactNode;
}) {
  const styles = {
    pin: { bg: "var(--color-ochre)", color: "var(--color-ink)" },
    warn: {
      bg: "color-mix(in srgb, var(--color-danger) 35%, transparent)",
      color: "var(--color-bg)",
    },
    legal: {
      bg: "color-mix(in srgb, var(--color-bg) 18%, transparent)",
      color: "var(--color-bg)",
    },
  }[kind];
  return (
    <span
      className="font-mono"
      style={{
        fontSize: "10px",
        padding: "3px 8px",
        borderRadius: "4px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        fontWeight: 700,
        ...styles,
      }}
    >
      {children}
    </span>
  );
}

// ─── Filter bar ──────────────────────────────────────────────────────────

function FilterBar({
  search,
  onSearch,
  fullText,
  onFullText,
  visibility,
  onVisibility,
  fileType,
  onFileType,
}: {
  search: string;
  onSearch: (v: string) => void;
  fullText: boolean;
  onFullText: (v: boolean) => void;
  visibility: "ALL" | "PUBLIC" | "BOARD_ONLY" | "ADMIN_ONLY";
  onVisibility: (v: "ALL" | "PUBLIC" | "BOARD_ONLY" | "ADMIN_ONLY") => void;
  fileType: "ALL" | "pdf" | "doc" | "xls" | "img";
  onFileType: (v: "ALL" | "pdf" | "doc" | "xls" | "img") => void;
}) {
  const t = useTranslations("documents");
  return (
    <div
      className="flex items-center gap-2.5 flex-wrap"
      style={{
        marginBottom: "14px",
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "10px",
        padding: "10px 14px",
      }}
    >
      <div
        className="flex items-center gap-2.5 flex-1"
        style={{ fontSize: "13px", color: "var(--color-muted)", minWidth: "220px" }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("filter.searchPlaceholder")}
          style={{
            border: 0,
            outline: "none",
            background: "transparent",
            flex: 1,
            font: "inherit",
            color: "var(--color-ink)",
          }}
        />
      </div>
      <Select
        value={visibility}
        onChange={(v) =>
          onVisibility(v as "ALL" | "PUBLIC" | "BOARD_ONLY" | "ADMIN_ONLY")
        }
        options={[
          { value: "ALL", label: t("filter.visibilityAll") },
          { value: "PUBLIC", label: t("visibility.PUBLIC") },
          { value: "BOARD_ONLY", label: t("visibility.BOARD_ONLY") },
          { value: "ADMIN_ONLY", label: t("visibility.ADMIN_ONLY") },
        ]}
      />
      <Select
        value={fileType}
        onChange={(v) =>
          onFileType(v as "ALL" | "pdf" | "doc" | "xls" | "img")
        }
        options={[
          { value: "ALL", label: t("filter.typeAll") },
          { value: "pdf", label: "PDF" },
          { value: "doc", label: "DOCX" },
          { value: "xls", label: "XLSX" },
          { value: "img", label: "IMG" },
        ]}
      />
      <label
        className="flex items-center gap-2"
        style={{
          fontSize: "12px",
          color: "var(--color-ink-soft)",
          fontWeight: 500,
          paddingLeft: "8px",
          borderLeft:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          cursor: "pointer",
        }}
      >
        <button
          type="button"
          onClick={() => onFullText(!fullText)}
          aria-pressed={fullText}
          style={{
            width: "28px",
            height: "16px",
            borderRadius: "999px",
            background: fullText
              ? "var(--color-ink)"
              : "color-mix(in srgb, var(--color-ink) 20%, transparent)",
            border: 0,
            position: "relative",
            cursor: "pointer",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: "2px",
              left: fullText ? "14px" : "2px",
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "var(--color-bg)",
              transition: "left 120ms",
            }}
          />
        </button>
        {t("filter.fullText")}
      </label>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        font: "inherit",
        fontSize: "12px",
        fontWeight: 500,
        padding: "6px 10px",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "6px",
        background: "var(--color-bg-3)",
        color: "var(--color-ink)",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Document table ──────────────────────────────────────────────────────

function DocumentTable({
  docs,
  selectedId,
  onSelect,
  expiringSoonCount,
}: {
  docs: DocumentRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  expiringSoonCount: number;
}) {
  const t = useTranslations("documents");

  if (docs.length === 0) {
    return (
      <div
        style={{
          background: "var(--color-card)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "14px",
          padding: "48px 32px",
          textAlign: "center",
          color: "var(--color-muted)",
          fontSize: "13px",
        }}
      >
        {t("table.empty")}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <Th style={{ width: "42%" }}>{t("table.colDocument")}</Th>
            <Th>{t("table.colVersion")}</Th>
            <Th>{t("table.colVisibility")}</Th>
            <Th>{t("table.colUploader")}</Th>
            <Th>{t("table.colUpdated")}</Th>
            <Th align="right" />
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <DocRow
              key={d.id}
              doc={d}
              selected={d.id === selectedId}
              onClick={() => onSelect(d.id)}
            />
          ))}
        </tbody>
      </table>
      <div
        className="flex justify-between items-center font-mono"
        style={{
          padding: "12px 18px",
          fontSize: "11px",
          color: "var(--color-muted)",
          letterSpacing: "0.04em",
          background: "var(--color-bg-3)",
          borderTop:
            "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
        }}
      >
        <div>
          {t("table.showing", { n: docs.length.toString() })}
          {expiringSoonCount > 0 && (
            <>
              {" · "}
              <b style={{ color: "var(--color-ink)" }}>
                {t("table.expiringSoon", {
                  n: expiringSoonCount.toString(),
                })}
              </b>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  style,
  align,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  align?: "left" | "right";
}) {
  return (
    <th
      className="font-mono"
      style={{
        textAlign: align ?? "left",
        padding: "11px 18px",
        fontSize: "10px",
        fontWeight: 500,
        color: "var(--color-muted)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: "var(--color-bg-3)",
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function DocRow({
  doc,
  selected,
  onClick,
}: {
  doc: DocumentRow;
  selected: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("documents");
  const ft = doc.latestVersion?.fileType ?? "other";
  const isExpiring =
    doc.daysToExpiry != null && doc.daysToExpiry < 90 && doc.daysToExpiry >= 0;
  const isPastDue = doc.daysToExpiry != null && doc.daysToExpiry < 0;

  return (
    <tr
      onClick={onClick}
      style={{
        background: selected
          ? "color-mix(in srgb, var(--color-ochre) 10%, transparent)"
          : "transparent",
        cursor: "pointer",
      }}
    >
      <Td>
        <div className="flex items-center gap-3">
          <span
            className="grid place-items-center flex-shrink-0"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              background: bgForFileType(ft, false),
              color: colorForFileType(ft),
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {ft.toUpperCase()}
          </span>
          <div className="min-w-0">
            <div
              className="truncate"
              style={{
                fontWeight: 600,
                fontSize: "13.5px",
                letterSpacing: "-0.005em",
              }}
            >
              {doc.title}
            </div>
            <div
              className="truncate"
              style={{
                color: "var(--color-muted)",
                fontSize: "11.5px",
                marginTop: "2px",
              }}
            >
              {doc.description ?? doc.latestVersion?.fileName}
              {(isExpiring || isPastDue) && doc.daysToExpiry != null && (
                <span
                  style={{
                    color: "var(--color-danger)",
                    marginLeft: "8px",
                  }}
                >
                  {isPastDue
                    ? t("table.expired")
                    : t("table.expiresInDays", {
                        n: doc.daysToExpiry.toString(),
                      })}
                </span>
              )}
            </div>
          </div>
        </div>
      </Td>
      <Td>
        <span
          className="font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-ink-soft)",
            background: "var(--color-bg-3)",
            padding: "3px 7px",
            borderRadius: "5px",
            fontWeight: 600,
            letterSpacing: "0.02em",
            border:
              "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          }}
        >
          v{doc.latestVersion?.versionNumber ?? "?"}
          {doc.ageDays < 7 && (
            <span style={{ color: "var(--color-ochre)", marginLeft: "3px" }}>
              ●
            </span>
          )}
        </span>
      </Td>
      <Td>
        <VisibilityPill v={doc.visibility} />
      </Td>
      <Td>
        <div
          className="flex items-center gap-2"
          style={{ fontSize: "12.5px", color: "var(--color-ink-soft)", fontWeight: 500 }}
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
              fontSize: "10px",
            }}
          >
            {doc.uploaderInitials}
          </span>
          <span className="truncate">{doc.uploaderName}</span>
        </div>
      </Td>
      <Td>
        <span
          className="font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-muted)",
            letterSpacing: "0.04em",
          }}
        >
          {doc.ageDays === 0
            ? t("table.today")
            : doc.ageDays < 7
              ? t("table.daysAgo", { n: doc.ageDays.toString() })
              : new Date(doc.updatedAt).toLocaleDateString("hu-HU", {
                  month: "short",
                  day: "numeric",
                })}
        </span>
      </Td>
      <Td align="right">
        <span style={{ color: "var(--color-muted)", fontSize: "16px" }}>⋯</span>
      </Td>
    </tr>
  );
}

function Td({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      style={{
        padding: "14px 18px",
        borderBottom:
          "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
        fontSize: "13px",
        verticalAlign: "middle",
        textAlign: align ?? "left",
      }}
    >
      {children}
    </td>
  );
}

function VisibilityPill({ v }: { v: "PUBLIC" | "BOARD_ONLY" | "ADMIN_ONLY" }) {
  const t = useTranslations("documents");
  const tone = {
    PUBLIC: { bg: "var(--color-good-soft)", color: "var(--color-good)" },
    BOARD_ONLY: {
      bg: "color-mix(in srgb, #3a5a78 22%, transparent)",
      color: "#3a5a78",
    },
    ADMIN_ONLY: {
      bg: "color-mix(in srgb, var(--color-ink) 10%, transparent)",
      color: "var(--color-ink-soft)",
    },
  }[v];
  return (
    <span
      className="font-mono"
      style={{
        fontSize: "10px",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: "999px",
        fontWeight: 700,
        background: tone.bg,
        color: tone.color,
        whiteSpace: "nowrap",
      }}
    >
      {t(`visibility.${v}`)}
    </span>
  );
}

function bgForFileType(
  ft: "pdf" | "doc" | "xls" | "img" | "other",
  hero: boolean,
): string {
  const intensity = hero ? "90%" : "18%";
  const colorVar = {
    pdf: "var(--color-danger)",
    doc: "#3a5a78",
    xls: "var(--color-good)",
    img: "var(--color-ochre)",
    other: "var(--color-muted)",
  }[ft];
  if (hero) {
    return colorVar === "var(--color-muted)"
      ? "var(--color-ink)"
      : `color-mix(in srgb, ${colorVar} ${intensity}, white)`;
  }
  return `color-mix(in srgb, ${colorVar} ${intensity}, transparent)`;
}

function colorForFileType(ft: "pdf" | "doc" | "xls" | "img" | "other"): string {
  return {
    pdf: "var(--color-danger)",
    doc: "#3a5a78",
    xls: "var(--color-good)",
    img: "color-mix(in srgb, var(--color-ochre) 75%, var(--color-ink))",
    other: "var(--color-muted)",
  }[ft];
}

// ─── Version panel ───────────────────────────────────────────────────────

function VersionPanel({
  documentId,
  panel,
  loading,
}: {
  documentId: string | null;
  panel: VersionPanelData | null;
  loading: boolean;
}) {
  const t = useTranslations("documents");
  const router = useRouter();

  if (!documentId || !panel || loading) {
    return (
      <aside
        style={{
          background: "var(--color-card)",
          border:
            "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
          borderRadius: "14px",
          padding: "48px 22px",
          textAlign: "center",
          color: "var(--color-muted)",
          fontSize: "13px",
          position: "sticky",
          top: "24px",
        }}
      >
        {loading ? t("panel.loading") : t("panel.empty")}
      </aside>
    );
  }

  async function togglePin() {
    if (!panel) return;
    try {
      const res = await fetch(`/api/documents/${panel.document.id}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !panel.document.isPinned }),
      });
      if (!res.ok) throw new Error("pin failed");
      toast.success(
        panel.document.isPinned ? t("panel.unpinned") : t("panel.pinned"),
      );
      router.refresh();
    } catch {
      toast.error(t("errors.pinFailed"));
    }
  }

  return (
    <aside
      style={{
        background: "var(--color-card)",
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "14px",
        padding: 0,
        position: "sticky",
        top: "24px",
        overflow: "hidden",
      }}
    >
      <div
        className="flex justify-between items-start gap-2.5"
        style={{
          padding: "18px 20px",
          borderBottom:
            "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
        }}
      >
        <div className="min-w-0">
          <h4
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "-0.015em",
              marginBottom: "4px",
            }}
          >
            {t("panel.title")}
          </h4>
          <div
            className="truncate"
            style={{
              fontSize: "12px",
              color: "var(--color-ink-soft)",
              fontWeight: 500,
            }}
          >
            {panel.document.title}
          </div>
        </div>
        {panel.isBoardPlus && (
          <button
            type="button"
            onClick={togglePin}
            className="font-mono"
            style={{
              fontSize: "10px",
              padding: "3px 8px",
              borderRadius: "5px",
              background: panel.document.isPinned
                ? "var(--color-ochre)"
                : "var(--color-bg-3)",
              color: panel.document.isPinned
                ? "var(--color-ink)"
                : "var(--color-ink-soft)",
              border: panel.document.isPinned
                ? "1px solid var(--color-ochre)"
                : "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
              cursor: "pointer",
              letterSpacing: "0.04em",
              fontWeight: 600,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {panel.document.isPinned ? "★ " + t("panel.unpinCta") : t("panel.pinCta")}
          </button>
        )}
      </div>

      <div
        style={{
          padding: "16px 20px 18px",
          borderBottom:
            "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          background: "var(--color-bg-3)",
        }}
      >
        <PreviewPage />
        {panel.versions[0] && (
          <div
            className="flex justify-between font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
              padding: "8px 0 0",
            }}
          >
            <span>{panel.versions[0].fileName}</span>
            <span>
              <b style={{ color: "var(--color-ink)", fontWeight: 600 }}>
                {formatBytes(panel.versions[0].fileSize)}
              </b>
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: "16px 20px 20px", position: "relative" }}>
        {panel.versions.map((v, i) => (
          <VersionEntry
            key={v.id}
            version={v}
            isCurrent={i === 0}
            isLast={i === panel.versions.length - 1}
          />
        ))}
      </div>

      <div
        style={{
          padding: "14px 20px",
          borderTop:
            "1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)",
          background: "var(--color-bg-3)",
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
          {t("panel.audit")}
        </div>
        <div
          style={{
            fontSize: "12.5px",
            color: "var(--color-ink-soft)",
            marginBottom: "10px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontWeight: 600,
              color: "var(--color-ink)",
              fontSize: "14px",
            }}
          >
            {panel.boardCount}
          </span>{" "}
          {t("panel.boardMembers")}
          {panel.externalCount > 0 && (
            <>
              {" · "}
              <span
                style={{
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  fontWeight: 600,
                  color: "var(--color-ink)",
                  fontSize: "14px",
                }}
              >
                {panel.externalCount}
              </span>{" "}
              {t("panel.externalParties")}
            </>
          )}
        </div>
        <AuditLine label={t("panel.viewed")} value={`${panel.viewCount} ×`} />
        <AuditLine
          label={t("panel.downloaded")}
          value={`${panel.downloadCount} ×`}
        />
        {panel.lastAccessedAt && (
          <AuditLine
            label={t("panel.lastAccess")}
            value={new Date(panel.lastAccessedAt).toLocaleString("hu-HU", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
        )}
      </div>
    </aside>
  );
}

function PreviewPage() {
  return (
    <div
      style={{
        aspectRatio: "3 / 4",
        background: "#fff",
        border: "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)",
        borderRadius: "4px",
        padding: "14px",
        margin: "0 auto 12px",
        maxWidth: "180px",
        overflow: "hidden",
      }}
    >
      {[
        { kind: "t" as const, w: "70%" },
        { kind: "" as const, w: "100%" },
        { kind: "" as const, w: "90%" },
        { kind: "" as const, w: "65%" },
        { kind: "h" as const, w: "50%" },
        { kind: "" as const, w: "100%" },
        { kind: "" as const, w: "90%" },
        { kind: "" as const, w: "65%" },
      ].map((row, i) => (
        <i
          key={i}
          style={{
            display: "block",
            height: row.kind === "t" ? "5px" : "3px",
            background:
              row.kind === "t"
                ? "color-mix(in srgb, var(--color-ink) 40%, transparent)"
                : row.kind === "h"
                  ? "color-mix(in srgb, var(--color-ink) 25%, transparent)"
                  : "color-mix(in srgb, var(--color-ink) 10%, transparent)",
            borderRadius: "1px",
            width: row.w,
            marginBottom: "5px",
            marginTop: row.kind === "h" ? "8px" : "0",
          }}
        />
      ))}
    </div>
  );
}

function VersionEntry({
  version,
  isCurrent,
  isLast,
}: {
  version: { versionNumber: number; uploadedAt: string; uploaderInitials: string; uploaderName: string };
  isCurrent: boolean;
  isLast: boolean;
}) {
  const t = useTranslations("documents");
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: "16px 1fr",
        gap: "12px",
        padding: "10px 0 12px",
        position: "relative",
      }}
    >
      <span
        aria-hidden
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: isCurrent
            ? "var(--color-ochre)"
            : "color-mix(in srgb, var(--color-ink) 25%, transparent)",
          margin: "5px 0 0 3px",
          boxShadow: isCurrent
            ? "0 0 0 1px var(--color-ochre), 0 0 0 5px color-mix(in srgb, var(--color-ochre) 20%, transparent)"
            : "none",
          position: "relative",
          zIndex: 1,
        }}
      />
      {!isLast && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "8px",
            top: "20px",
            bottom: "-3px",
            width: "1px",
            background:
              "color-mix(in srgb, var(--color-ink) 10%, transparent)",
            zIndex: 0,
          }}
        />
      )}
      <div>
        <div className="flex justify-between items-baseline">
          <b
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            v{version.versionNumber}
            {isCurrent && (
              <span
                style={{
                  color: "var(--color-ochre)",
                  fontWeight: 500,
                  marginLeft: "5px",
                }}
              >
                · {t("panel.current")}
              </span>
            )}
          </b>
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
            }}
          >
            {new Date(version.uploadedAt).toLocaleDateString("hu-HU", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <div
          className="flex items-center gap-2"
          style={{ marginTop: "4px" }}
        >
          <span
            className="grid place-items-center"
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "var(--color-ochre)",
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "9px",
              fontWeight: 600,
              color: "var(--color-ink)",
            }}
          >
            {version.uploaderInitials}
          </span>
          <span
            style={{
              fontSize: "11.5px",
              color: "var(--color-ink-soft)",
              fontWeight: 500,
            }}
          >
            {version.uploaderName}
          </span>
        </div>
      </div>
    </div>
  );
}

function AuditLine({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex justify-between font-mono"
      style={{
        fontSize: "10px",
        color: "var(--color-muted)",
        letterSpacing: "0.04em",
        padding: "4px 0",
      }}
    >
      <span>{label}</span>
      <b style={{ color: "var(--color-ink)", fontWeight: 600 }}>{value}</b>
    </div>
  );
}

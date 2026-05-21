import { mkdir, writeFile, unlink, stat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Server-side file storage abstraction.
 *
 * Today: a local-filesystem driver that writes under `<repo>/uploads/`.
 * Tomorrow: drop in a Cloudflare R2 driver (S3-compatible). The wire
 * format the rest of the app sees is unchanged — every uploader gets
 * back a URL that resolves; every reader hits the URL via Next.js. The
 * R2 driver will return presigned-PUT/GET URLs; the local driver
 * returns paths into our own `/api/files` route.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_SCOPES = [
  "document",
  "document-version",
  "complaint-photo",
  "message-attachment",
  "report",
  "contractor-document",
  "marketplace-invoice",
] as const;
export type StorageScope = (typeof ALLOWED_SCOPES)[number];

export interface StoredFileMeta {
  /** Stable storage key, e.g. "document/abc123-meeting-minutes.pdf". */
  key: string;
  /** URL the app stores + renders. */
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface StorageDriver {
  /**
   * Persist a buffer under `scope/<random>-<sanitized-filename>` and
   * return the URL the rest of the app should store and render.
   */
  put(args: {
    scope: StorageScope;
    fileName: string;
    mimeType: string;
    body: Buffer;
  }): Promise<StoredFileMeta>;

  /** Stream + headers for a GET, used by the local serve route. */
  read(key: string): Promise<{
    body: Buffer | NodeJS.ReadableStream;
    contentType: string;
    contentLength: number;
  }>;

  /** Best-effort delete; no-op if the key is unknown. */
  remove(key: string): Promise<void>;
}

// ─── Local filesystem driver ────────────────────────────────────────────

const REPO_ROOT = process.cwd();
const UPLOAD_ROOT = path.join(REPO_ROOT, "uploads");

function sanitizeFileName(name: string): string {
  // Strip directory traversal + non-printable chars + collapse repeats.
  const stem = name.normalize("NFKD").replace(/[^\w.\-+]+/g, "_").slice(0, 80);
  return stem || "file";
}

function isUnderUploadRoot(absPath: string): boolean {
  const rel = path.relative(UPLOAD_ROOT, absPath);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

class LocalFilesystemDriver implements StorageDriver {
  async put({
    scope,
    fileName,
    mimeType,
    body,
  }: {
    scope: StorageScope;
    fileName: string;
    mimeType: string;
    body: Buffer;
  }): Promise<StoredFileMeta> {
    const safeName = sanitizeFileName(fileName);
    const id = randomBytes(8).toString("hex");
    const key = `${scope}/${id}-${safeName}`;
    const abs = path.join(UPLOAD_ROOT, key);

    if (!isUnderUploadRoot(abs)) {
      throw new Error("Resolved path is outside uploads root");
    }

    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, body);

    return {
      key,
      url: `/api/files/${key}`,
      fileName,
      fileSize: body.length,
      mimeType,
    };
  }

  async read(key: string): Promise<{
    body: Buffer | NodeJS.ReadableStream;
    contentType: string;
    contentLength: number;
  }> {
    const abs = path.join(UPLOAD_ROOT, key);
    if (!isUnderUploadRoot(abs)) {
      throw new Error("Path traversal blocked");
    }
    if (!existsSync(abs)) {
      throw new Error("File not found");
    }
    // Read into a Buffer rather than streaming — our reports are tiny
    // (single-digit KB) and the round-trip is dominated by network /
    // browser, so the simpler caller path wins. The interface still
    // exposes the union type for an eventual R2 driver that may stream.
    const body = await readFile(abs);
    return {
      body,
      contentType: guessContentType(key),
      contentLength: body.length,
    };
  }

  async remove(key: string): Promise<void> {
    const abs = path.join(UPLOAD_ROOT, key);
    if (!isUnderUploadRoot(abs)) return;
    if (!existsSync(abs)) return;
    await unlink(abs);
  }
}

function guessContentType(key: string): string {
  const ext = path.extname(key).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".xls":
      return "application/vnd.ms-excel";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

// ─── Singleton selection ─────────────────────────────────────────────────

let _driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (!_driver) {
    // Future: switch on STORAGE_DRIVER env var → R2/S3/Vercel Blob.
    _driver = new LocalFilesystemDriver();
  }
  return _driver;
}

// Expose helpers for tests / migrations that need direct disk access.
export const _testing = { sanitizeFileName, isUnderUploadRoot, readFile };

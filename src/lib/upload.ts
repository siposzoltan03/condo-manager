/**
 * Client-side helper for uploading a single file to the storage backend.
 *
 * Throws on validation / network / server errors so callers can `try/catch`
 * and surface a toast.
 */

export type ClientStorageScope =
  | "document"
  | "document-version"
  | "complaint-photo"
  | "message-attachment";

export interface UploadedFile {
  /** URL the rest of the app should store and render. */
  url: string;
  /** Stable storage key — keep alongside url for future deletes. */
  key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export const CLIENT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function uploadFile(
  file: File,
  scope: ClientStorageScope,
): Promise<UploadedFile> {
  if (file.size === 0) {
    throw new Error("Empty file");
  }
  if (file.size > CLIENT_MAX_UPLOAD_BYTES) {
    throw new Error(
      `Max file size: ${Math.round(CLIENT_MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
    );
  }

  const fd = new FormData();
  fd.append("file", file);
  fd.append("scope", scope);

  const res = await fetch("/api/files/upload", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Upload failed (${res.status})`);
  }
  return (await res.json()) as UploadedFile;
}

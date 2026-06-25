import {
  renderToBuffer as pdfRenderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";

/**
 * Render a `@react-pdf/renderer` document tree to a Node Buffer.
 *
 * Wrapper exists so the rest of the app imports a stable name regardless
 * of the underlying renderer's API churn (the package's API has shifted
 * between v3 and v4).
 */
export async function renderToBuffer(
  document: ReactElement<DocumentProps>,
): Promise<Buffer> {
  return pdfRenderToBuffer(document);
}

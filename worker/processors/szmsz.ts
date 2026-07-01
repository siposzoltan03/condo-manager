import type { Job } from "bullmq";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { getStorage } from "../../src/lib/storage";
import { extractSzmszFromPdf } from "../../src/lib/szmsz-extract";

/**
 * Background SZMSZ AI extraction. Reads the uploaded PDF from storage, runs the
 * OpenAI extraction, and writes the result onto the SzmszExtractionJob row so
 * the client (polling) can pick it up. Long-running (tens of seconds+).
 */
export async function processSzmszJob(job: Job): Promise<void> {
  const jobId = job.data?.jobId as string | undefined;
  if (!jobId) return;

  const rec = await prisma.szmszExtractionJob.findUnique({ where: { id: jobId } });
  if (!rec || rec.status === "READY") return;

  await prisma.szmszExtractionJob.update({
    where: { id: jobId },
    data: { status: "RUNNING" },
  });

  try {
    const { body } = await getStorage().read(rec.storageKey);
    const buffer = Buffer.isBuffer(body) ? body : await streamToBuffer(body);
    const extraction = await extractSzmszFromPdf(buffer.toString("base64"), rec.fileName);

    await prisma.szmszExtractionJob.update({
      where: { id: jobId },
      data: {
        status: "READY",
        result: extraction as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.szmszExtractionJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: e instanceof Error ? e.message : String(e),
        finishedAt: new Date(),
      },
    });
    throw e; // let BullMQ record the failure
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

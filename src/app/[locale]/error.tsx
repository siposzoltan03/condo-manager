"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm border border-[#c4c6cf]/20">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#ffdad6]">
          <AlertTriangle className="h-6 w-6 text-[#93000a]" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-[#131b2e]">
          {t("error")}
        </h2>
        <p className="mb-6 text-sm text-[#515f74]">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-[#002045] px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-all"
        >
          <RotateCcw className="h-4 w-4" />
          {t("retry")}
        </button>
      </div>
    </div>
  );
}

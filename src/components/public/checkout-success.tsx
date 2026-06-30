"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { PublicNav } from "./public-nav";

type VerifyResult = {
  email?: string;
  planName?: string;
};

export function CheckoutSuccess() {
  const t = useTranslations("checkout");
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [result, setResult] = useState<VerifyResult>({});

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    fetch("/api/stripe/verify-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setResult({
            email: data.email,
            planName: data.planName,
          });
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        setStatus("error");
      });
  }, [sessionId]);

  function handleRetry() {
    if (!sessionId) return;
    setStatus("loading");
    fetch("/api/stripe/verify-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setResult({ email: data.email, planName: data.planName });
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }

  return (
    <div className="min-h-screen bg-bg-3">
      <PublicNav />

      <div className="mx-auto max-w-lg px-4 py-20 sm:px-6">
        {status === "loading" && (
          <div className="rounded-xl border border-tile-a bg-card p-10 text-center shadow-sm">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-moss" />
            <p className="mt-4 text-sm font-medium text-ink-soft">{t("verifying")}</p>
          </div>
        )}

        {status === "success" && (
          <div className="rounded-xl border border-tile-a bg-card p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-good/15">
              <CheckCircle2 className="h-8 w-8 text-good" />
            </div>
            <h1 className="mt-6 text-2xl font-extrabold text-ink">
              {t("successTitle")}
            </h1>
            <p className="mt-2 text-sm text-ink-soft">{t("successMessage")}</p>

            {result.planName && (
              <div className="mt-4 inline-block rounded-full bg-moss/10 px-4 py-1">
                <span className="text-sm font-semibold text-moss">
                  {result.planName}
                </span>
              </div>
            )}

            <div className="mt-6 rounded-lg bg-bg-3 p-4 text-left">
              <p className="text-sm text-ink-soft">{t("checkEmail")}</p>
              {result.email && (
                <p className="mt-2 text-sm text-ink-soft">
                  {t("emailSentTo", { email: result.email })}
                </p>
              )}
            </div>

            <div className="mt-8">
              <Link
                href="/login"
                className="inline-block rounded-lg bg-moss px-6 py-3 text-sm font-semibold text-card transition hover:opacity-90"
              >
                {t("goToLogin")}
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl border border-tile-a bg-card p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger/15">
              <AlertCircle className="h-8 w-8 text-danger" />
            </div>
            <h1 className="mt-6 text-2xl font-extrabold text-ink">
              {t("errorTitle")}
            </h1>
            <p className="mt-2 text-sm text-ink-soft">{t("errorMessage")}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {sessionId && (
                <button
                  onClick={handleRetry}
                  className="rounded-lg bg-moss px-6 py-3 text-sm font-semibold text-card transition hover:opacity-90"
                >
                  {t("retry")}
                </button>
              )}
              <a
                href="mailto:support@condomanager.com"
                className="rounded-lg border border-tile-a px-6 py-3 text-sm font-semibold text-ink-soft transition hover:bg-bg-3"
              >
                {t("contactSupport")}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
    <div className="min-h-screen bg-slate-50">
      <PublicNav />

      <div className="mx-auto max-w-lg px-4 py-20 sm:px-6">
        {status === "loading" && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#002045]" />
            <p className="mt-4 text-sm font-medium text-slate-600">{t("verifying")}</p>
          </div>
        )}

        {status === "success" && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="mt-6 text-2xl font-extrabold text-slate-900">
              {t("successTitle")}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{t("successMessage")}</p>

            {result.planName && (
              <div className="mt-4 inline-block rounded-full bg-[#002045]/10 px-4 py-1">
                <span className="text-sm font-semibold text-[#002045]">
                  {result.planName}
                </span>
              </div>
            )}

            <div className="mt-6 rounded-lg bg-slate-50 p-4 text-left">
              <p className="text-sm text-slate-700">{t("checkEmail")}</p>
              {result.email && (
                <p className="mt-2 text-sm text-slate-600">
                  {t("emailSentTo", { email: result.email })}
                </p>
              )}
            </div>

            <div className="mt-8">
              <Link
                href="/login"
                className="inline-block rounded-lg bg-[#002045] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#003060]"
              >
                {t("goToLogin")}
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="mt-6 text-2xl font-extrabold text-slate-900">
              {t("errorTitle")}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{t("errorMessage")}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {sessionId && (
                <button
                  onClick={handleRetry}
                  className="rounded-lg bg-[#002045] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#003060]"
                >
                  {t("retry")}
                </button>
              )}
              <a
                href="mailto:support@condomanager.com"
                className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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

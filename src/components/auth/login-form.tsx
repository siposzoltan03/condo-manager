"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, Lock, Loader2 } from "lucide-react";
import Link from "next/link";

export function LoginForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t("invalidCredentials"));
      } else {
        const callbackUrl = searchParams.get("callbackUrl") ?? "/";
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Email field */}
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-semibold uppercase tracking-wider"
          style={{ color: "#43474e" }}
        >
          {tCommon("email")} address
        </label>
        <div className="relative mt-2">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full rounded-lg border border-transparent py-4 px-5 pr-12 text-sm outline-none transition-colors focus:border-[#002045] focus:ring-1 focus:ring-[#002045]"
            style={{ backgroundColor: "#f2f3ff", color: "#131b2e" }}
            placeholder="you@example.com"
          />
          <Mail
            className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5"
            style={{ color: "#43474e" }}
          />
        </div>
      </div>

      {/* Password field */}
      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#43474e" }}
          >
            {tCommon("password")}
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium hover:underline"
            style={{ color: "#515f74" }}
          >
            {t("forgotPassword")}?
          </Link>
        </div>
        <div className="relative mt-2">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full rounded-lg border border-transparent py-4 px-5 pr-12 text-sm outline-none transition-colors focus:border-[#002045] focus:ring-1 focus:ring-[#002045]"
            style={{ backgroundColor: "#f2f3ff", color: "#131b2e" }}
            placeholder="••••••••"
          />
          <Lock
            className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5"
            style={{ color: "#43474e" }}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center rounded-lg py-4 text-sm font-bold text-white shadow transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: "#002045" }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          t("signIn")
        )}
      </button>
    </form>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, Lock, User, Building2, MapPin, Loader2, AlertTriangle } from "lucide-react";

interface InvitationData {
  email: string;
  type: "ADMIN_SETUP" | "USER_INVITE";
  role: string | null;
  buildingName: string | null;
  unitNumber: string | null;
}

interface Props {
  token: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  BOARD_MEMBER: "bg-blue-100 text-blue-700",
  RESIDENT: "bg-green-100 text-green-700",
  TENANT: "bg-slate-100 text-slate-700",
};

export function AcceptInvitationForm({ token }: Props) {
  const t = useTranslations("invitation");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [errorState, setErrorState] = useState<{
    type: "invalid" | "expired" | "revoked" | "accepted";
    message: string;
    invitationType?: string;
  } | null>(null);
  const [formError, setFormError] = useState("");

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [buildingAddress, setBuildingAddress] = useState("");
  const [buildingCity, setBuildingCity] = useState("");
  const [buildingZipCode, setBuildingZipCode] = useState("");

  useEffect(() => {
    async function validate() {
      try {
        const res = await fetch(`/api/invitations/by-token/${token}/validate`);
        if (res.status === 404) {
          setErrorState({ type: "invalid", message: t("invalidToken") });
          return;
        }
        if (res.status === 410) {
          const data = await res.json();
          const status = data.status as string;
          if (status === "ACCEPTED") {
            setErrorState({ type: "accepted", message: t("alreadyAccepted") });
          } else if (status === "REVOKED") {
            setErrorState({ type: "revoked", message: t("revoked") });
          } else {
            setErrorState({
              type: "expired",
              message: t("expired"),
              invitationType: data.type,
            });
          }
          return;
        }
        if (!res.ok) {
          setErrorState({ type: "invalid", message: t("invalidToken") });
          return;
        }
        const data: InvitationData = await res.json();
        setInvitation(data);
      } catch {
        setErrorState({ type: "invalid", message: tCommon("error") });
      } finally {
        setLoading(false);
      }
    }
    validate();
  }, [token, t, tCommon]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (password.length < 8) {
      setFormError(t("passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setFormError(t("passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, string> = { name, password };
      if (invitation?.type === "ADMIN_SETUP") {
        body.buildingName = buildingName;
        body.buildingAddress = buildingAddress;
        body.buildingCity = buildingCity;
        body.buildingZipCode = buildingZipCode;
      }

      const res = await fetch(`/api/invitations/by-token/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || tCommon("error"));
        return;
      }

      router.push(`/login?message=${encodeURIComponent(t("successMessage"))}`);
    } catch {
      setFormError(tCommon("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-10 shadow-xl flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  if (errorState) {
    return (
      <div className="rounded-xl bg-white p-10 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 mb-4">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <h1
            className="text-2xl font-extrabold mb-2"
            style={{ color: "#002045", fontFamily: "Manrope, sans-serif" }}
          >
            {errorState.type === "expired" ? t("expiredTitle") : t("invalidTitle")}
          </h1>
          <p className="text-sm mb-4" style={{ color: "#43474e" }}>
            {errorState.message}
          </p>
          {errorState.type === "expired" && (
            <p className="text-xs" style={{ color: "#515f74" }}>
              {errorState.invitationType === "ADMIN_SETUP"
                ? t("expiredAdminMessage")
                : t("expiredUserMessage")}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!invitation) return null;

  const roleLabel = invitation.role
    ? invitation.role.replace("_", " ")
    : null;
  const roleColor = invitation.role
    ? ROLE_COLORS[invitation.role] ?? "bg-slate-100 text-slate-700"
    : null;

  return (
    <div className="rounded-xl bg-white p-10 shadow-xl">
      <div className="mb-8">
        <h1
          className="text-3xl font-extrabold"
          style={{ color: "#002045", fontFamily: "Manrope, sans-serif" }}
        >
          {t("acceptTitle")}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#43474e" }}>
          {invitation.type === "ADMIN_SETUP"
            ? t("acceptAdminDesc")
            : t("acceptUserDesc")}
        </p>
        {invitation.buildingName && (
          <p className="mt-1 text-sm font-medium" style={{ color: "#002045" }}>
            {invitation.buildingName}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        {/* Email (read-only) */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#43474e" }}
          >
            {tCommon("email")}
          </label>
          <div className="relative mt-2">
            <input
              type="email"
              value={invitation.email}
              readOnly
              className="block w-full rounded-lg border border-transparent py-4 px-5 pr-12 text-sm outline-none cursor-not-allowed opacity-70"
              style={{ backgroundColor: "#f2f3ff", color: "#131b2e" }}
            />
            <Mail
              className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5"
              style={{ color: "#43474e" }}
            />
          </div>
        </div>

        {/* Role badge */}
        {roleLabel && (
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "#43474e" }}
            >
              {t("roleLabel")}
            </label>
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${roleColor}`}>
              {roleLabel}
            </span>
            {invitation.unitNumber && (
              <span className="ml-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Unit {invitation.unitNumber}
              </span>
            )}
          </div>
        )}

        {/* Name */}
        <div>
          <label
            htmlFor="name"
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#43474e" }}
          >
            {t("nameLabel")}
          </label>
          <div className="relative mt-2">
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-lg border border-transparent py-4 px-5 pr-12 text-sm outline-none transition-colors focus:border-[#002045] focus:ring-1 focus:ring-[#002045]"
              style={{ backgroundColor: "#f2f3ff", color: "#131b2e" }}
              placeholder={t("namePlaceholder")}
            />
            <User
              className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5"
              style={{ color: "#43474e" }}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#43474e" }}
          >
            {t("passwordLabel")}
          </label>
          <div className="relative mt-2">
            <input
              id="password"
              type="password"
              required
              minLength={8}
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

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#43474e" }}
          >
            {t("confirmPasswordLabel")}
          </label>
          <div className="relative mt-2">
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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

        {/* ADMIN_SETUP: Building fields */}
        {invitation.type === "ADMIN_SETUP" && (
          <>
            <div className="border-t pt-5 mt-5" style={{ borderColor: "#c4c6cf" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#43474e" }}>
                {t("buildingDetails")}
              </p>
            </div>

            <div>
              <label
                htmlFor="buildingName"
                className="block text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#43474e" }}
              >
                {t("buildingNameLabel")}
              </label>
              <div className="relative mt-2">
                <input
                  id="buildingName"
                  type="text"
                  required
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  className="block w-full rounded-lg border border-transparent py-4 px-5 pr-12 text-sm outline-none transition-colors focus:border-[#002045] focus:ring-1 focus:ring-[#002045]"
                  style={{ backgroundColor: "#f2f3ff", color: "#131b2e" }}
                  placeholder={t("buildingNamePlaceholder")}
                />
                <Building2
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5"
                  style={{ color: "#43474e" }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="buildingAddress"
                className="block text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#43474e" }}
              >
                {t("buildingAddressLabel")}
              </label>
              <div className="relative mt-2">
                <input
                  id="buildingAddress"
                  type="text"
                  required
                  value={buildingAddress}
                  onChange={(e) => setBuildingAddress(e.target.value)}
                  className="block w-full rounded-lg border border-transparent py-4 px-5 pr-12 text-sm outline-none transition-colors focus:border-[#002045] focus:ring-1 focus:ring-[#002045]"
                  style={{ backgroundColor: "#f2f3ff", color: "#131b2e" }}
                  placeholder={t("buildingAddressPlaceholder")}
                />
                <MapPin
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5"
                  style={{ color: "#43474e" }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="buildingCity"
                  className="block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#43474e" }}
                >
                  {t("buildingCityLabel")}
                </label>
                <input
                  id="buildingCity"
                  type="text"
                  required
                  value={buildingCity}
                  onChange={(e) => setBuildingCity(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-transparent py-4 px-5 text-sm outline-none transition-colors focus:border-[#002045] focus:ring-1 focus:ring-[#002045]"
                  style={{ backgroundColor: "#f2f3ff", color: "#131b2e" }}
                  placeholder={t("buildingCityPlaceholder")}
                />
              </div>
              <div>
                <label
                  htmlFor="buildingZipCode"
                  className="block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#43474e" }}
                >
                  {t("buildingZipCodeLabel")}
                </label>
                <input
                  id="buildingZipCode"
                  type="text"
                  required
                  value={buildingZipCode}
                  onChange={(e) => setBuildingZipCode(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-transparent py-4 px-5 text-sm outline-none transition-colors focus:border-[#002045] focus:ring-1 focus:ring-[#002045]"
                  style={{ backgroundColor: "#f2f3ff", color: "#131b2e" }}
                  placeholder={t("buildingZipCodePlaceholder")}
                />
              </div>
            </div>
          </>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center rounded-lg py-4 text-sm font-bold text-white shadow transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: "#002045" }}
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            t("submitButton")
          )}
        </button>
      </form>
    </div>
  );
}

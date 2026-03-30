import { Suspense } from "react";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";
import { LoginLanguageSwitcher } from "@/components/auth/login-language-switcher";

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

export default async function AcceptInvitationPage({ params }: Props) {
  const { token } = await params;

  return (
    <div
      className="relative flex min-h-screen flex-col"
      style={{ backgroundColor: "#faf8ff" }}
    >
      {/* Mesh gradient background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 20%, rgba(0,32,69,0.08), transparent),
            radial-gradient(ellipse 60% 80% at 80% 80%, rgba(26,54,93,0.06), transparent),
            radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,32,69,0.03), transparent)
          `,
        }}
      />

      {/* Top bar: branding + language switcher */}
      <div className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white font-bold text-sm"
            style={{ backgroundColor: "#002045" }}
          >
            CM
          </div>
          <span
            className="text-xl font-extrabold"
            style={{ color: "#002045", fontFamily: "Manrope, sans-serif" }}
          >
            Condo Manager
          </span>
        </div>
        <LoginLanguageSwitcher />
      </div>

      {/* Centered card */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          <Suspense
            fallback={
              <div className="rounded-xl bg-white p-10 shadow-xl flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
              </div>
            }
          >
            <AcceptInvitationForm token={token} />
          </Suspense>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t py-5 px-8" style={{ borderColor: "#c4c6cf" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs" style={{ color: "#515f74" }}>
          <span>&copy; 2026 Condo Manager. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="#" className="hover:underline">
              Privacy Policy
            </a>
            <a href="#" className="hover:underline">
              Terms
            </a>
            <a href="#" className="hover:underline">
              Contact Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

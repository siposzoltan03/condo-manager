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
      style={{ backgroundColor: "var(--color-bg-3)" }}
    >
      {/* Mesh gradient background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 20%, color-mix(in srgb, var(--color-moss) 8%, transparent), transparent),
            radial-gradient(ellipse 60% 80% at 80% 80%, color-mix(in srgb, var(--color-moss) 6%, transparent), transparent),
            radial-gradient(ellipse 50% 50% at 50% 50%, color-mix(in srgb, var(--color-moss) 3%, transparent), transparent)
          `,
        }}
      />

      {/* Top bar: branding + language switcher */}
      <div className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-card font-bold text-sm"
            style={{ backgroundColor: "var(--color-moss)" }}
          >
            CM
          </div>
          <span
            className="text-xl font-extrabold font-display"
            style={{ color: "var(--color-moss)" }}
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
              <div className="rounded-xl bg-card p-10 shadow-xl flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-tile-a border-t-moss" />
              </div>
            }
          >
            <AcceptInvitationForm token={token} />
          </Suspense>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t py-5 px-8" style={{ borderColor: "var(--color-tile-a)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs" style={{ color: "var(--color-muted)" }}>
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

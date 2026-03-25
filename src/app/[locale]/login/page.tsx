import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { LoginLanguageSwitcher } from "@/components/auth/login-language-switcher";

export default function LoginPage() {
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

      {/* Architectural SVG illustration (very low opacity) */}
      <div className="pointer-events-none fixed inset-0 flex items-end justify-center overflow-hidden opacity-[0.07]">
        <svg
          viewBox="0 0 800 400"
          className="w-full max-w-4xl"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Building 1 */}
          <rect x="80" y="100" width="120" height="300" fill="#002045" />
          <rect x="95" y="120" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="130" y="120" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="165" y="120" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="95" y="170" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="130" y="170" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="165" y="170" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="95" y="220" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="130" y="220" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="165" y="220" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="95" y="270" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="130" y="270" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="165" y="270" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="95" y="320" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="130" y="320" width="25" height="30" rx="2" fill="#faf8ff" />
          <rect x="165" y="320" width="25" height="30" rx="2" fill="#faf8ff" />

          {/* Building 2 (taller) */}
          <rect x="240" y="40" width="140" height="360" fill="#1a365d" />
          <rect x="258" y="60" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="290" y="60" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="322" y="60" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="354" y="60" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="258" y="108" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="290" y="108" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="322" y="108" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="354" y="108" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="258" y="156" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="290" y="156" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="322" y="156" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="354" y="156" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="258" y="204" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="290" y="204" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="322" y="204" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="354" y="204" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="258" y="252" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="290" y="252" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="322" y="252" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="354" y="252" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="258" y="300" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="290" y="300" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="322" y="300" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="354" y="300" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="258" y="348" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="290" y="348" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="322" y="348" width="22" height="28" rx="2" fill="#faf8ff" />
          <rect x="354" y="348" width="22" height="28" rx="2" fill="#faf8ff" />

          {/* Building 3 */}
          <rect x="420" y="140" width="110" height="260" fill="#002045" />
          <rect x="435" y="160" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="465" y="160" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="495" y="160" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="435" y="206" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="465" y="206" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="495" y="206" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="435" y="252" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="465" y="252" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="495" y="252" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="435" y="298" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="465" y="298" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="495" y="298" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="435" y="344" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="465" y="344" width="20" height="26" rx="2" fill="#faf8ff" />
          <rect x="495" y="344" width="20" height="26" rx="2" fill="#faf8ff" />

          {/* Building 4 */}
          <rect x="570" y="80" width="130" height="320" fill="#1a365d" />
          <rect x="588" y="100" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="622" y="100" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="656" y="100" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="588" y="150" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="622" y="150" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="656" y="150" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="588" y="200" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="622" y="200" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="656" y="200" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="588" y="250" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="622" y="250" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="656" y="250" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="588" y="300" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="622" y="300" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="656" y="300" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="588" y="350" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="622" y="350" width="24" height="30" rx="2" fill="#faf8ff" />
          <rect x="656" y="350" width="24" height="30" rx="2" fill="#faf8ff" />
        </svg>
      </div>

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
          <div className="rounded-xl bg-white p-10 shadow-xl">
            <div className="mb-8">
              <h1
                className="text-3xl font-extrabold"
                style={{
                  color: "#002045",
                  fontFamily: "Manrope, sans-serif",
                }}
              >
                Resident Portal
              </h1>
              <p
                className="mt-2 text-sm"
                style={{ color: "#43474e" }}
              >
                Welcome back. Please enter your credentials to access your
                account.
              </p>
            </div>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
          <p
            className="mt-6 text-center text-sm"
            style={{ color: "#515f74" }}
          >
            Not a registered resident?{" "}
            <span className="font-medium" style={{ color: "#002045" }}>
              Contact your manager
            </span>
          </p>
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

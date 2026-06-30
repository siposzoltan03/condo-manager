"use client";

import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          style={{ backgroundColor: "var(--color-bg-3)" }}
        >
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-tile-a border-t-moss" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

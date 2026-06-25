import { Suspense } from "react";
import { ContractorAuthShell } from "@/components/contractor/contractor-auth-shell";
import { ContractorLoginForm } from "@/components/contractor/contractor-login-form";

export default function ContractorLoginPage() {
  return (
    <ContractorAuthShell mode="login">
      <Suspense>
        <ContractorLoginForm />
      </Suspense>
    </ContractorAuthShell>
  );
}

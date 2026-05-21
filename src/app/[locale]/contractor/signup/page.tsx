import { ContractorAuthShell } from "@/components/contractor/contractor-auth-shell";
import { ContractorSignupForm } from "@/components/contractor/contractor-signup-form";

export default function ContractorSignupPage() {
  return (
    <ContractorAuthShell mode="signup">
      <ContractorSignupForm />
    </ContractorAuthShell>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ContractorSettings } from "@/components/contractor/contractor-settings";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ContractorSettingsPage({ params }: PageProps) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user || session.user.kind !== "contractor") {
    redirect(`/${locale}/contractor/login`);
  }
  return <ContractorSettings locale={locale as "hu" | "en"} />;
}

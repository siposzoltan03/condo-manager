import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getInvitations } from "@/lib/dal";
import { InvitationList } from "@/components/settings/invitation-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "invitationManagement" });
  return { title: t("title") };
}

export default async function InvitationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getInvitations();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <InvitationList initialData={data} />
    </div>
  );
}

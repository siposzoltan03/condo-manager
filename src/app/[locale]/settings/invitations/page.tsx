import { setRequestLocale } from "next-intl/server";
import { InvitationList } from "@/components/settings/invitation-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function InvitationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <InvitationList />
    </div>
  );
}

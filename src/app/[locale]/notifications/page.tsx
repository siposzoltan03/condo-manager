import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getNotifications } from "@/lib/dal";
import { NotificationsPage } from "@/components/notifications/notifications-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return { title: t("notifications") };
}

export default async function NotificationsRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getNotifications();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <NotificationsPage initialData={data} />
    </div>
  );
}

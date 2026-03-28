import { setRequestLocale } from "next-intl/server";
import { NotificationsPage } from "@/components/notifications/notifications-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NotificationsRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <NotificationsPage />
    </div>
  );
}

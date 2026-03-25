import { setRequestLocale } from "next-intl/server";
import { AnnouncementList } from "@/components/announcements/announcement-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AnnouncementsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <AnnouncementList />
    </div>
  );
}

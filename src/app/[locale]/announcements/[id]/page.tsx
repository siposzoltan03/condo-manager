import { setRequestLocale } from "next-intl/server";
import { AnnouncementDetail } from "@/components/announcements/announcement-detail";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function AnnouncementDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <AnnouncementDetail announcementId={id} />
    </div>
  );
}

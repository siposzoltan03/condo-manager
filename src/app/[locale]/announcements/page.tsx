import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAnnouncements } from "@/lib/dal";
import { AnnouncementList } from "@/components/announcements/announcement-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "announcements" });
  return { title: t("title") };
}

export default async function AnnouncementsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getAnnouncements();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <AnnouncementList initialData={data} />
    </div>
  );
}

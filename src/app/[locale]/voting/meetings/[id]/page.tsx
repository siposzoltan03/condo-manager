import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getMeetingDetail } from "@/lib/dal";
import { MeetingDetail } from "@/components/voting/meeting-detail";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "voting" });
  return { title: t("meetingDetail") };
}

export default async function MeetingDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const meeting = await getMeetingDetail(id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <MeetingDetail meeting={meeting} />
    </div>
  );
}

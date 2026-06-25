import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getComplaintDetail } from "@/lib/dal";
import { ComplaintDetailView } from "@/components/complaints/complaint-detail-view";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "complaints.shell" });
  return { title: t("title") };
}

export default async function ComplaintDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const complaint = await getComplaintDetail(id);

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: "1200px", margin: "0 auto" }}>
      <ComplaintDetailView complaint={complaint} locale={locale} />
    </div>
  );
}

import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getComplaints } from "@/lib/dal";
import { ComplaintList } from "@/components/complaints/complaint-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "complaints" });
  return { title: t("title") };
}

export default async function ComplaintsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getComplaints();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ComplaintList initialData={data} />
    </div>
  );
}

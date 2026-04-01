import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getForum } from "@/lib/dal";
import { ForumPage } from "@/components/forum/forum-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "forum" });
  return { title: t("title") };
}

export default async function Forum({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getForum();

  return <ForumPage initialData={data} />;
}

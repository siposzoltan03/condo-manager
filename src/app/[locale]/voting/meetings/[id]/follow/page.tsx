import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getMeetingDetail } from "@/lib/dal";
import { requirePageContext } from "@/lib/page-guard";
import { AssemblyCompanion } from "@/components/voting/assembly-companion";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "assembly" });
  return { title: t("companionTitle") };
}

/**
 * Companion follower view for owners — follows the live assembly and lets
 * them vote from their phone. Any building member (no board gate).
 */
export default async function AssemblyFollowPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  await requirePageContext();
  const meeting = await getMeetingDetail(id);

  return <AssemblyCompanion meeting={meeting} locale={locale} />;
}

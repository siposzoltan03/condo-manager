import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getVotes } from "@/lib/dal";
import { VotingPage } from "@/components/voting/voting-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "voting" });
  return { title: t("title") };
}

export default async function VotingPageRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getVotes();

  return <VotingPage initialVotes={data} />;
}

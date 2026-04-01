import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { MessagesPage } from "@/components/messages/messages-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "messages" });
  return { title: t("title") };
}

export default async function Messages({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <MessagesPage />;
}

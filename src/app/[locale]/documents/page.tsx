import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getDocuments } from "@/lib/dal";
import { DocumentsPage } from "@/components/documents/documents-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "documents" });
  return { title: t("title") };
}

export default async function DocumentsRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getDocuments();

  return <DocumentsPage initialData={data} />;
}

import { setRequestLocale } from "next-intl/server";
import { DocumentsPage } from "@/components/documents/documents-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DocumentsRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <DocumentsPage />;
}

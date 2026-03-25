import { setRequestLocale } from "next-intl/server";
import { ForumPage } from "@/components/forum/forum-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Forum({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ForumPage />;
}

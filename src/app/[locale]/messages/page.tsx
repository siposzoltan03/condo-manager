import { setRequestLocale } from "next-intl/server";
import { MessagesPage } from "@/components/messages/messages-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Messages({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <MessagesPage />;
}

import { setRequestLocale } from "next-intl/server";
import { TopicDetail } from "@/components/forum/topic-detail";

type Props = {
  params: Promise<{ locale: string; topicId: string }>;
};

export default async function TopicPage({ params }: Props) {
  const { locale, topicId } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <TopicDetail topicId={topicId} />
    </div>
  );
}

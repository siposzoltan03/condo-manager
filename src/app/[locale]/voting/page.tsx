import { setRequestLocale } from "next-intl/server";
import { VotingPage } from "@/components/voting/voting-page";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function VotingPageRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <VotingPage />
    </div>
  );
}

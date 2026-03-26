import { setRequestLocale } from "next-intl/server";
import { ComplaintDetail } from "@/components/complaints/complaint-detail";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function ComplaintDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ComplaintDetail complaintId={id} />
    </div>
  );
}

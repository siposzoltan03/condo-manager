import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * Legacy route — the building workspace lives inside `/finance` as the
 * "Épület" tab now. Existing bookmarks land cleanly via this redirect.
 */
export default async function BuildingFinanceRedirect({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/finance?tab=epulet`);
}

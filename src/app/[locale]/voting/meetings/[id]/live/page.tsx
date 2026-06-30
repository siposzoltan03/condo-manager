import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getMeetingDetail } from "@/lib/dal";
import { requirePageContext, requirePageCapability } from "@/lib/page-guard";
import { AssemblyPresenter } from "@/components/voting/assembly-presenter";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "assembly" });
  return { title: t("presenterTitle") };
}

/**
 * Presenter (kiosk) for live assembly mode — board-gated (vote.start).
 */
export default async function AssemblyLivePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const ctx = await requirePageContext();
  requirePageCapability(ctx, "vote.start");

  const meeting = await getMeetingDetail(id);

  return <AssemblyPresenter meeting={meeting} locale={locale} />;
}

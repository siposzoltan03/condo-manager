import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  getCommunicationOverview,
  getChannelDetail,
  countActiveBuildingMembers,
} from "@/lib/communication-dal";
import { requireBuildingContext } from "@/lib/auth";
import { CommunicationShell } from "@/components/communication/communication-shell";
import { CommunicationExplorer } from "@/components/communication/communication-explorer";
import { EmergencyButton } from "@/components/communication/emergency-button";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ channel?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "communication.shell" });
  return { title: t("title") };
}

export default async function CommunicationPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { channel: channelParam } = await searchParams;
  setRequestLocale(locale);

  const overview = await getCommunicationOverview(channelParam ?? null);
  const detail = overview.selectedChannelId
    ? await getChannelDetail(overview.selectedChannelId)
    : null;

  const channelCount = overview.channelGroups.reduce(
    (s, g) => s + g.items.length,
    0,
  );

  // currentUserId — used by the client island to filter its own events.
  const ctx = await requireBuildingContext();

  // For the emergency-button confirm prompt: count active members in this building.
  let recipientCount = 0;
  if (overview.isBoardPlus) {
    recipientCount = await countActiveBuildingMembers(ctx.buildingId);
  }

  return (
    <CommunicationShell
      locale={locale}
      channelCount={channelCount}
      unreadCount={overview.totalUnread}
      headerActions={
        overview.isBoardPlus ? (
          <EmergencyButton recipientCount={recipientCount} />
        ) : null
      }
    >
      <CommunicationExplorer
        locale={locale}
        isBoardPlus={overview.isBoardPlus}
        currentUserId={ctx.userId}
        overview={overview}
        detail={detail}
      />
    </CommunicationShell>
  );
}

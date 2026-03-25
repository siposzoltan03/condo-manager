import { setRequestLocale } from "next-intl/server";
import { SettingsContent } from "@/components/settings/settings-content";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <SettingsContent />
    </div>
  );
}

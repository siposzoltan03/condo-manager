import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getUsers } from "@/lib/dal";
import { UserList } from "@/components/admin/user-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "users" });
  return { title: t("title") };
}

export default async function UsersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getUsers();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <UserList initialData={data} />
    </div>
  );
}

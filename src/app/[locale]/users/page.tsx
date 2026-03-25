import { setRequestLocale } from "next-intl/server";
import { RoleGuard } from "@/components/auth/role-guard";
import { UserList } from "@/components/admin/user-list";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function UsersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <RoleGuard
      role="ADMIN"
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-lg bg-red-50 px-6 py-4 text-center">
            <h2 className="text-lg font-semibold text-red-800">Access Denied</h2>
            <p className="mt-1 text-sm text-red-600">
              You do not have permission to access this page.
            </p>
          </div>
        </div>
      }
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <UserList />
      </div>
    </RoleGuard>
  );
}

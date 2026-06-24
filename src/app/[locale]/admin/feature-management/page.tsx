import { setRequestLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMinimumRole } from "@/lib/rbac";
import {
  getFeatureCatalog,
  getPlanMatrix,
  getBuildingOverrideView,
} from "@/lib/feature-access";
import { FeatureConsole } from "@/components/admin/feature-console/feature-console";

type Props = {
  params: Promise<{ locale: string }>;
};

export const dynamic = "force-dynamic";

export default async function FeatureManagementPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user || !hasMinimumRole(user.activeRole, "SUPER_ADMIN")) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-lg bg-red-50 px-6 py-4 text-center">
          <h2 className="text-lg font-semibold text-red-800">Access Denied</h2>
          <p className="mt-1 text-sm text-red-600">
            You do not have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  const buildingId = user.activeBuildingId ?? null;
  const [catalog, matrix, overrideView] = await Promise.all([
    getFeatureCatalog(),
    getPlanMatrix(),
    buildingId ? getBuildingOverrideView(buildingId) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <FeatureConsole
        catalog={catalog}
        matrix={matrix}
        overrideView={overrideView}
        buildingId={buildingId}
      />
    </div>
  );
}

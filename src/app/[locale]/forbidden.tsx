import { getLocale, getTranslations } from "next-intl/server";
import { StatusScreen } from "@/components/shared/status-screen";

/**
 * 403 boundary — rendered when a page-facing guard calls `forbidden()`
 * (authenticated, but the role isn't allowed). API routes still return JSON.
 */
export default async function Forbidden() {
  const t = await getTranslations("common");
  const locale = await getLocale();
  return (
    <StatusScreen
      code="403"
      tone="danger"
      title={t("forbiddenTitle")}
      description={t("forbiddenDesc")}
      primaryHref={`/${locale}/dashboard`}
      primaryLabel={t("errorGoHome")}
    />
  );
}

import { getLocale, getTranslations } from "next-intl/server";
import { StatusScreen } from "@/components/shared/status-screen";

/**
 * 401 boundary — rendered when a page-facing guard calls `unauthorized()`
 * (not signed in / session expired). Sends the user to log in. API routes
 * still return JSON.
 */
export default async function Unauthorized() {
  const t = await getTranslations("common");
  const locale = await getLocale();
  return (
    <StatusScreen
      code="401"
      title={t("unauthorizedTitle")}
      description={t("unauthorizedDesc")}
      primaryHref={`/${locale}/login`}
      primaryLabel={t("loginCta")}
    />
  );
}

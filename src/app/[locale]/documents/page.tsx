import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getDocumentsOverview } from "@/lib/documents-dal";
import { DocumentsShell } from "@/components/documents/documents-shell";
import { DocumentsExplorer } from "@/components/documents/documents-explorer";
import { DocumentsHeaderActions } from "@/components/documents/documents-header-actions";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    category?: string;
    q?: string;
    ft?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "documents.shell" });
  return { title: t("title") };
}

export default async function DocumentsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const data = await getDocumentsOverview({
    categoryId: sp.category ?? null,
    search: sp.q ?? null,
    fullText: sp.ft === "1",
  });
  const t = await getTranslations({ locale, namespace: "documents.shell" });

  // Flatten the tree into options for the upload + new-category modals.
  const categoryOptions: { id: string; name: string; isChild: boolean }[] = [];
  for (const root of data.tree) {
    categoryOptions.push({ id: root.id, name: root.name, isChild: false });
    for (const child of root.children) {
      categoryOptions.push({ id: child.id, name: child.name, isChild: true });
    }
  }

  return (
    <DocumentsShell
      locale={locale}
      titleSuffix={t("titleSuffix")}
      headerActions={
        <DocumentsHeaderActions
          isBoardPlus={data.isBoardPlus}
          isAdminPlus={data.isAdminPlus}
          categories={categoryOptions}
          defaultCategoryId={data.selectedCategoryId}
        />
      }
    >
      <DocumentsExplorer
        data={data}
        initialSearch={sp.q ?? ""}
        initialFullText={sp.ft === "1"}
      />
    </DocumentsShell>
  );
}

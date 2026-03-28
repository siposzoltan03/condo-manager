"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CategorySidebar } from "./category-sidebar";
import { DocumentTable } from "./document-table";
import { DocumentFilters } from "./document-filters";
import { UploadDocumentModal } from "./upload-document-modal";
import { VersionHistoryPanel } from "./version-history-panel";

interface LatestVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: { id: string; name: string };
  uploadedAt: string;
}

interface DocumentItem {
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  category: { id: string; name: string };
  visibility: string;
  tags: unknown;
  uploadedBy: { id: string; name: string };
  latestVersion: LatestVersion | null;
  createdAt: string;
  updatedAt: string;
}

interface CategoryChild {
  id: string;
  name: string;
  icon: string | null;
  documentCount: number;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  documentCount: number;
  children: CategoryChild[];
}

interface DocumentsResponse {
  documents: DocumentItem[];
  total: number;
  page: number;
  totalPages: number;
}

interface CategoriesResponse {
  categories: Category[];
}

// Map category names to descriptions for display
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Rules & Regulations": "Building rules, bylaws, and regulatory documents",
  "Contracts": "Vendor contracts, service agreements, and legal documents",
  "Meeting Minutes": "Records from board and community meetings",
  "Financials": "Financial reports, budgets, and audit documents",
  "Insurance": "Insurance policies and claim documents",
};

export function DocumentsPage() {
  const t = useTranslations("documents");
  const tCommon = useTranslations("common");

  // Data state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [fullTextSearch, setFullTextSearch] = useState(false);

  // UI state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("/api/documents/categories");
        if (res.ok) {
          const data: CategoriesResponse = await res.json();
          setCategories(data.categories);
        }
      } catch {
        // ignore
      }
    }
    fetchCategories();
  }, []);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
      if (visibilityFilter) params.set("visibility", visibilityFilter);
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/documents?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch documents");

      const data: DocumentsResponse = await res.json();
      setDocuments(data.documents);
      setTotalPages(data.totalPages);
    } catch {
      setError(tCommon("error"));
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCategoryId, visibilityFilter, typeFilter, tCommon]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  function handleCategoryChange(id: string | null) {
    setSelectedCategoryId(id);
    setPage(1);
  }

  function handleVisibilityChange(value: string) {
    setVisibilityFilter(value);
    setPage(1);
  }

  function handleTypeChange(value: string) {
    setTypeFilter(value);
    setPage(1);
  }

  function handleUploadSuccess() {
    setShowUploadModal(false);
    setPage(1);
    fetchDocuments();
  }

  // Get selected category name for header
  const selectedCategory = selectedCategoryId
    ? [...categories, ...categories.flatMap((c) => c.children)].find(
        (c) => c.id === selectedCategoryId
      )
    : null;

  const headerTitle = selectedCategory ? selectedCategory.name : t("title");
  const headerDescription = selectedCategory
    ? CATEGORY_DESCRIPTIONS[selectedCategory.name] ?? t("subtitle")
    : t("subtitle");

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Category Sidebar */}
      <CategorySidebar
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleCategoryChange}
        onUploadClick={() => setShowUploadModal(true)}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="font-manrope text-3xl font-extrabold text-[#002045]">
              {headerTitle}
            </h1>
            <p className="mt-1 text-slate-500">{headerDescription}</p>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <DocumentFilters
              searchValue={searchInput}
              onSearchChange={setSearchInput}
              visibilityFilter={visibilityFilter}
              onVisibilityChange={handleVisibilityChange}
              typeFilter={typeFilter}
              onTypeChange={handleTypeChange}
              fullTextSearch={fullTextSearch}
              onFullTextToggle={setFullTextSearch}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Document Table */}
          {loading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <p className="text-slate-500">{tCommon("loading")}</p>
            </div>
          ) : (
            <DocumentTable
              documents={documents}
              onSelectDocument={(id) => setSelectedDocumentId(id)}
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {t("pageOf", { page, totalPages })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("previous")}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("next")}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Version History Panel */}
      {selectedDocumentId && (
        <VersionHistoryPanel
          documentId={selectedDocumentId}
          onClose={() => setSelectedDocumentId(null)}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadDocumentModal
          categories={categories}
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}

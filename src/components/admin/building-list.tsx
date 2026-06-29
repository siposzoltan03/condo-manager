"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2, X } from "lucide-react";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { ViewAsUserButton } from "./view-as-user-button";
import type { BuildingsData, BuildingItemData } from "@/lib/dal";

interface BuildingFormData {
  name: string;
  address: string;
  city: string;
  zipCode: string;
}

interface BuildingListProps {
  initialData: BuildingsData;
}

export function BuildingList({ initialData }: BuildingListProps) {
  const t = useTranslations("buildings");
  const tCommon = useTranslations("common");
  const confirm = useConfirm();
  const router = useRouter();
  const buildings = initialData.buildings;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<BuildingItemData | null>(null);
  const [formData, setFormData] = useState<BuildingFormData>({ name: "", address: "", city: "", zipCode: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function openCreate() {
    setEditingBuilding(null);
    setFormData({ name: "", address: "", city: "", zipCode: "" });
    setError("");
    setModalOpen(true);
  }

  function openEdit(building: BuildingItemData) {
    setEditingBuilding(building);
    setFormData({
      name: building.name,
      address: building.address,
      city: building.city,
      zipCode: building.zipCode,
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (!formData.name || !formData.address || !formData.city || !formData.zipCode) {
        setError(t("missingFields"));
        setSubmitting(false);
        return;
      }

      const isEdit = !!editingBuilding;
      const url = isEdit ? `/api/buildings/${editingBuilding.id}` : "/api/buildings";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }

      toast.success(isEdit ? "Building updated successfully" : "Building created successfully");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(building: BuildingItemData) {
    const ok = await confirm({ title: t("confirmDelete"), danger: true });
    if (!ok) return;

    try {
      const res = await fetch(`/api/buildings/${building.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
        return;
      }
      toast.success("Building deleted successfully");
      router.refresh();
    } catch {
      toast.error(tCommon("error"));
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("addBuilding")}
        </button>
      </div>

      {buildings.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <Building2 className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">{t("noBuildings")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  {t("name")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  {t("address")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  {t("city")}
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                  {t("units")}
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                  {t("users")}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {buildings.map((building) => (
                <tr key={building.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {building.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{building.address}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {building.zipCode} {building.city}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-slate-600">
                    {building.unitCount}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-slate-600">
                    {building.userCount}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ViewAsUserButton
                        buildingId={building.id}
                        buildingName={building.name}
                      />
                      <button
                        onClick={() => openEdit(building)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                        title={tCommon("edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {building.unitCount === 0 && (
                        <button
                          onClick={() => handleDelete(building)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title={tCommon("delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl mx-4">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {editingBuilding ? t("editBuilding") : t("addBuilding")}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t("name")}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={t("namePlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t("address")}
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={t("addressPlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t("city")}
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder={t("cityPlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t("zipCode")}
                  </label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder={t("zipCodePlaceholder")}
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {tCommon("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? tCommon("loading") : editingBuilding ? tCommon("save") : tCommon("create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

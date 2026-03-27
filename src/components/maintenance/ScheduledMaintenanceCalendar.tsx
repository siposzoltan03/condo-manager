"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  List,
  CalendarDays,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { RoleGuard } from "@/components/auth/role-guard";

interface ScheduledItem {
  id: string;
  title: string;
  description: string | null;
  date: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  createdAt: string;
}

export function ScheduledMaintenanceCalendar() {
  const t = useTranslations("maintenance.scheduled");
  const tCommon = useTranslations("common");
  const { hasRole } = useAuth();
  const isBoardPlus = hasRole("BOARD_MEMBER");

  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [formRecurrenceRule, setFormRecurrenceRule] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/maintenance/scheduled");
      if (res.ok) {
        const data = await res.json();
        setItems(data.scheduled || []);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function resetForm() {
    setFormTitle("");
    setFormDescription("");
    setFormDate("");
    setFormIsRecurring(false);
    setFormRecurrenceRule("");
    setFormError("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(item: ScheduledItem) {
    setFormTitle(item.title);
    setFormDescription(item.description ?? "");
    setFormDate(item.date.split("T")[0]);
    setFormIsRecurring(item.isRecurring);
    setFormRecurrenceRule(item.recurrenceRule ?? "");
    setEditingId(item.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formTitle.trim() || !formDate) {
      setFormError("Title and date are required");
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        date: formDate,
        isRecurring: formIsRecurring,
        recurrenceRule: formRecurrenceRule.trim() || undefined,
      };

      const url = editingId
        ? `/api/maintenance/scheduled/${editingId}`
        : "/api/maintenance/scheduled";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || tCommon("error"));
        return;
      }

      resetForm();
      fetchItems();
    } catch {
      setFormError(tCommon("error"));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      const res = await fetch(`/api/maintenance/scheduled/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchItems();
      }
    } catch {
      // Error handled silently
    }
  }

  // Calendar helpers
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
  const monthName = new Date(calendarYear, calendarMonth).toLocaleString("default", { month: "long", year: "numeric" });

  const itemsByDay = new Map<number, ScheduledItem[]>();
  items.forEach((item) => {
    const d = new Date(item.date);
    if (d.getMonth() === calendarMonth && d.getFullYear() === calendarYear) {
      const day = d.getDate();
      const existing = itemsByDay.get(day) || [];
      existing.push(item);
      itemsByDay.set(day, existing);
    }
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-extrabold text-[#002045]">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium ${
              view === "list" ? "bg-[#002045] text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <List className="h-4 w-4" />
            {t("listView")}
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium ${
              view === "calendar" ? "bg-[#002045] text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            {t("calendarView")}
          </button>
          {isBoardPlus && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 rounded-md bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#002045]/90"
            >
              <Plus className="h-4 w-4" />
              {t("addEntry")}
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && isBoardPlus && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#002045]">
              {editingId ? t("editEntry") : t("addEntry")}
            </h2>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            {formError && (
              <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("date")}</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
                  required
                />
              </div>
              <div>
                <label className="flex items-center gap-2 mt-6 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formIsRecurring}
                    onChange={(e) => setFormIsRecurring(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  {t("isRecurring")}
                </label>
              </div>
              {formIsRecurring && (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t("recurrenceRule")}</label>
                  <input
                    type="text"
                    value={formRecurrenceRule}
                    onChange={(e) => setFormRecurrenceRule(e.target.value)}
                    placeholder="e.g. Every 3 months"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#002045] focus:outline-none focus:ring-1 focus:ring-[#002045]"
                  />
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="rounded-md bg-[#002045] px-4 py-2 text-sm font-medium text-white hover:bg-[#002045]/90 disabled:opacity-50"
              >
                {formLoading ? tCommon("loading") : tCommon("save")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-slate-500">{tCommon("loading")}</p>
        </div>
      ) : view === "list" ? (
        /* List view */
        items.length === 0 ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <p className="text-slate-500">{t("noEntries")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#002045]">{item.title}</h3>
                    {item.description && (
                      <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-sm text-slate-500">
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                      {item.isRecurring && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                          <RefreshCw className="h-3 w-3" />
                          {item.recurrenceRule ?? t("isRecurring")}
                        </span>
                      )}
                    </div>
                  </div>
                  {isBoardPlus && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(item)}
                        className="rounded p-1 text-slate-400 hover:text-[#002045]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Calendar view */
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => {
                if (calendarMonth === 0) {
                  setCalendarMonth(11);
                  setCalendarYear(calendarYear - 1);
                } else {
                  setCalendarMonth(calendarMonth - 1);
                }
              }}
              className="rounded p-1 hover:bg-slate-100"
            >
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </button>
            <h2 className="text-lg font-semibold text-[#002045]">{monthName}</h2>
            <button
              onClick={() => {
                if (calendarMonth === 11) {
                  setCalendarMonth(0);
                  setCalendarYear(calendarYear + 1);
                } else {
                  setCalendarMonth(calendarMonth + 1);
                }
              }}
              className="rounded p-1 hover:bg-slate-100"
            >
              <ChevronRight className="h-5 w-5 text-slate-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-px">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="p-2 text-center text-xs font-medium text-slate-500">
                {day}
              </div>
            ))}
            {/* Empty cells for days before the 1st */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] bg-slate-50 p-1" />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayItems = itemsByDay.get(day) || [];
              return (
                <div
                  key={day}
                  className={`min-h-[80px] border border-slate-100 p-1 ${
                    dayItems.length > 0 ? "bg-blue-50" : ""
                  }`}
                >
                  <span className="text-xs font-medium text-slate-600">{day}</span>
                  {dayItems.map((item) => (
                    <div
                      key={item.id}
                      className="mt-0.5 truncate rounded bg-[#002045] px-1 py-0.5 text-[10px] text-white"
                      title={item.title}
                    >
                      {item.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useSelector } from "react-redux";
import Skeleton from "react-loading-skeleton";

import { AppShell } from "@/components/layout/app-shell";
import { formatInrCurrency } from "@/lib/currency";
import { formatDateDDMonYYYY } from "@/lib/date";
import { getErrorMessage } from "@/lib/error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/toast";
import { persistToken } from "@/store/provider";
import {
  useCreateLogMutation,
  useDeleteLogMutation,
  useGetLogRevisionsQuery,
  useListBrandsQuery,
  useListContactsQuery,
  useListLogsQuery,
  useUpdateLogMutation,
} from "@/store/services/api";
import type { RootState } from "@/store";
import type { LogStatus, Priority } from "@/types/api";
import { LOG_STATUSES, PRIORITIES } from "@/types/api";

function statusLabel(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

function Select<T extends string>({
  id, value, onChange, options, placeholder, className,
}: {
  id?: string;
  value: T | "";
  onChange: (v: T) => void;
  options: readonly T[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={className ?? "ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>{statusLabel(o)}</option>
      ))}
    </select>
  );
}

type AutocompleteOption = {
  id: string;
  label: string;
  secondary?: string;
};

function AutocompleteField({
  id,
  value,
  options,
  loading,
  placeholder,
  noResultsText,
  isDarkTheme,
  onChange,
}: {
  id: string;
  value: string;
  options: AutocompleteOption[];
  loading: boolean;
  placeholder: string;
  noResultsText: string;
  isDarkTheme: boolean;
  onChange: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const debounceRef = useRef<number | null>(null);

  const selected = options.find((o) => o.id === value);

  const filteredOptions = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => {
      const label = o.label.toLowerCase();
      const secondary = o.secondary?.toLowerCase() ?? "";
      return label.includes(term) || secondary.includes(term);
    });
  }, [options, debouncedSearch]);

  const visibleOptions = filteredOptions.slice(0, visibleCount);

  function handleOpen() {
    setIsOpen(true);
    // Always reopen with a fresh query so users can quickly change selections.
    setSearchInput("");
    setDebouncedSearch("");
    setVisibleCount(20);
  }

  function handleInputChange(next: string) {
    setSearchInput(next);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setDebouncedSearch(next);
      setVisibleCount(20);
    }, 300);
  }

  function handleSelect(optionId: string) {
    onChange(optionId);
    setSearchInput("");
    setDebouncedSearch("");
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={isOpen ? searchInput : (selected?.label ?? "")}
        onFocus={handleOpen}
        onClick={handleOpen}
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={() => setIsOpen(false)}
        placeholder={placeholder}
        className={
          isDarkTheme
            ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30"
            : undefined
        }
      />
      {isOpen ? (
        <div
          className={
            isDarkTheme
              ? "absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-white/10 bg-slate-900 shadow-xl"
              : "absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl"
          }
        >
          {loading ? (
            <div className="px-3 py-2">
              <Skeleton height={12} count={3} />
            </div>
          ) : visibleOptions.length > 0 ? (
            visibleOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option.id)}
                className={
                  isDarkTheme
                    ? "flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                    : "flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                }
              >
                <span>{option.label}</span>
                {option.secondary ? (
                  <span className={isDarkTheme ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                    {option.secondary}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className={isDarkTheme ? "px-3 py-2 text-sm text-slate-400" : "px-3 py-2 text-sm text-slate-500"}>
              {noResultsText}
            </p>
          )}
          {!loading && visibleCount < filteredOptions.length ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setVisibleCount((prev) => prev + 20)}
              className={
                isDarkTheme
                  ? "w-full border-t border-white/10 px-3 py-2 text-xs text-cyan-300 hover:bg-slate-800"
                  : "w-full border-t border-slate-200 px-3 py-2 text-xs text-blue-600 hover:bg-slate-100"
              }
            >
              Load more
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function LogsPage() {
  const token = useSelector((state: RootState) => state.auth.token);
  const initialized = useSelector((state: RootState) => state.auth.initialized);

  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">(() => {
    if (typeof window === "undefined") return "system";
    const stored = window.localStorage.getItem("venta-dashboard-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  const [showCreateLogModal, setShowCreateLogModal] = useState(false);

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [historyLogId, setHistoryLogId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const createLogForm = useForm({
    defaultValues: {
      title: "",
      brandId: "",
      status: "" as LogStatus | "",
      priority: "" as Priority | "",
      contactId: "",
      lastContactDate: "",
      followUpDate: "",
      meetingDate: "",
      actualRevenue: "",
      notes: "",
    },
  });
  const editLogForm = useForm({
    defaultValues: {
      title: "",
      brandId: "",
      status: "" as LogStatus | "",
      priority: "" as Priority | "",
      contactId: "",
      lastContactDate: "",
      followUpDate: "",
      meetingDate: "",
      actualRevenue: "",
      notes: "",
    },
  });
  const logBrandId = useWatch({ control: createLogForm.control, name: "brandId" });
  const editLogBrandId = useWatch({ control: editLogForm.control, name: "brandId" });

  const brands = useListBrandsQuery(undefined, { skip: !token });
  const contacts = useListContactsQuery(undefined, { skip: !token });
  const logs = useListLogsQuery(undefined, { skip: !token });
  const [createLog, createLogState] = useCreateLogMutation();
  const [deleteLog] = useDeleteLogMutation();
  const [updateLog, updateLogState] = useUpdateLogMutation();
  const logRevisions = useGetLogRevisionsQuery(historyLogId ?? "", {
    skip: !token || !historyLogId,
  });
  const searchTokens = useMemo(
    () => debouncedSearchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [debouncedSearchTerm],
  );
  const filteredLogs = useMemo(() => {
    const rows = logs.data ?? [];
    if (searchTokens.length === 0) return rows;
    return rows.filter((log) => {
      const haystack = [
        log.title,
        log.notes,
        log.status,
        statusLabel(log.status),
        log.priority,
        statusLabel(log.priority),
        log.brand?.name ?? log.brandId,
        log.contact?.name ?? log.contactId,
        log.assignee?.name ?? log.assignedTo,
        log.lastContactDate?.slice(0, 10),
        log.followUpDate?.slice(0, 10),
        log.meetingDate?.slice(0, 10),
        String(log.actualRevenue),
      ]
        .join(" ")
        .toLowerCase();
      return searchTokens.every((token) => haystack.includes(token));
    });
  }, [logs.data, searchTokens]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchInput);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  function onThemeChange(value: "light" | "dark" | "system") {
    setThemeMode(value);
    window.localStorage.setItem("venta-dashboard-theme", value);
    window.dispatchEvent(new CustomEvent("venta-theme-change", { detail: value }));
  }

  async function onCreateLog(values: {
    title: string;
    brandId: string;
    status: LogStatus | "";
    priority: Priority | "";
    contactId: string;
    lastContactDate: string;
    followUpDate: string;
    meetingDate: string;
    actualRevenue: string;
    notes: string;
  }) {
    const selectedBrandOwnerId = brands.data?.find((b) => b.id === values.brandId)?.ownerId ?? "";
    if (!selectedBrandOwnerId) {
      createLogForm.setError("brandId", { message: "Assigned user is required" });
      return;
    }
    try {
      await createLog({
        title: values.title.trim(),
        brandId: values.brandId,
        contactId: values.contactId,
        status: values.status as LogStatus,
        priority: values.priority as Priority,
        assignedTo: selectedBrandOwnerId,
        lastContactDate: values.lastContactDate,
        followUpDate: values.followUpDate,
        meetingDate: values.meetingDate,
        actualRevenue: Number(values.actualRevenue),
        notes: values.notes.trim(),
      }).unwrap();
      notifySuccess("Log created.");
      createLogForm.reset();
      setShowCreateLogModal(false);
    } catch (err) {
      notifyError(getErrorMessage(err, "Create log failed"));
    }
  }

  async function onDeleteLog(id: string, title: string) {
    if (!confirm(`Delete log "${title}"?`)) return;
    try {
      await deleteLog(id).unwrap();
      notifySuccess("Log deleted.");
    } catch (err) {
      notifyError(getErrorMessage(err, "Delete log failed"));
    }
  }

  function onOpenEditLog(id: string) {
    const log = logs.data?.find((item) => item.id === id);
    if (!log) return;
    setEditingLogId(log.id);
    editLogForm.reset({
      title: log.title ?? "",
      brandId: log.brandId ?? "",
      status: (log.status ?? "") as LogStatus | "",
      priority: (log.priority ?? "") as Priority | "",
      contactId: log.contactId ?? "",
      lastContactDate: (log.lastContactDate ?? "").slice(0, 10),
      followUpDate: (log.followUpDate ?? "").slice(0, 10),
      meetingDate: (log.meetingDate ?? "").slice(0, 10),
      actualRevenue: log.actualRevenue !== undefined ? String(log.actualRevenue) : "",
      notes: log.notes ?? "",
    });
  }

  function onCloseEditLog() {
    setEditingLogId(null);
    editLogForm.reset();
  }

  function onOpenCreateLogModal() {
    createLogForm.reset();
    setShowCreateLogModal(true);
  }

  function onCloseCreateLogModal() {
    setShowCreateLogModal(false);
    createLogForm.reset();
  }

  function onOpenLogHistory(id: string) {
    setHistoryLogId(id);
  }

  function onCloseLogHistory() {
    setHistoryLogId(null);
  }

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (historyLogId) {
        setHistoryLogId(null);
        return;
      }
      if (editingLogId) {
        setEditingLogId(null);
        editLogForm.reset();
        return;
      }
      if (showCreateLogModal) {
        setShowCreateLogModal(false);
        createLogForm.reset();
      }
    };

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [createLogForm, editLogForm, editingLogId, historyLogId, showCreateLogModal]);

  async function onUpdateLog(values: {
    title: string;
    brandId: string;
    status: LogStatus | "";
    priority: Priority | "";
    contactId: string;
    lastContactDate: string;
    followUpDate: string;
    meetingDate: string;
    actualRevenue: string;
    notes: string;
  }) {
    if (!editingLogId) return;
    const selectedEditBrandOwnerId = brands.data?.find((b) => b.id === values.brandId)?.ownerId ?? "";
    if (!selectedEditBrandOwnerId) {
      editLogForm.setError("brandId", { message: "Assigned user is required" });
      return;
    }
    try {
      await updateLog({
        id: editingLogId,
        title: values.title.trim(),
        brandId: values.brandId,
        contactId: values.contactId,
        status: values.status as LogStatus,
        priority: values.priority as Priority,
        assignedTo: selectedEditBrandOwnerId,
        lastContactDate: values.lastContactDate,
        followUpDate: values.followUpDate,
        meetingDate: values.meetingDate,
        actualRevenue: Number(values.actualRevenue),
        notes: values.notes.trim(),
      }).unwrap();
      notifySuccess("Log updated.");
      onCloseEditLog();
    } catch (err) {
      notifyError(getErrorMessage(err, "Update log failed"));
    }
  }

  if (!initialized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
      </main>
    );
  }
  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>Please sign in</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">You need an active session before opening logs.</p>
            <Link href="/"><Button className="w-full">Go to Login</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const isDarkTheme = themeMode === "dark" || (themeMode === "system" && systemPrefersDark);
  const skeletonThemeStyle: CSSProperties | undefined = isDarkTheme
    ? ({ "--base-color": "#1e293b", "--highlight-color": "#334155" } as CSSProperties)
    : undefined;
  const selectedBrand = brands.data?.find((b) => b.id === logBrandId);
  const selectedBrandContacts = contacts.data?.filter((c) => c.brandId === logBrandId) ?? [];
  const selectedBrandAssigneeName = selectedBrand?.owner?.name ?? "";
  const selectedBrandExpectedRevenue =
    selectedBrand?.expectedRevenue !== undefined ? Number(selectedBrand.expectedRevenue) : NaN;

  const selectedEditBrand = brands.data?.find((b) => b.id === editLogBrandId);
  const selectedEditBrandContacts = contacts.data?.filter((c) => c.brandId === editLogBrandId) ?? [];
  const selectedEditBrandAssigneeName = selectedEditBrand?.owner?.name ?? "";
  const selectedEditBrandExpectedRevenue =
    selectedEditBrand?.expectedRevenue !== undefined ? Number(selectedEditBrand.expectedRevenue) : NaN;
  const brandOptions = (brands.data ?? []).map((b) => ({ id: b.id, label: b.name }));
  const createContactOptions = selectedBrandContacts.map((c) => ({ id: c.id, label: c.name, secondary: c.email }));
  const editContactOptions = selectedEditBrandContacts.map((c) => ({ id: c.id, label: c.name, secondary: c.email }));
  return (
    <AppShell isDarkTheme={isDarkTheme}>
      <main className={isDarkTheme ? "min-h-screen bg-slate-950 text-slate-100" : "min-h-screen bg-slate-100"} style={skeletonThemeStyle}>
        <header className={isDarkTheme ? "border-b border-white/10 bg-slate-900 px-6 py-3 shadow-sm shadow-black/20" : "border-b bg-white px-6 py-3 shadow-sm"}>
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={isDarkTheme ? "text-lg font-bold text-white" : "text-lg font-bold text-slate-900"}>Venta</span>
              <span className={isDarkTheme ? "text-slate-500" : "text-slate-400"}>|</span>
              <span className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-700"}>Logs</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={themeMode}
                onChange={(e) => onThemeChange(e.target.value as "light" | "dark" | "system")}
                className={isDarkTheme ? "h-10 rounded-md border border-white/15 bg-slate-800 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <Button variant="outline" className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined} onClick={() => persistToken(null)}>
                Logout
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 p-6">
          <div className="grid gap-6">
            <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20" : undefined}>
              <CardHeader><CardTitle>Logs</CardTitle></CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex w-full items-center gap-2 md:max-w-xl">
                    <Input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search logs by title, notes, brand, contact, assignee, status, priority, date, revenue..."
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                    />
                    {searchInput ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSearchInput("");
                          setDebouncedSearchTerm("");
                        }}
                        className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                  <Button className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined} onClick={onOpenCreateLogModal}>
                    Add Log
                  </Button>
                </div>
                <p className={isDarkTheme ? "mb-3 text-xs text-slate-400" : "mb-3 text-xs text-slate-500"}>
                  Showing {filteredLogs.length} of {logs.data?.length ?? 0} logs
                </p>
                <p className={isDarkTheme ? "mb-4 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200" : "mb-4 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-700"}>
                  Use buttons on each log card to view revision history, edit, or delete directly from this page.
                </p>
                {logs.isLoading ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 p-4">
                        <Skeleton height={16} width="60%" />
                        <Skeleton height={12} count={5} className="mt-2" />
                      </div>
                    ))}
                  </div>
                ) : null}
                {logs.isError ? (
                  <p className="py-4 text-center text-red-600">
                    Failed to load.{" "}
                    <button onClick={() => logs.refetch()} className="underline hover:opacity-70">
                      Retry
                    </button>
                  </p>
                ) : null}
                {!logs.isLoading && !logs.isError && filteredLogs.length === 0 ? (
                  <p className="py-4 text-center text-slate-400">
                    {debouncedSearchTerm ? "No logs match your search." : "No logs yet."}
                  </p>
                ) : null}
                {!logs.isLoading && !logs.isError && filteredLogs.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredLogs.map((l) => (
                      <div
                        key={l.id}
                        className={isDarkTheme ? "rounded-xl border border-white/10 bg-slate-800/70 p-4 transition hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"}
                      >
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <h4 className={isDarkTheme ? "text-sm font-semibold text-white" : "text-sm font-semibold text-slate-900"}>{l.title}</h4>
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${l.status === "CLOSED_WON" ? "bg-green-100 text-green-700" : l.status === "CLOSED_LOST" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{statusLabel(l.status)}</span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <p className={isDarkTheme ? "text-slate-300" : "text-slate-600"}><strong>Priority:</strong> {statusLabel(l.priority)}</p>
                          <p className={isDarkTheme ? "text-slate-300" : "text-slate-600"}><strong>Brand:</strong> {l.brand?.name ?? l.brandId}</p>
                          <p className={isDarkTheme ? "text-slate-300" : "text-slate-600"}><strong>Contact:</strong> {l.contact?.name ?? l.contactId}</p>
                          <p className={isDarkTheme ? "text-slate-300" : "text-slate-600"}><strong>Assignee:</strong> {l.assignee?.name ?? l.assignedTo}</p>
                          <p className={isDarkTheme ? "text-slate-300" : "text-slate-600"}><strong>Revenue:</strong> {formatInrCurrency(l.actualRevenue, true)}</p>
                          <p className={isDarkTheme ? "text-slate-400" : "text-slate-500"}>{l.notes}</p>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <button onClick={() => onOpenLogHistory(l.id)} className={isDarkTheme ? "rounded px-2 py-1 text-xs text-purple-300 transition hover:bg-purple-500/15 hover:underline" : "rounded px-2 py-1 text-xs text-violet-600 transition hover:bg-violet-50 hover:underline"}>History</button>
                          <button onClick={() => onOpenEditLog(l.id)} className={isDarkTheme ? "rounded px-2 py-1 text-xs text-cyan-300 transition hover:bg-cyan-500/15 hover:underline" : "rounded px-2 py-1 text-xs text-blue-600 transition hover:bg-blue-50 hover:underline"}>Edit</button>
                          <button onClick={() => void onDeleteLog(l.id, l.title)} className={isDarkTheme ? "rounded px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/15 hover:underline" : "rounded px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 hover:underline"}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>

        {showCreateLogModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div className={isDarkTheme ? "w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/50" : "w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className={isDarkTheme ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"}>Add Log</h3>
                <button type="button" onClick={onCloseCreateLogModal} className={isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}>Close</button>
              </div>
              <form className="space-y-3" onSubmit={createLogForm.handleSubmit(onCreateLog)} noValidate>
                <div className="space-y-1">
                  <Label htmlFor="logTitle">Title *</Label>
                  <Input id="logTitle" {...createLogForm.register("title", { required: "Title is required" })} className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined} />
                  <FieldError msg={createLogForm.formState.errors.title?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logBrand">Brand *</Label>
                  <Controller
                    control={createLogForm.control}
                    name="brandId"
                    rules={{ required: "Select a brand" }}
                    render={({ field }) => (
                      <AutocompleteField
                        id="logBrand"
                        value={field.value}
                        options={brandOptions}
                        loading={brands.isLoading}
                        placeholder="Search and select brand..."
                        noResultsText="No brands found."
                        isDarkTheme={isDarkTheme}
                        onChange={(id) => {
                          field.onChange(id);
                          createLogForm.setValue("contactId", "");
                        }}
                      />
                    )}
                  />
                  <FieldError msg={createLogForm.formState.errors.brandId?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logStatus">Status *</Label>
                  <Controller control={createLogForm.control} name="status" rules={{ required: "Status is required" }} render={({ field }) => (
                    <Select id="logStatus" value={field.value} onChange={field.onChange} options={LOG_STATUSES} placeholder="Select..." className={isDarkTheme ? "ui-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"} />
                  )} />
                  <FieldError msg={createLogForm.formState.errors.status?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logPriority">Priority *</Label>
                  <Controller control={createLogForm.control} name="priority" rules={{ required: "Priority is required" }} render={({ field }) => (
                    <Select id="logPriority" value={field.value} onChange={field.onChange} options={PRIORITIES} placeholder="Select..." className={isDarkTheme ? "ui-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"} />
                  )} />
                  <FieldError msg={createLogForm.formState.errors.priority?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logContact">Contact *</Label>
                  <Controller control={createLogForm.control} name="contactId" rules={{ required: "Contact is required" }} render={({ field }) => (
                    <AutocompleteField
                      id="logContact"
                      value={field.value}
                      options={createContactOptions}
                      loading={contacts.isLoading}
                      placeholder={logBrandId ? "Search and select contact..." : "Select brand first..."}
                      noResultsText={logBrandId ? "No contacts found for this brand." : "Select brand first."}
                      isDarkTheme={isDarkTheme}
                      onChange={field.onChange}
                    />
                  )} />
                  <FieldError msg={createLogForm.formState.errors.contactId?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logAssignedTo">Assigned To *</Label>
                  <Input id="logAssignedTo" value={selectedBrandAssigneeName} readOnly className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-300 focus-visible:ring-cyan-400/30" : "bg-slate-100"} />
                  <FieldError msg={createLogForm.formState.errors.brandId?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logLastContactDate">Last Contact Date *</Label>
                  <Input id="logLastContactDate" type="date" {...createLogForm.register("lastContactDate", { required: "Last contact date is required" })} className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 focus-visible:ring-cyan-400/30" : undefined} />
                  <FieldError msg={createLogForm.formState.errors.lastContactDate?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logFollowUpDate">Follow Up Date *</Label>
                  <Input id="logFollowUpDate" type="date" {...createLogForm.register("followUpDate", { required: "Follow up date is required" })} className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 focus-visible:ring-cyan-400/30" : undefined} />
                  <FieldError msg={createLogForm.formState.errors.followUpDate?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logMeetingDate">Meeting Date *</Label>
                  <Input id="logMeetingDate" type="date" {...createLogForm.register("meetingDate", { required: "Meeting date is required" })} className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 focus-visible:ring-cyan-400/30" : undefined} />
                  <FieldError msg={createLogForm.formState.errors.meetingDate?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logExpectedRevenue">Expected Revenue (View Only) *</Label>
                  <Input id="logExpectedRevenue" value={Number.isFinite(selectedBrandExpectedRevenue) ? formatInrCurrency(selectedBrandExpectedRevenue, true) : ""} readOnly className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-300 focus-visible:ring-cyan-400/30" : "bg-slate-100"} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logActualRevenue">Actual Revenue *</Label>
                  <Input id="logActualRevenue" type="number" min="0" step="0.01" {...createLogForm.register("actualRevenue", { required: "Actual revenue is required" })} className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 focus-visible:ring-cyan-400/30" : undefined} />
                  <FieldError msg={createLogForm.formState.errors.actualRevenue?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logNotes">Notes *</Label>
                  <textarea id="logNotes" {...createLogForm.register("notes", { required: "Notes are required" })} rows={3} className={isDarkTheme ? "w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"} />
                  <FieldError msg={createLogForm.formState.errors.notes?.message} />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined} onClick={onCloseCreateLogModal}>Cancel</Button>
                  <Button className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined} disabled={createLogState.isLoading}>
                    {createLogState.isLoading ? "Saving..." : "Create Log"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {editingLogId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div className={isDarkTheme ? "w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/50" : "w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className={isDarkTheme ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"}>Edit Log</h3>
                <button type="button" onClick={onCloseEditLog} className={isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}>Close</button>
              </div>
              <form className="space-y-3" onSubmit={editLogForm.handleSubmit(onUpdateLog)} noValidate>
                <div className="space-y-1">
                  <Label htmlFor="editLogTitle">Title (Locked)</Label>
                  <Input id="editLogTitle" readOnly {...editLogForm.register("title")} className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-300 focus-visible:ring-cyan-400/30" : "bg-slate-100"} />
                  <p className={isDarkTheme ? "text-xs text-slate-400" : "text-xs text-slate-500"}>Title cannot be changed after log creation.</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogBrand">Brand (Locked)</Label>
                  <Input id="editLogBrand" readOnly value={selectedEditBrand?.name ?? ""} className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-300 focus-visible:ring-cyan-400/30" : "bg-slate-100"} />
                  <p className={isDarkTheme ? "text-xs text-slate-400" : "text-xs text-slate-500"}>Brand cannot be changed after log creation.</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogStatus">Status *</Label>
                  <Controller control={editLogForm.control} name="status" rules={{ required: "Status is required" }} render={({ field }) => (
                    <Select id="editLogStatus" value={field.value} onChange={field.onChange} options={LOG_STATUSES} className={isDarkTheme ? "ui-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"} />
                  )} />
                  <FieldError msg={editLogForm.formState.errors.status?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogPriority">Priority *</Label>
                  <Controller control={editLogForm.control} name="priority" rules={{ required: "Priority is required" }} render={({ field }) => (
                    <Select id="editLogPriority" value={field.value} onChange={field.onChange} options={PRIORITIES} className={isDarkTheme ? "ui-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"} />
                  )} />
                  <FieldError msg={editLogForm.formState.errors.priority?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogContact">Contact *</Label>
                  <Controller control={editLogForm.control} name="contactId" rules={{ required: "Contact is required" }} render={({ field }) => (
                    <AutocompleteField
                      id="editLogContact"
                      value={field.value}
                      options={editContactOptions}
                      loading={contacts.isLoading}
                      placeholder={editLogBrandId ? "Search and select contact..." : "Select brand first..."}
                      noResultsText={editLogBrandId ? "No contacts found for this brand." : "Select brand first."}
                      isDarkTheme={isDarkTheme}
                      onChange={field.onChange}
                    />
                  )} />
                  <FieldError msg={editLogForm.formState.errors.contactId?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogAssignedTo">Assigned To *</Label>
                  <Input id="editLogAssignedTo" value={selectedEditBrandAssigneeName} readOnly className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-300 focus-visible:ring-cyan-400/30" : "bg-slate-100"} />
                  <FieldError msg={editLogForm.formState.errors.brandId?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogLastContactDate">Last Contact Date *</Label>
                  <Input id="editLogLastContactDate" type="date" {...editLogForm.register("lastContactDate", { required: "Last contact date is required" })} className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 focus-visible:ring-cyan-400/30" : undefined} />
                  <FieldError msg={editLogForm.formState.errors.lastContactDate?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogFollowUpDate">Follow Up Date *</Label>
                  <Input id="editLogFollowUpDate" type="date" {...editLogForm.register("followUpDate", { required: "Follow up date is required" })} className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 focus-visible:ring-cyan-400/30" : undefined} />
                  <FieldError msg={editLogForm.formState.errors.followUpDate?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogMeetingDate">Meeting Date *</Label>
                  <Input id="editLogMeetingDate" type="date" {...editLogForm.register("meetingDate", { required: "Meeting date is required" })} className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 focus-visible:ring-cyan-400/30" : undefined} />
                  <FieldError msg={editLogForm.formState.errors.meetingDate?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogExpectedRevenue">Expected Revenue (View Only) *</Label>
                  <Input id="editLogExpectedRevenue" value={Number.isFinite(selectedEditBrandExpectedRevenue) ? formatInrCurrency(selectedEditBrandExpectedRevenue, true) : ""} readOnly className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-300 focus-visible:ring-cyan-400/30" : "bg-slate-100"} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogActualRevenue">Actual Revenue *</Label>
                  <Input id="editLogActualRevenue" type="number" min="0" step="0.01" {...editLogForm.register("actualRevenue", { required: "Actual revenue is required" })} className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 focus-visible:ring-cyan-400/30" : undefined} />
                  <FieldError msg={editLogForm.formState.errors.actualRevenue?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogNotes">Notes *</Label>
                  <textarea id="editLogNotes" {...editLogForm.register("notes", { required: "Notes are required" })} rows={3} className={isDarkTheme ? "w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"} />
                  <FieldError msg={editLogForm.formState.errors.notes?.message} />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined} onClick={onCloseEditLog}>Cancel</Button>
                  <Button className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined} disabled={updateLogState.isLoading}>
                    {updateLogState.isLoading ? "Updating..." : "Update Log"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {historyLogId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div className={isDarkTheme ? "w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/50" : "w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className={isDarkTheme ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"}>Log Revision History</h3>
                <button type="button" onClick={onCloseLogHistory} className={isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}>Close</button>
              </div>
              {logRevisions.isLoading ? (
                <div className="space-y-2">
                  <Skeleton height={16} count={4} />
                </div>
              ) : null}
              {logRevisions.isError ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-500">Failed to load revision history.</p>
                  <Button type="button" variant="outline" className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined} onClick={() => logRevisions.refetch()}>
                    Retry
                  </Button>
                </div>
              ) : null}
              {!logRevisions.isLoading && !logRevisions.isError ? (
                <div className="space-y-3">
                  {logRevisions.data?.length ? (
                    logRevisions.data.map((revision) => (
                      <div
                        key={revision.id}
                        className={isDarkTheme ? "rounded-lg border border-white/10 bg-slate-800/80 p-3" : "rounded-lg border border-slate-200 bg-slate-50 p-3"}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={isDarkTheme ? "rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-200" : "rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700"}>
                              {revision.revisionType === "CREATED" ? "Created" : "Updated"}
                            </span>
                            <span className={isDarkTheme ? "text-xs text-slate-300" : "text-xs text-slate-600"}>
                              {formatDateDDMonYYYY(revision.changedAt)}
                            </span>
                          </div>
                          <span className={isDarkTheme ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                            By {revision.changedByUser?.name ?? revision.changedBy}
                          </span>
                        </div>
                        <div className={isDarkTheme ? "grid gap-2 text-xs text-slate-200 sm:grid-cols-2" : "grid gap-2 text-xs text-slate-700 sm:grid-cols-2"}>
                          <p><strong>Title:</strong> {revision.title}</p>
                          <p><strong>Status:</strong> {statusLabel(revision.status)}</p>
                          <p><strong>Priority:</strong> {statusLabel(revision.priority)}</p>
                          <p><strong>Brand:</strong> {revision.brand?.name ?? revision.brandId}</p>
                          <p><strong>Contact:</strong> {revision.contact?.name ?? revision.contactId}</p>
                          <p><strong>Assigned To:</strong> {revision.assignee?.name ?? revision.assignedTo}</p>
                          <p><strong>Last Contact:</strong> {formatDateDDMonYYYY(revision.lastContactDate)}</p>
                          <p><strong>Follow Up:</strong> {formatDateDDMonYYYY(revision.followUpDate)}</p>
                          <p><strong>Meeting:</strong> {formatDateDDMonYYYY(revision.meetingDate)}</p>
                          <p><strong>Actual Revenue:</strong> {formatInrCurrency(revision.actualRevenue, true)}</p>
                        </div>
                        <div className="mt-2">
                          <p className={isDarkTheme ? "text-xs font-semibold text-slate-200" : "text-xs font-semibold text-slate-700"}>Notes</p>
                          <p className={isDarkTheme ? "mt-1 whitespace-pre-wrap text-xs text-slate-300" : "mt-1 whitespace-pre-wrap text-xs text-slate-600"}>{revision.notes}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className={isDarkTheme ? "text-sm text-slate-400" : "text-sm text-slate-500"}>No revisions found for this log.</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}

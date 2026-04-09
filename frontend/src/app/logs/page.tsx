"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { persistToken } from "@/store/provider";
import {
  useCreateLogMutation,
  useDeleteLogMutation,
  useListBrandsQuery,
  useListLogsQuery,
  useUpdateLogMutation,
} from "@/store/services/api";
import type { RootState } from "@/store";
import type { LogStatus, Priority } from "@/types/api";
import { LOG_STATUSES, PRIORITIES } from "@/types/api";

type Notice = { type: "success" | "error"; text: string };

function getErrorMessage(error: unknown): string {
  const fallback = "Something went wrong. Please try again.";
  if (!error || typeof error !== "object") return fallback;
  const e = error as { data?: { message?: string }; error?: string; status?: number };
  if (e.data?.message) return e.data.message;
  if (e.error) return e.error;
  if (e.status) return `Request failed with status ${e.status}.`;
  return fallback;
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  return (
    <div
      className={`flex items-center justify-between rounded-md border px-4 py-2 text-sm ${
        notice.type === "success"
          ? "border-green-300 bg-green-50 text-green-800"
          : "border-red-300 bg-red-50 text-red-800"
      }`}
    >
      <span>{notice.text}</span>
      <button onClick={onDismiss} className="ml-4 font-bold opacity-60 hover:opacity-100">
        x
      </button>
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

function TableLoading({ cols }: { cols: number }) {
  return (
    <TR>
      <TD colSpan={cols} className="py-4 text-center text-slate-400">
        Loading...
      </TD>
    </TR>
  );
}

function TableError({ cols, onRetry }: { cols: number; onRetry?: () => void }) {
  return (
    <TR>
      <TD colSpan={cols} className="py-4 text-center text-red-600">
        Failed to load.{" "}
        {onRetry && (
          <button onClick={onRetry} className="underline hover:opacity-70">
            Retry
          </button>
        )}
      </TD>
    </TR>
  );
}

function TableEmpty({ cols, message = "No records yet." }: { cols: number; message?: string }) {
  return (
    <TR>
      <TD colSpan={cols} className="py-4 text-center text-slate-400">
        {message}
      </TD>
    </TR>
  );
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

export default function LogsPage() {
  const token = useSelector((state: RootState) => state.auth.token);
  const initialized = useSelector((state: RootState) => state.auth.initialized);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  const [logTitle, setLogTitle] = useState("");
  const [logBrandId, setLogBrandId] = useState("");
  const [logStatus, setLogStatus] = useState<LogStatus | "">("");
  const [logPriority, setLogPriority] = useState<Priority | "">("");
  const [logErrors, setLogErrors] = useState<Record<string, string>>({});

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogTitle, setEditLogTitle] = useState("");
  const [editLogBrandId, setEditLogBrandId] = useState("");
  const [editLogStatus, setEditLogStatus] = useState<LogStatus | "">("");
  const [editLogPriority, setEditLogPriority] = useState<Priority | "">("");
  const [editLogErrors, setEditLogErrors] = useState<Record<string, string>>({});

  const brands = useListBrandsQuery(undefined, { skip: !token });
  const logs = useListLogsQuery(undefined, { skip: !token });
  const [createLog, createLogState] = useCreateLogMutation();
  const [deleteLog] = useDeleteLogMutation();
  const [updateLog, updateLogState] = useUpdateLogMutation();

  useEffect(() => {
    const stored = window.localStorage.getItem("venta-dashboard-theme");
    if (stored === "light" || stored === "dark" || stored === "system") setThemeMode(stored);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(media.matches);
    const onSystemThemeChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  function onThemeChange(value: "light" | "dark" | "system") {
    setThemeMode(value);
    window.localStorage.setItem("venta-dashboard-theme", value);
  }

  async function onCreateLog(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!logTitle.trim()) errs.title = "Title is required";
    if (!logBrandId) errs.brandId = "Select a brand";
    if (!logStatus) errs.status = "Status is required";
    if (!logPriority) errs.priority = "Priority is required";
    setLogErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      await createLog({
        title: logTitle.trim(),
        brandId: logBrandId,
        status: logStatus as LogStatus,
        priority: logPriority as Priority,
      }).unwrap();
      setNotice({ type: "success", text: "Log created." });
      setLogTitle("");
      setLogBrandId("");
      setLogStatus("");
      setLogPriority("");
      setLogErrors({});
    } catch (err) {
      setNotice({ type: "error", text: getErrorMessage(err) });
    }
  }

  async function onDeleteLog(id: string, title: string) {
    if (!confirm(`Delete log "${title}"?`)) return;
    try {
      await deleteLog(id).unwrap();
      setNotice({ type: "success", text: "Log deleted." });
    } catch (err) {
      setNotice({ type: "error", text: getErrorMessage(err) });
    }
  }

  function onOpenEditLog(id: string) {
    const log = logs.data?.find((item) => item.id === id);
    if (!log) return;
    setEditingLogId(log.id);
    setEditLogTitle(log.title ?? "");
    setEditLogBrandId(log.brandId ?? "");
    setEditLogStatus(log.status ?? "");
    setEditLogPriority(log.priority ?? "");
    setEditLogErrors({});
  }

  function onCloseEditLog() {
    setEditingLogId(null);
    setEditLogErrors({});
  }

  async function onUpdateLog(e: FormEvent) {
    e.preventDefault();
    if (!editingLogId) return;
    const errs: Record<string, string> = {};
    if (!editLogTitle.trim()) errs.title = "Title is required";
    if (!editLogBrandId) errs.brandId = "Select a brand";
    if (!editLogStatus) errs.status = "Status is required";
    if (!editLogPriority) errs.priority = "Priority is required";
    setEditLogErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      await updateLog({
        id: editingLogId,
        title: editLogTitle.trim(),
        brandId: editLogBrandId,
        status: editLogStatus as LogStatus,
        priority: editLogPriority as Priority,
      }).unwrap();
      setNotice({ type: "success", text: "Log updated." });
      onCloseEditLog();
    } catch (err) {
      setNotice({ type: "error", text: getErrorMessage(err) });
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

  return (
    <AppShell isDarkTheme={isDarkTheme}>
      <main className={isDarkTheme ? "min-h-screen bg-slate-950 text-slate-100" : "min-h-screen bg-slate-100"}>
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
          {notice && <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20 lg:col-span-1" : "lg:col-span-1"}>
              <CardHeader><CardTitle>New Log</CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={onCreateLog} noValidate>
                  <div className="space-y-1">
                    <Label htmlFor="logTitle">Title *</Label>
                    <Input id="logTitle" value={logTitle} onChange={(e) => setLogTitle(e.target.value)} className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined} />
                    <FieldError msg={logErrors.title} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="logBrand">Brand *</Label>
                    <select id="logBrand" value={logBrandId} onChange={(e) => setLogBrandId(e.target.value)} className={isDarkTheme ? "ui-native-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "ui-native-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"}>
                      <option value="">Select brand...</option>
                      {brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <FieldError msg={logErrors.brandId} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="logStatus">Status *</Label>
                    <Select id="logStatus" value={logStatus} onChange={setLogStatus} options={LOG_STATUSES} placeholder="Select..." className={isDarkTheme ? "ui-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"} />
                    <FieldError msg={logErrors.status} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="logPriority">Priority *</Label>
                    <Select id="logPriority" value={logPriority} onChange={setLogPriority} options={PRIORITIES} placeholder="Select..." className={isDarkTheme ? "ui-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"} />
                    <FieldError msg={logErrors.priority} />
                  </div>
                  <Button className={isDarkTheme ? "w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "w-full"} disabled={createLogState.isLoading}>
                    {createLogState.isLoading ? "Saving..." : "Create Log"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20 lg:col-span-2" : "lg:col-span-2"}>
              <CardHeader><CardTitle>Logs</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <THead>
                    <TR><TH>Title</TH><TH>Status</TH><TH>Priority</TH><TH>Brand</TH><TH>Assignee</TH><TH></TH></TR>
                  </THead>
                  <TBody>
                    {logs.isLoading && <TableLoading cols={6} />}
                    {logs.isError && <TableError cols={6} onRetry={() => logs.refetch()} />}
                    {logs.data?.length === 0 && <TableEmpty cols={6} message="No logs yet." />}
                    {logs.data?.map((l) => (
                      <TR key={l.id}>
                        <TD className="font-medium">{l.title}</TD>
                        <TD><span className={`rounded px-1.5 py-0.5 text-xs font-medium ${l.status === "CLOSED_WON" ? "bg-green-100 text-green-700" : l.status === "CLOSED_LOST" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{statusLabel(l.status)}</span></TD>
                        <TD><span className={`rounded px-1.5 py-0.5 text-xs font-medium ${l.priority === "HIGH" ? "bg-red-100 text-red-700" : l.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{l.priority}</span></TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>{l.brand?.name ?? l.brandId}</TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>{l.assignee?.name ?? l.assignedTo}</TD>
                        <TD>
                          <div className="flex items-center gap-3">
                            <button onClick={() => onOpenEditLog(l.id)} className={isDarkTheme ? "text-xs text-cyan-300 hover:underline" : "text-xs text-blue-600 hover:underline"}>Edit</button>
                            <button onClick={() => onDeleteLog(l.id, l.title)} className="text-xs text-red-500 hover:underline">Delete</button>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>

        {editingLogId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div className={isDarkTheme ? "w-full max-w-xl rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/50" : "w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className={isDarkTheme ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"}>Edit Log</h3>
                <button type="button" onClick={onCloseEditLog} className={isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}>Close</button>
              </div>
              <form className="space-y-3" onSubmit={onUpdateLog} noValidate>
                <div className="space-y-1">
                  <Label htmlFor="editLogTitle">Title *</Label>
                  <Input id="editLogTitle" value={editLogTitle} onChange={(e) => setEditLogTitle(e.target.value)} className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined} />
                  <FieldError msg={editLogErrors.title} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogBrand">Brand *</Label>
                  <select id="editLogBrand" value={editLogBrandId} onChange={(e) => setEditLogBrandId(e.target.value)} className={isDarkTheme ? "ui-native-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "ui-native-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"}>
                    <option value="">Select brand...</option>
                    {brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <FieldError msg={editLogErrors.brandId} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogStatus">Status *</Label>
                  <Select id="editLogStatus" value={editLogStatus} onChange={setEditLogStatus} options={LOG_STATUSES} className={isDarkTheme ? "ui-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"} />
                  <FieldError msg={editLogErrors.status} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editLogPriority">Priority *</Label>
                  <Select id="editLogPriority" value={editLogPriority} onChange={setEditLogPriority} options={PRIORITIES} className={isDarkTheme ? "ui-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30" : "ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"} />
                  <FieldError msg={editLogErrors.priority} />
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
      </main>
    </AppShell>
  );
}

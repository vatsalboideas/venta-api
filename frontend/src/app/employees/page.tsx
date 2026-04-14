"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSelector } from "react-redux";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { persistToken } from "@/store/provider";
import { useCreateInternMutation, useListUsersQuery, useMeQuery } from "@/store/services/api";
import type { RootState } from "@/store";

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

function roleLabel(role: string) {
  const map: Record<string, string> = { BOSS: "Boss", EMPLOYEE: "Employee", INTERN: "Intern" };
  return map[role] ?? role;
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

export default function EmployeesPage() {
  const token = useSelector((state: RootState) => state.auth.token);
  const initialized = useSelector((state: RootState) => state.auth.initialized);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">(() => {
    if (typeof window === "undefined") return "system";
    const stored = window.localStorage.getItem("venta-dashboard-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [createdByMeOnly, setCreatedByMeOnly] = useState(false);
  const [showCreateInternModal, setShowCreateInternModal] = useState(false);

  const createInternForm = useForm<{
    name: string;
    email: string;
    password: string;
    phone: string;
    department: string;
    position: string;
  }>({ defaultValues: { name: "", email: "", password: "", phone: "", department: "", position: "" } });

  const me = useMeQuery(undefined, { skip: !token });
  const users = useListUsersQuery({ createdByMe: createdByMeOnly }, { skip: !token });
  const [createIntern, createInternState] = useCreateInternMutation();

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  function onThemeChange(value: "light" | "dark" | "system") {
    setThemeMode(value);
    window.localStorage.setItem("venta-dashboard-theme", value);
  }

  async function onCreateIntern(values: {
    name: string;
    email: string;
    password: string;
    phone: string;
    department: string;
    position: string;
  }) {
    try {
      await createIntern({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password.trim(),
        phone: values.phone.trim() || undefined,
        department: values.department.trim() || undefined,
        position: values.position.trim() || undefined,
      }).unwrap();
      setNotice({ type: "success", text: "Intern created successfully." });
      createInternForm.reset();
      setShowCreateInternModal(false);
    } catch (err) {
      setNotice({ type: "error", text: getErrorMessage(err) });
    }
  }

  function onOpenCreateInternModal() {
    createInternForm.reset();
    setShowCreateInternModal(true);
  }

  function onCloseCreateInternModal() {
    setShowCreateInternModal(false);
    createInternForm.reset();
  }

  const isDarkTheme = themeMode === "dark" || (themeMode === "system" && systemPrefersDark);

  const title = useMemo(
    () => (createdByMeOnly ? "Employees & Interns Created by Me" : "All Employees & Interns"),
    [createdByMeOnly],
  );

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
          <CardHeader>
            <CardTitle>Please sign in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">You need an active session before opening employees.</p>
            <Link href="/">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <AppShell isDarkTheme={isDarkTheme}>
      <main className={isDarkTheme ? "min-h-screen bg-slate-950 text-slate-100" : "min-h-screen bg-slate-100"}>
        <header className={isDarkTheme ? "border-b border-white/10 bg-slate-900 px-6 py-3 shadow-sm shadow-black/20" : "border-b bg-white px-6 py-3 shadow-sm"}>
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={isDarkTheme ? "text-lg font-bold text-white" : "text-lg font-bold text-slate-900"}>Venta</span>
              <span className={isDarkTheme ? "text-slate-500" : "text-slate-400"}>|</span>
              <span className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-700"}>Employees</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={themeMode}
                onChange={(e) => onThemeChange(e.target.value as "light" | "dark" | "system")}
                className={isDarkTheme
                  ? "h-10 rounded-md border border-white/15 bg-slate-800 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                  : "h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"}
                aria-label="Theme mode"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <Button
                variant="outline"
                className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}
                onClick={() => persistToken(null)}
              >
                Logout
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 p-6">
          {notice && <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />}

          <div className="grid gap-6">
            <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20" : undefined}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>{title}</CardTitle>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={createdByMeOnly}
                        onChange={(e) => setCreatedByMeOnly(e.target.checked)}
                      />
                      <span className={isDarkTheme ? "text-slate-300" : "text-slate-600"}>Created by me</span>
                    </label>
                    <Button
                      className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined}
                      onClick={onOpenCreateInternModal}
                    >
                      Add New Employee
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className={isDarkTheme ? "mb-4 text-xs text-slate-400" : "mb-4 text-xs text-slate-500"}>
                  Logged in as: {me.data?.name ?? "Unknown user"}
                </p>
                <Table>
                  <THead>
                    <TR>
                      <TH>Name</TH>
                      <TH>Role</TH>
                      <TH>Email</TH>
                      <TH>Department</TH>
                      <TH>Position</TH>
                      <TH>Added by</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {users.isLoading ? (
                      <TR>
                        <TD colSpan={6} className="py-4 text-center text-slate-400">Loading...</TD>
                      </TR>
                    ) : null}
                    {users.isError ? (
                      <TR>
                        <TD colSpan={6} className="py-4 text-center text-red-600">
                          Failed to load.{" "}
                          <button onClick={() => users.refetch()} className="underline hover:opacity-70">
                            Retry
                          </button>
                        </TD>
                      </TR>
                    ) : null}
                    {users.data?.length === 0 ? (
                      <TR>
                        <TD colSpan={6} className="py-4 text-center text-slate-400">No users found.</TD>
                      </TR>
                    ) : null}
                    {users.data?.map((user) => (
                      <TR key={user.id}>
                        <TD className="font-medium">{user.name}</TD>
                        <TD>{roleLabel(user.role)}</TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>{user.email}</TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>{user.department ?? "-"}</TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>{user.position ?? "-"}</TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>
                          {user.creator?.name ?? (user.createdBy ? user.createdBy : "-")}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>

        {showCreateInternModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div
              className={
                isDarkTheme
                  ? "w-full max-w-xl rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/50"
                  : "w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
              }
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className={isDarkTheme ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"}>
                  Add New Intern
                </h3>
                <button
                  type="button"
                  onClick={onCloseCreateInternModal}
                  className={isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}
                >
                  Close
                </button>
              </div>

              <form className="space-y-3" onSubmit={createInternForm.handleSubmit(onCreateIntern)} noValidate>
                <div className="space-y-1">
                  <Label htmlFor="internName">Name *</Label>
                  <Input
                    id="internName"
                    placeholder="Intern name"
                    {...createInternForm.register("name", { required: "Name is required" })}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={createInternForm.formState.errors.name?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="internEmail">Email *</Label>
                  <Input
                    id="internEmail"
                    type="email"
                    placeholder="intern@company.com"
                    {...createInternForm.register("email", {
                      required: "Email is required",
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
                    })}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={createInternForm.formState.errors.email?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="internPassword">Password *</Label>
                  <Input
                    id="internPassword"
                    type="password"
                    placeholder="At least 8 characters"
                    {...createInternForm.register("password", {
                      required: "Password is required",
                      minLength: { value: 8, message: "Password must be at least 8 characters" },
                    })}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={createInternForm.formState.errors.password?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="internPhone">Phone</Label>
                  <Input
                    id="internPhone"
                    placeholder="+91 98765 43210"
                    {...createInternForm.register("phone")}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="internDepartment">Department</Label>
                  <Input
                    id="internDepartment"
                    placeholder="Sales"
                    {...createInternForm.register("department")}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="internPosition">Position</Label>
                  <Input
                    id="internPosition"
                    placeholder="Sales Intern"
                    {...createInternForm.register("position")}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}
                    onClick={onCloseCreateInternModal}
                  >
                    Cancel
                  </Button>
                  <Button className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined} disabled={createInternState.isLoading}>
                    {createInternState.isLoading ? "Saving..." : "Create Intern"}
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

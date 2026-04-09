"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/layout/app-shell";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { persistToken } from "@/store/provider";
import {
  useConversionRateQuery,
  useDeleteBrandMutation,
  useDeleteLogMutation,
  useLeaderboardQuery,
  useListBrandsQuery,
  useListLogsQuery,
  useLoginMutation,
  useMeQuery,
  useRevenueTrendQuery,
  useVerifyTwoFAMutation,
} from "@/store/services/api";
import type { RootState } from "@/store";

// ── Helpers ───────────────────────────────────────────────────────────────────

type Notice = { type: "success" | "error"; text: string };
type ThemeMode = "light" | "dark" | "system";

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

function statusLabel(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Notice banner with auto-dismiss ──────────────────────────────────────────

function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [notice, onDismiss]);

  return (
    <div
      className={`flex items-center justify-between rounded-md border px-4 py-2 text-sm ${
        notice.type === "success"
          ? "border-green-300 bg-green-50 text-green-800"
          : "border-red-300 bg-red-50 text-red-800"
      }`}
    >
      <span>{notice.text}</span>
      <button onClick={onDismiss} className="ml-4 font-bold opacity-60 hover:opacity-100">×</button>
    </div>
  );
}

// ── Table state rows ──────────────────────────────────────────────────────────

function TableLoading({ cols }: { cols: number }) {
  return (
    <TR>
      <TD colSpan={cols} className="py-4 text-center text-slate-400">
        Loading…
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

// ── Select helper ─────────────────────────────────────────────────────────────

function Select<T extends string>({
  id, value, onChange, options, placeholder,
}: {
  id?: string;
  value: T | "";
  onChange: (v: T) => void;
  options: readonly T[];
  placeholder?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>{statusLabel(o)}</option>
      ))}
    </select>
  );
}

// ── Field error helper ────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

// ── LOGIN / REGISTER page ──────────────────────────────────────────────────────

function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [otp, setOtp] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [login, loginState] = useLoginMutation();
  const [verify2FA, verify2FAState] = useVerifyTwoFAMutation();

  function validateLogin() {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email";
    if (!password) errs.password = "Password is required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    if (!validateLogin()) return;
    // Always reset stale 2FA challenge before a fresh login attempt.
    setTempToken("");
    setOtp("");
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.otp;
      return next;
    });
    try {
      const response = await login({ email, password }).unwrap();
      if (response.requiresTwoFactor) {
        setTempToken(response.tempToken);
        setNotice({ type: "success", text: "Password verified. Enter your 2FA code." });
        return;
      }
      persistToken(response.accessToken);
    } catch (error) {
      setTempToken("");
      setOtp("");
      setNotice({ type: "error", text: getErrorMessage(error) });
    }
  }

  async function onVerify2FA(e: FormEvent) {
    e.preventDefault();
    if (!otp.trim()) { setFieldErrors({ otp: "Code is required" }); return; }
    try {
      const response = await verify2FA({ tempToken, token: otp }).unwrap();
      persistToken(response.accessToken);
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error) });
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 p-6 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-20%] h-144 w-xl -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-[-25%] right-[-8%] h-104 w-104 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <section className="hidden w-full max-w-sm space-y-4 pr-10 lg:block">
          <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs tracking-wide text-cyan-200">
            Venta CRM Platform
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-white">
            Welcome back.
            <span className="mt-1 block text-cyan-300">Let&apos;s grow your pipeline.</span>
          </h1>
          <p className="text-sm text-slate-300">
            Track brands, manage contacts, and keep your team focused with secure access and fast insights.
          </p>
        </section>

        <Card className="w-full max-w-md border border-white/10 bg-slate-900/85 text-slate-100 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardHeader className="space-y-1 border-b border-white/10 pb-4">
            <CardTitle className="text-xl text-white">Sign in</CardTitle>
            <p className="text-sm text-slate-300">Enter your credentials to continue.</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {notice && <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />}

            <form className="space-y-4" onSubmit={onLogin} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-200">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-lg border-white/15 bg-slate-800/90 px-3.5 text-[15px] text-slate-100 placeholder:text-slate-400 shadow-sm transition focus-visible:border-cyan-400 focus-visible:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400/25"
                />
                <FieldError msg={fieldErrors.email} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-200">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-lg border-white/15 bg-slate-800/90 px-3.5 pr-16 text-[15px] text-slate-100 placeholder:text-slate-400 shadow-sm transition focus-visible:border-cyan-400 focus-visible:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400/25"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-300 transition hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <FieldError msg={fieldErrors.password} />
              </div>
              <Button className="w-full" disabled={loginState.isLoading}>
                {loginState.isLoading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            {tempToken && (
              <form className="space-y-3 rounded-md border border-white/10 bg-slate-900/70 p-4" onSubmit={onVerify2FA} noValidate>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Two-factor authentication</p>
                <div className="space-y-1.5">
                  <Label htmlFor="otp" className="text-slate-200">Authenticator Code</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="h-11 rounded-lg border-white/15 bg-slate-800/90 px-3.5 text-[15px] text-slate-100 placeholder:text-slate-400 shadow-sm transition focus-visible:border-cyan-400 focus-visible:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400/25"
                  />
                  <FieldError msg={fieldErrors.otp} />
                </div>
                <Button className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400" disabled={verify2FAState.isLoading}>
                  {verify2FAState.isLoading ? "Verifying…" : "Verify 2FA"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  // ── Queries
  const me = useMeQuery();
  const brands = useListBrandsQuery();
  const logs = useListLogsQuery();
  const trend = useRevenueTrendQuery();
  const conversion = useConversionRateQuery();
  const leaderboard = useLeaderboardQuery();

  // ── Mutations
  const [deleteBrand] = useDeleteBrandMutation();
  const [deleteLog] = useDeleteLogMutation();
  function setNoticeAuto(n: Notice) {
    setNotice(n);
  }

  async function onDeleteBrand(id: string, name: string) {
    if (!confirm(`Delete brand "${name}"? This will also delete related contacts and logs.`)) return;
    try {
      await deleteBrand(id).unwrap();
      setNoticeAuto({ type: "success", text: "Brand deleted." });
    } catch (err) {
      setNoticeAuto({ type: "error", text: getErrorMessage(err) });
    }
  }

  async function onDeleteLog(id: string, title: string) {
    if (!confirm(`Delete log "${title}"?`)) return;
    try {
      await deleteLog(id).unwrap();
      setNoticeAuto({ type: "success", text: "Log deleted." });
    } catch (err) {
      setNoticeAuto({ type: "error", text: getErrorMessage(err) });
    }
  }

  const totalRevenue = leaderboard.data?.reduce((s, r) => s + r.totalRevenue, 0) ?? 0;
  const isDarkTheme = themeMode === "dark" || (themeMode === "system" && systemPrefersDark);

  useEffect(() => {
    const stored = window.localStorage.getItem("venta-dashboard-theme");
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeMode(stored);
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(media.matches);

    const onSystemThemeChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  function onThemeChange(value: ThemeMode) {
    setThemeMode(value);
    window.localStorage.setItem("venta-dashboard-theme", value);
  }

  return (
    <AppShell isDarkTheme={isDarkTheme}>
      <main className={isDarkTheme ? "dashboard-dark min-h-screen bg-slate-950 text-slate-100" : "dashboard-light min-h-screen bg-slate-100"}>
      {/* ── Header ── */}
      <header className={isDarkTheme ? "border-b border-white/10 bg-slate-900 px-6 py-3 shadow-sm shadow-black/20" : "border-b bg-white px-6 py-3 shadow-sm"}>
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={isDarkTheme ? "text-lg font-bold text-white" : "text-lg font-bold text-slate-900"}>Venta</span>
            {me.data && (
              <>
                <span className={isDarkTheme ? "text-slate-500" : "text-slate-400"}>|</span>
                <span className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-700"}>{me.data.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  me.data.role === "BOSS"
                    ? isDarkTheme ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-800"
                    : me.data.role === "EMPLOYEE"
                    ? isDarkTheme ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-800"
                    : isDarkTheme ? "bg-slate-700 text-slate-200" : "bg-slate-100 text-slate-700"
                }`}>
                  {roleLabel(me.data.role)}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/settings">
              <Button
                variant="outline"
                className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}
              >
                Settings
              </Button>
            </Link>
            <select
              value={themeMode}
              onChange={(e) => onThemeChange(e.target.value as ThemeMode)}
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
        {/* Global notice */}
        {notice && <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />}

        {/* ── KPI Row ── */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex flex-col gap-1 pt-5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Conversion Rate</span>
              <span className="text-3xl font-bold text-slate-900">
                {conversion.isLoading ? "–" : `${(conversion.data?.conversionRatePercent ?? 0).toFixed(1)}%`}
              </span>
              <span className="text-xs text-slate-400">
                {conversion.data ? `${conversion.data.closedWonLogs} / ${conversion.data.totalLogs} closed won` : ""}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 pt-5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Revenue</span>
              <span className="text-3xl font-bold text-slate-900">
                {leaderboard.isLoading ? "–" : `$${totalRevenue.toLocaleString()}`}
              </span>
              <span className="text-xs text-slate-400">sum of all closed revenue</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 pt-5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Revenue Buckets</span>
              <span className="text-3xl font-bold text-slate-900">
                {trend.isLoading ? "–" : (trend.data?.length ?? 0)}
              </span>
              <span className="text-xs text-slate-400">monthly data points</span>
            </CardContent>
          </Card>
        </section>

        {/* ── Brands ── */}
        <div className="grid gap-6">
          <Card>
            <CardHeader><CardTitle>Brands</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4 flex justify-end">
                <Link href="/brands">
                  <Button variant="outline" className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}>
                    Manage Brands
                  </Button>
                </Link>
              </div>
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Priority</TH>
                    <TH>Industry</TH>
                    <TH>Expected Rev.</TH>
                    <TH>Owner</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <TBody>
                  {brands.isLoading && <TableLoading cols={6} />}
                  {brands.isError && <TableError cols={6} onRetry={() => brands.refetch()} />}
                  {brands.data?.length === 0 && <TableEmpty cols={6} message="No brands yet. Create one to get started." />}
                  {brands.data?.map((b) => (
                    <TR key={b.id}>
                      <TD className="font-medium">{b.name}</TD>
                      <TD>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          b.priority === "HIGH" ? "bg-red-100 text-red-700"
                          : b.priority === "MEDIUM" ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                        }`}>{b.priority}</span>
                      </TD>
                      <TD className="text-slate-500">{b.industry ?? "–"}</TD>
                      <TD>${Number(b.expectedRevenue).toLocaleString()}</TD>
                      <TD className="text-slate-500">{b.owner?.name ?? b.ownerId}</TD>
                      <TD>
                        <button
                          onClick={() => onDeleteBrand(b.id, b.name)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* ── Logs ── */}
        <div className="grid gap-6">
          <Card>
            <CardHeader><CardTitle>Logs</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4 flex justify-end">
                <Link href="/logs">
                  <Button variant="outline" className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}>
                    Manage Logs
                  </Button>
                </Link>
              </div>
              <Table>
                <THead>
                  <TR>
                    <TH>Title</TH>
                    <TH>Status</TH>
                    <TH>Priority</TH>
                    <TH>Brand</TH>
                    <TH>Assignee</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <TBody>
                  {logs.isLoading && <TableLoading cols={6} />}
                  {logs.isError && <TableError cols={6} onRetry={() => logs.refetch()} />}
                  {logs.data?.length === 0 && <TableEmpty cols={6} message="No logs yet." />}
                  {logs.data?.map((l) => (
                    <TR key={l.id}>
                      <TD className="font-medium">{l.title}</TD>
                      <TD>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          l.status === "CLOSED_WON" ? "bg-green-100 text-green-700"
                          : l.status === "CLOSED_LOST" ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-600"
                        }`}>{statusLabel(l.status)}</span>
                      </TD>
                      <TD>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          l.priority === "HIGH" ? "bg-red-100 text-red-700"
                          : l.priority === "MEDIUM" ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                        }`}>{l.priority}</span>
                      </TD>
                      <TD className="text-slate-500">{l.brand?.name ?? l.brandId}</TD>
                      <TD className="text-slate-500">{l.assignee?.name ?? l.assignedTo}</TD>
                      <TD>
                        <button onClick={() => onDeleteLog(l.id, l.title)} className="text-xs text-red-500 hover:underline">
                          Delete
                        </button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* ── Analytics: Leaderboard ── */}
        <Card>
          <CardHeader><CardTitle>Revenue Leaderboard</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Rank</TH>
                  <TH>User</TH>
                  <TH>Total Revenue</TH>
                </TR>
              </THead>
              <TBody>
                {leaderboard.isLoading && <TableLoading cols={3} />}
                {leaderboard.isError && <TableError cols={3} onRetry={() => leaderboard.refetch()} />}
                {leaderboard.data?.length === 0 && <TableEmpty cols={3} message="No revenue data yet." />}
                {leaderboard.data?.map((r) => (
                  <TR key={r.userId}>
                    <TD>
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        r.rank === 1 ? "bg-amber-100 text-amber-700"
                        : r.rank === 2 ? "bg-slate-200 text-slate-700"
                        : r.rank === 3 ? "bg-orange-100 text-orange-700"
                        : "bg-slate-100 text-slate-500"
                      }`}>{r.rank}</span>
                    </TD>
                    <TD className="font-medium">{r.userName}</TD>
                    <TD>${r.totalRevenue.toLocaleString()}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      </main>
    </AppShell>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const token = useSelector((state: RootState) => state.auth.token);
  const initialized = useSelector((state: RootState) => state.auth.initialized);

  if (!initialized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
      </main>
    );
  }

  return token ? <Dashboard /> : <AuthPage />;
}

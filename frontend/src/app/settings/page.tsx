"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import Skeleton from "react-loading-skeleton";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/layout/app-shell";
import { notifyError, notifySuccess } from "@/lib/toast";
import { persistToken } from "@/store/provider";
import {
  useDisable2FAMutation,
  useMeQuery,
  useSetup2FAMutation,
  useVerifySetup2FAMutation,
} from "@/store/services/api";
import type { RootState } from "@/store";

function roleLabel(role: string) {
  const map: Record<string, string> = { BOSS: "Boss", MANAGER: "Manager", EMPLOYEE: "Employee", INTERN: "Intern" };
  return map[role] ?? role;
}

function extractSecretFromOtpAuth(otpauthUrl: string): string {
  try {
    const url = new URL(otpauthUrl);
    return url.searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

export default function SettingsPage() {
  const token = useSelector((state: RootState) => state.auth.token);
  const initialized = useSelector((state: RootState) => state.auth.initialized);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">(() => {
    if (typeof window === "undefined") return "system";
    const stored = window.localStorage.getItem("venta-dashboard-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  const me = useMeQuery(undefined, { skip: !token });
  const [setup2FA, setup2FAState] = useSetup2FAMutation();
  const [verifySetup2FA, verifySetup2FAState] = useVerifySetup2FAMutation();
  const [disable2FA, disable2FAState] = useDisable2FAMutation();
  const setupOtpForm = useForm<{ token: string }>({ defaultValues: { token: "" } });
  const disableOtpForm = useForm<{ token: string }>({ defaultValues: { token: "" } });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  function onThemeChange(value: "light" | "dark" | "system") {
    setThemeMode(value);
    window.localStorage.setItem("venta-dashboard-theme", value);
    window.dispatchEvent(new CustomEvent("venta-theme-change", { detail: value }));
    notifySuccess("Theme preference saved.");
  }

  async function onStart2FASetup() {
    try {
      const response = await setup2FA().unwrap();
      setQrCodeDataUrl(response.qrCodeDataUrl);
      setOtpauthUrl(response.otpauthUrl);
      setupOtpForm.reset({ token: "" });
      notifySuccess("2FA setup started. Scan the QR and verify code.");
      await me.refetch();
    } catch (err) {
      notifyError(getErrorMessage(err, "Start 2FA setup failed"));
    }
  }

  async function onVerify2FASetup(values: { token: string }) {
    if (!values.token.trim()) {
      notifyError("Please enter the authenticator code.");
      return;
    }
    try {
      const result = await verifySetup2FA({ token: values.token.trim() }).unwrap();
      notifySuccess(result.message || "2FA enabled successfully.");
      setQrCodeDataUrl("");
      setOtpauthUrl("");
      setupOtpForm.reset({ token: "" });
      await me.refetch();
    } catch (err) {
      notifyError(getErrorMessage(err, "Verify 2FA setup failed"));
    }
  }

  async function onDisable2FA(values: { token: string }) {
    if (!values.token.trim()) {
      notifyError("Please enter your authenticator code.");
      return;
    }
    try {
      const result = await disable2FA({ token: values.token.trim() }).unwrap();
      notifySuccess(result.message || "2FA disabled successfully.");
      disableOtpForm.reset({ token: "" });
      await me.refetch();
    } catch (err) {
      notifyError(getErrorMessage(err, "Disable 2FA failed"));
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
          <CardHeader>
            <CardTitle>Please sign in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              You need an active session before opening settings.
            </p>
            <Link href="/">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const isDarkTheme = themeMode === "dark" || (themeMode === "system" && systemPrefersDark);
  const skeletonThemeStyle: CSSProperties | undefined = isDarkTheme
    ? ({ "--base-color": "#1e293b", "--highlight-color": "#334155" } as CSSProperties)
    : undefined;

  return (
    <AppShell isDarkTheme={isDarkTheme}>
      <main className={isDarkTheme ? "min-h-screen bg-slate-950 text-slate-100" : "min-h-screen bg-slate-100"} style={skeletonThemeStyle}>
      <header className={isDarkTheme ? "border-b border-white/10 bg-slate-900 px-6 py-3 shadow-sm shadow-black/20" : "border-b bg-white px-6 py-3 shadow-sm"}>
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={isDarkTheme ? "text-lg font-bold text-white" : "text-lg font-bold text-slate-900"}>Venta</span>
            <span className={isDarkTheme ? "text-slate-500" : "text-slate-400"}>|</span>
            <span className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-700"}>Settings</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}>
                Back to Dashboard
              </Button>
            </Link>
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

      <div className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[240px_1fr]">
        <aside className={isDarkTheme ? "h-fit rounded-lg border border-white/10 bg-slate-900 p-3 shadow-sm shadow-black/20" : "h-fit rounded-lg border bg-white p-3 shadow-sm"}>
          <p className={isDarkTheme ? "px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400" : "px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"}>
            Settings Menu
          </p>
          <nav className="space-y-1">
            <a
              href="#user-settings"
              className={isDarkTheme ? "block rounded-md bg-cyan-500/20 px-3 py-2 text-sm font-medium text-cyan-200" : "block rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"}
            >
              User Settings
            </a>
            <a
              href="#security"
              className={isDarkTheme ? "block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800" : "block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"}
            >
              Security
            </a>
            <a
              href="#preferences"
              className={isDarkTheme ? "block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800" : "block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"}
            >
              Preferences
            </a>
            <a
              href="#notifications"
              className={isDarkTheme ? "block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800" : "block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"}
            >
              Notifications
            </a>
          </nav>
        </aside>

        <section className="space-y-6">
          <Card id="user-settings" className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20" : undefined}>
            <CardHeader>
              <CardTitle>User Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-600"}>
                Update user-related preferences here. Profile update API is not available yet, so this section currently shows your live account details.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className={isDarkTheme ? "rounded-md border border-white/10 bg-slate-800/70 p-4" : "rounded-md border border-slate-200 bg-slate-50 p-4"}>
                  <p className={isDarkTheme ? "text-xs font-semibold uppercase tracking-wide text-slate-400" : "text-xs font-semibold uppercase tracking-wide text-slate-500"}>Profile</p>
                  <div className={isDarkTheme ? "mt-2 space-y-1 text-sm text-slate-200" : "mt-2 space-y-1 text-sm text-slate-700"}>
                    {me.isLoading ? (
                      <Skeleton height={14} count={5} />
                    ) : (
                      <>
                        <p>
                          <span className="font-medium">Name:</span> {me.data?.name ?? "—"}
                        </p>
                        <p>
                          <span className="font-medium">Email:</span> {me.data?.email ?? "—"}
                        </p>
                        <p>
                          <span className="font-medium">Role:</span> {me.data ? roleLabel(me.data.role) : "—"}
                        </p>
                        <p>
                          <span className="font-medium">Department:</span> {me.data?.department ?? "—"}
                        </p>
                        <p>
                          <span className="font-medium">Position:</span> {me.data?.position ?? "—"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className={isDarkTheme ? "rounded-md border border-white/10 bg-slate-800/70 p-4" : "rounded-md border border-slate-200 bg-slate-50 p-4"}>
                  <p className={isDarkTheme ? "text-xs font-semibold uppercase tracking-wide text-slate-400" : "text-xs font-semibold uppercase tracking-wide text-slate-500"}>Status</p>
                  <div className={isDarkTheme ? "mt-2 space-y-1 text-sm text-slate-200" : "mt-2 space-y-1 text-sm text-slate-700"}>
                    <p>
                      <span className="font-medium">Session:</span> Active
                    </p>
                    <p>
                      <span className="font-medium">Two-factor authentication:</span>{" "}
                      <span className={me.data?.twoFAEnabled ? "text-green-700" : "text-amber-700"}>
                        {me.data?.twoFAEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="security" className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20" : undefined}>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-600"}>Manage Google Authenticator based 2FA for your account.</p>
              {!me.data?.twoFAEnabled ? (
                <Button
                  className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined}
                  onClick={onStart2FASetup}
                  disabled={setup2FAState.isLoading}
                >
                  {setup2FAState.isLoading ? "Generating QR..." : "Set up 2FA"}
                </Button>
              ) : null}

              {qrCodeDataUrl ? (
                <div className={isDarkTheme ? "rounded-md border border-white/10 bg-slate-800/70 p-4" : "rounded-md border border-slate-200 bg-slate-50 p-4"}>
                  <p className={isDarkTheme ? "text-sm font-medium text-white" : "text-sm font-medium text-slate-900"}>Enable Google Authenticator</p>
                  <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
                    <Image
                      src={qrCodeDataUrl}
                      alt="QR code for 2FA setup"
                      width={160}
                      height={160}
                      unoptimized
                      className={isDarkTheme ? "h-40 w-40 rounded border border-slate-700 bg-white p-2" : "h-40 w-40 rounded border border-slate-300 bg-white p-2"}
                    />
                    <form className="w-full max-w-sm space-y-2" onSubmit={setupOtpForm.handleSubmit(onVerify2FASetup)}>
                      <Label htmlFor="setupOtp">Authenticator code</Label>
                      <Input
                        id="setupOtp"
                        inputMode="numeric"
                        placeholder="6-digit code"
                        {...setupOtpForm.register("token")}
                        className={isDarkTheme ? "border-white/15 bg-slate-900 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                      />
                      <Button className={isDarkTheme ? "w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "w-full"} disabled={verifySetup2FAState.isLoading}>
                        {verifySetup2FAState.isLoading ? "Verifying..." : "Verify & Enable 2FA"}
                      </Button>
                    </form>
                  </div>
                  {otpauthUrl ? (
                    <p className={isDarkTheme ? "mt-3 text-xs text-slate-300" : "mt-3 text-xs text-slate-600"}>
                      Manual secret: <span className="font-mono">{extractSecretFromOtpAuth(otpauthUrl) || "Unavailable"}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              {me.data?.twoFAEnabled ? (
                <form className={isDarkTheme ? "max-w-sm space-y-2 rounded-md border border-white/10 bg-slate-800/70 p-4" : "max-w-sm space-y-2 rounded-md border border-slate-200 bg-slate-50 p-4"} onSubmit={disableOtpForm.handleSubmit(onDisable2FA)}>
                  <Label htmlFor="disableOtp">Disable 2FA (enter current code)</Label>
                  <Input
                    id="disableOtp"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    {...disableOtpForm.register("token")}
                    className={isDarkTheme ? "border-white/15 bg-slate-900 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <Button
                    variant="outline"
                    className={isDarkTheme ? "w-full border-white/20 bg-slate-900 text-slate-100 hover:bg-slate-700" : "w-full"}
                    disabled={disable2FAState.isLoading}
                  >
                    {disable2FAState.isLoading ? "Disabling..." : "Disable 2FA"}
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>

          <Card id="preferences" className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20" : undefined}>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="themeMode">Theme Mode</Label>
              <select
                id="themeMode"
                value={themeMode}
                onChange={(e) => onThemeChange(e.target.value as "light" | "dark" | "system")}
                className={isDarkTheme
                  ? "ui-native-select flex h-10 w-full max-w-xs rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                  : "ui-native-select flex h-10 w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </CardContent>
          </Card>

          <Card id="notifications" className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20" : undefined}>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-600"}>
                Notification settings flow is reserved in the sidebar and can be added next.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
      </main>
    </AppShell>
  );
}

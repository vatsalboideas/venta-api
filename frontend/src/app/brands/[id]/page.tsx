"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSelector } from "react-redux";
import Skeleton from "react-loading-skeleton";

import { AppShell } from "@/components/layout/app-shell";
import { GlobalSearch } from "@/components/layout/global-search";
import { formatInrCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { persistToken } from "@/store/provider";
import { useGetBrandQuery, useListLogsQuery } from "@/store/services/api";
import type { RootState } from "@/store";

function formatDateDDMonYYYY(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function BrandDetailsPage() {
  const params = useParams<{ id: string }>();
  const brandId = params?.id;

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
  const [logSearchInput, setLogSearchInput] = useState("");
  const [debouncedLogSearch, setDebouncedLogSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [visibleLimit, setVisibleLimit] = useState(10);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lastRequestedLimitRef = useRef(10);
  const page = 1;

  const brand = useGetBrandQuery(brandId ?? "", { skip: !token || !brandId });
  const logs = useListLogsQuery(
    brandId
      ? {
          brandId,
          q: debouncedLogSearch || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          sort: sortOrder,
          page,
          limit: visibleLimit,
        }
      : undefined,
    { skip: !token || !brandId },
  );

  const hasMore = (logs.data?.length ?? 0) >= visibleLimit;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedLogSearch(logSearchInput), 300);
    return () => clearTimeout(timer);
  }, [logSearchInput]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore || logs.isLoading || logs.isFetching) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          if (lastRequestedLimitRef.current === visibleLimit) {
            lastRequestedLimitRef.current = visibleLimit + 10;
            setVisibleLimit((prev) => prev + 10);
          }
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, logs.isLoading, logs.isFetching, visibleLimit]);

  function resetLogPagination() {
    lastRequestedLimitRef.current = 10;
    setVisibleLimit(10);
  }

  function onThemeChange(value: "light" | "dark" | "system") {
    setThemeMode(value);
    window.localStorage.setItem("venta-dashboard-theme", value);
    window.dispatchEvent(new CustomEvent("venta-theme-change", { detail: value }));
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
            <p className="text-sm text-slate-600">You need an active session before opening brand details.</p>
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
          <div className="mx-auto flex max-w-7xl items-center gap-4">
            <div className="flex items-center gap-3">
              <span className={isDarkTheme ? "text-lg font-bold text-white" : "text-lg font-bold text-slate-900"}>Venta</span>
              <span className={isDarkTheme ? "text-slate-500" : "text-slate-400"}>|</span>
              <span className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-700"}>Brand Details</span>
            </div>
            <div className="flex-1">
              <GlobalSearch isDarkTheme={isDarkTheme} />
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

        <div className="mx-auto max-w-5xl space-y-6 p-6">
          <div className="flex items-center justify-between">
            <Link href="/brands" className={isDarkTheme ? "text-sm text-cyan-300 hover:underline" : "text-sm text-blue-600 hover:underline"}>
              Back to brands
            </Link>
          </div>

          {brand.isLoading ? (
            <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100" : undefined}>
              <CardContent className="space-y-2 p-6">
                <Skeleton height={24} width="45%" />
                <Skeleton height={16} count={5} />
              </CardContent>
            </Card>
          ) : null}

          {brand.isError ? (
            <Card className={isDarkTheme ? "border-red-500/30 bg-red-950/20 text-red-200" : "border-red-200 bg-red-50 text-red-700"}>
              <CardContent className="p-6 text-sm">
                Failed to load brand details.{" "}
                <button className="underline hover:opacity-70" onClick={() => brand.refetch()}>
                  Retry
                </button>
              </CardContent>
            </Card>
          ) : null}

          {brand.data ? (
            <div className="grid gap-6 lg:grid-cols-10">
              <div className="space-y-6 lg:col-span-3">
                <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100" : undefined}>
                  <CardHeader>
                    <CardTitle>{brand.data.name}</CardTitle>
                  </CardHeader>
                  <CardContent className={isDarkTheme ? "space-y-2 text-sm text-slate-200" : "space-y-2 text-sm text-slate-700"}>
                    <p><span className="font-medium">Industry:</span> {brand.data.industry}</p>
                    <p><span className="font-medium">Priority:</span> {brand.data.priority}</p>
                    <p><span className="font-medium">Forecast Category:</span> {brand.data.forecastCategory}</p>
                    <p><span className="font-medium">Expected Revenue:</span> {formatInrCurrency(brand.data.expectedRevenue)}</p>
                    <p><span className="font-medium">Website:</span> {brand.data.website || "-"}</p>
                    <p><span className="font-medium">Description:</span> {brand.data.description || "-"}</p>
                  </CardContent>
                </Card>

                <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100" : undefined}>
                  <CardHeader>
                    <CardTitle>Owner</CardTitle>
                  </CardHeader>
                  <CardContent className={isDarkTheme ? "space-y-2 text-sm text-slate-200" : "space-y-2 text-sm text-slate-700"}>
                    <p><span className="font-medium">Name:</span> {brand.data.owner?.name ?? "-"}</p>
                    <p><span className="font-medium">Email:</span> {brand.data.owner?.email ?? "-"}</p>
                    <p><span className="font-medium">Role:</span> {brand.data.owner?.role ?? "-"}</p>
                  </CardContent>
                </Card>

                <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100" : undefined}>
                  <CardHeader>
                    <CardTitle>Contacts ({brand.data.contacts?.length ?? 0})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(brand.data.contacts?.length ?? 0) === 0 ? (
                      <p className={isDarkTheme ? "text-sm text-slate-400" : "text-sm text-slate-500"}>No contacts linked to this brand.</p>
                    ) : (
                      <div className="grid gap-3 grid-cols-1">
                        {brand.data.contacts?.map((contact) => (
                          <div
                            key={contact.id}
                            className={isDarkTheme ? "min-w-0 rounded-md border border-white/10 bg-slate-800/70 p-3 text-sm text-slate-200" : "min-w-0 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700"}
                          >
                            <p className="truncate font-medium" title={contact.name}>{contact.name}</p>
                            <p className="break-words">{contact.position || "-"}</p>
                            <p className="break-all" title={contact.email || ""}>{contact.email || "-"}</p>
                            <p className="break-all" title={contact.phone || ""}>{contact.phone || "-"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 lg:col-span-7" : "lg:col-span-7"}>
                <CardHeader>
                  <CardTitle>Brand Logs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={logSearchInput}
                      onChange={(e) => {
                        setLogSearchInput(e.target.value);
                        resetLogPagination();
                      }}
                      placeholder="Search logs by title, notes, status, contact..."
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                    />
                    <select
                      value={sortOrder}
                      onChange={(e) => {
                        setSortOrder(e.target.value as "latest" | "oldest");
                        resetLogPagination();
                      }}
                      className={isDarkTheme
                        ? "h-10 rounded-md border border-white/15 bg-slate-800 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                        : "h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"}
                    >
                      <option value="latest">Latest First</option>
                      <option value="oldest">Oldest First</option>
                    </select>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => {
                        setFromDate(e.target.value);
                        resetLogPagination();
                      }}
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                    />
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => {
                        setToDate(e.target.value);
                        resetLogPagination();
                      }}
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                    />
                  </div>
                  {logs.isLoading ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="rounded-md border border-slate-200 p-4">
                          <Skeleton height={18} width="70%" />
                          <Skeleton height={14} count={4} className="mt-2" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {logs.isError ? (
                    <p className={isDarkTheme ? "text-sm text-red-300" : "text-sm text-red-600"}>
                      Failed to load logs.{" "}
                      <button onClick={() => logs.refetch()} className="underline hover:opacity-70">
                        Retry
                      </button>
                    </p>
                  ) : null}
                  {!logs.isLoading && !logs.isError && (logs.data?.length ?? 0) === 0 ? (
                    <p className={isDarkTheme ? "text-sm text-slate-400" : "text-sm text-slate-500"}>
                      No logs found for this brand.
                    </p>
                  ) : null}
                  {!logs.isLoading && !logs.isError && (logs.data?.length ?? 0) > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {logs.data?.map((log) => (
                        <div
                          key={log.id}
                          className={isDarkTheme ? "rounded-md border border-white/10 bg-slate-800/70 p-4 text-sm" : "rounded-md border border-slate-200 bg-white p-4 text-sm"}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={isDarkTheme ? "line-clamp-2 font-semibold text-slate-100" : "line-clamp-2 font-semibold text-slate-900"}>
                              {log.title}
                            </p>
                            <span className={isDarkTheme ? "rounded-full bg-cyan-500/20 px-2 py-0.5 text-[11px] font-medium text-cyan-200" : "rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700"}>
                              Open
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                              log.priority === "HIGH" ? "bg-red-100 text-red-700"
                              : log.priority === "MEDIUM" ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                            }`}>
                              {log.priority}
                            </span>
                            <span className={isDarkTheme ? "rounded bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-200" : "rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"}>
                              {log.status}
                            </span>
                          </div>
                          <div className={isDarkTheme ? "mt-3 space-y-1 text-xs text-slate-300" : "mt-3 space-y-1 text-xs text-slate-600"}>
                            <p>Contact: {log.contact?.name ?? "-"}</p>
                            <p>Revenue: {formatInrCurrency(log.actualRevenue ?? 0)}</p>
                            <p>
                              Created:{" "}
                              {formatDateDDMonYYYY(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {logs.isFetching && hasMore ? (
                        <Skeleton height={16} width={140} />
                      ) : null}
                      <div ref={sentinelRef} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSelector } from "react-redux";
import Skeleton from "react-loading-skeleton";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInrCurrency } from "@/lib/currency";
import { formatDateDDMonYYYY } from "@/lib/date";
import { persistToken } from "@/store/provider";
import { useListLogsQuery } from "@/store/services/api";
import type { RootState } from "@/store";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type CalendarEvent = {
  id: string;
  date: Date;
  title: string;
  type: "meeting" | "follow-up" | "last-contact";
  priority: "low" | "medium" | "high";
  sourceLogId: string;
};

type CalendarDateField = "all" | "followUpDate" | "meetingDate" | "lastContactDate";

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function CalendarPage() {
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
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [calendarDateField, setCalendarDateField] = useState<CalendarDateField>("all");
  const [yearInput, setYearInput] = useState(() => String(new Date().getFullYear()));

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  const isDarkTheme = themeMode === "dark" || (themeMode === "system" && systemPrefersDark);
  const skeletonThemeStyle: CSSProperties | undefined = isDarkTheme
    ? ({ "--base-color": "#1e293b", "--highlight-color": "#334155" } as CSSProperties)
    : undefined;

  const days = useMemo(() => {
    const firstDayOfMonth = startOfMonth(activeMonth);
    const firstGridDay = new Date(firstDayOfMonth);
    const firstWeekday = firstDayOfMonth.getDay();
    firstGridDay.setDate(firstGridDay.getDate() - firstWeekday);
    const daysInMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0).getDate();
    const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: cellCount }, (_, index) => {
      const date = new Date(firstGridDay);
      date.setDate(firstGridDay.getDate() + index);
      return {
        date,
        isCurrentMonth: date.getMonth() === activeMonth.getMonth(),
        isToday: isSameDay(date, new Date()),
        isSelected: isSameDay(date, selectedDate),
      };
    });
  }, [activeMonth, selectedDate]);

  const monthStart = useMemo(
    () => new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1),
    [activeMonth],
  );
  const monthEnd = useMemo(
    () => new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 0, 23, 59, 59, 999),
    [activeMonth],
  );
  const logs = useListLogsQuery(
    {
      fromDate: toYMD(monthStart),
      toDate: toYMD(monthEnd),
      dateField: calendarDateField,
    },
    { skip: !token },
  );

  const monthEvents = useMemo<CalendarEvent[]>(() => {
    const events: CalendarEvent[] = [];
    for (const log of logs.data ?? []) {
      const priority = log.priority.toLowerCase() as "low" | "medium" | "high";
      const entries: Array<{ dateText?: string; type: CalendarEvent["type"] }> =
        calendarDateField === "all"
          ? [
              { dateText: log.followUpDate, type: "follow-up" },
              { dateText: log.meetingDate, type: "meeting" },
              { dateText: log.lastContactDate, type: "last-contact" },
            ]
          : [
              {
                dateText:
                  calendarDateField === "meetingDate"
                    ? log.meetingDate
                    : calendarDateField === "lastContactDate"
                      ? log.lastContactDate
                      : log.followUpDate,
                type:
                  calendarDateField === "meetingDate"
                    ? "meeting"
                    : calendarDateField === "lastContactDate"
                      ? "last-contact"
                      : "follow-up",
              },
            ];

      for (const entry of entries) {
        if (!entry.dateText) continue;
        const date = new Date(entry.dateText);
        if (Number.isNaN(date.getTime())) continue;
        if (date < monthStart || date > monthEnd) continue;
        events.push({
          id: `${log.id}-${entry.type}-${date.toISOString()}`,
          date,
          title: log.title?.trim() || "Log",
          type: entry.type,
          priority,
          sourceLogId: log.id,
        });
      }
    }
    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [calendarDateField, logs.data, monthEnd, monthStart]);

  const eventsByDateKey = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of monthEvents) {
      const key = event.date.toISOString().slice(0, 10);
      const list = grouped.get(key);
      if (list) {
        list.push(event);
      } else {
        grouped.set(key, [event]);
      }
    }
    return grouped;
  }, [monthEvents]);

  const monthlySummary = useMemo(() => {
    const meetings = monthEvents.filter((event) => event.type === "meeting").length;
    const followUps = monthEvents.filter((event) => event.type === "follow-up").length;
    const lastContacts = monthEvents.filter((event) => event.type === "last-contact").length;
    return {
      totalEvents: monthEvents.length,
      meetings,
      followUps,
      lastContacts,
    };
  }, [monthEvents]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return monthEvents.filter((event) => event.date >= now);
  }, [monthEvents]);

  const selectedDateEvents = useMemo(() => {
    const key = selectedDate.toISOString().slice(0, 10);
    const events = eventsByDateKey.get(key) ?? [];
    const logById = new Map((logs.data ?? []).map((log) => [log.id, log]));
    return events.map((event) => ({
      event,
      log: logById.get(event.sourceLogId),
    }));
  }, [eventsByDateKey, logs.data, selectedDate]);

  useEffect(() => {
    if (!isDateModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDateModalOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDateModalOpen]);

  useEffect(() => {
    setYearInput(String(activeMonth.getFullYear()));
  }, [activeMonth]);

  function onThemeChange(value: "light" | "dark" | "system") {
    setThemeMode(value);
    window.localStorage.setItem("venta-dashboard-theme", value);
    window.dispatchEvent(new CustomEvent("venta-theme-change", { detail: value }));
  }

  const yearOptions = useMemo(() => {
    return Array.from({ length: 301 }, (_, index) => 1900 + index);
  }, []);

  function applyYearFromInput(rawValue: string) {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed)) {
      setYearInput(String(activeMonth.getFullYear()));
      return;
    }
    setActiveMonth(new Date(parsed, activeMonth.getMonth(), 1));
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
            <p className="text-sm text-slate-600">You need an active session before opening the calendar.</p>
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
      <main className={isDarkTheme ? "min-h-screen bg-slate-950 text-slate-100" : "min-h-screen bg-slate-100"} style={skeletonThemeStyle}>
        <header className={isDarkTheme ? "border-b border-white/10 bg-slate-900 px-6 py-3 shadow-sm shadow-black/20" : "border-b bg-white px-6 py-3 shadow-sm"}>
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={isDarkTheme ? "text-lg font-bold text-white" : "text-lg font-bold text-slate-900"}>Venta</span>
              <span className={isDarkTheme ? "text-slate-500" : "text-slate-400"}>|</span>
              <span className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-700"}>Calendar</span>
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

        <div className="mx-auto max-w-7xl p-5 md:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className={isDarkTheme ? "text-2xl font-semibold text-white" : "text-2xl font-semibold text-slate-900"}>
                Calendar
              </h1>
              <p className={isDarkTheme ? "text-sm text-slate-400" : "text-sm text-slate-500"}>
                View your meetings and follow-ups
              </p>
            </div>
            <Button
              variant="outline"
              className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-200 hover:bg-slate-700" : undefined}
              onClick={() => {
                const today = new Date();
                setActiveMonth(startOfMonth(today));
                setSelectedDate(today);
              }}
            >
              Today
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100" : "border-slate-200 bg-white"}>
              <CardHeader className={isDarkTheme ? "border-b border-white/10" : "border-b border-slate-200"}>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 hover:bg-slate-700" : "h-9 w-9 p-0"}
                    onClick={() => setActiveMonth((prev) => shiftMonth(prev, -1))}
                    aria-label="Previous month"
                  >
                    ‹
                  </Button>
                  <CardTitle className={isDarkTheme ? "text-xl text-white" : "text-xl text-slate-900"}>
                    {activeMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
                  </CardTitle>
                  <Button
                    variant="outline"
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 hover:bg-slate-700" : "h-9 w-9 p-0"}
                    onClick={() => setActiveMonth((prev) => shiftMonth(prev, 1))}
                    aria-label="Next month"
                  >
                    ›
                  </Button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <select
                    value={activeMonth.getMonth()}
                    onChange={(e) =>
                      setActiveMonth(
                        new Date(activeMonth.getFullYear(), Number(e.target.value), 1),
                      )
                    }
                    className={isDarkTheme
                      ? "h-9 rounded-md border border-white/15 bg-slate-800 px-2.5 text-xs text-slate-100"
                      : "h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700"}
                    aria-label="Select month"
                  >
                    {MONTH_OPTIONS.map((monthName, idx) => (
                      <option key={monthName} value={idx}>
                        {monthName}
                      </option>
                    ))}
                  </select>
                  <input
                    list="calendar-year-options"
                    value={yearInput}
                    onChange={(e) => setYearInput(e.target.value)}
                    onBlur={(e) => applyYearFromInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        applyYearFromInput(yearInput);
                      }
                    }}
                    inputMode="numeric"
                    placeholder="Type year"
                    className={isDarkTheme
                      ? "h-9 rounded-md border border-white/15 bg-slate-800 px-2.5 text-xs text-slate-100"
                      : "h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700"}
                    aria-label="Type or select year"
                  />
                  <datalist id="calendar-year-options">
                    {yearOptions.map((year) => (
                      <option key={year} value={year} />
                    ))}
                  </datalist>
                  <select
                    value={calendarDateField}
                    onChange={(e) => setCalendarDateField(e.target.value as CalendarDateField)}
                    className={isDarkTheme
                      ? "h-9 rounded-md border border-white/15 bg-slate-800 px-2.5 text-xs text-slate-100"
                      : "h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700"}
                    aria-label="Calendar date filter"
                  >
                    <option value="all">All Dates</option>
                    <option value="followUpDate">Follow-up Date</option>
                    <option value="meetingDate">Meeting Date</option>
                    <option value="lastContactDate">Last Contact Date</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-7 gap-1 pb-1">
                  {WEEKDAY_LABELS.map((label) => (
                    <div
                      key={label}
                      className={isDarkTheme ? "px-2 py-1 text-center text-xs text-slate-400" : "px-2 py-1 text-center text-xs text-slate-500"}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {days.map((day) => {
                    const key = day.date.toISOString().slice(0, 10);
                    const dateEvents = day.isCurrentMonth ? (eventsByDateKey.get(key) ?? []) : [];
                    return (
                      <button
                        type="button"
                        key={day.date.toISOString()}
                        onClick={() => {
                          setSelectedDate(day.date);
                          setIsDateModalOpen(true);
                        }}
                        className={`h-22 rounded-md border p-2 text-left transition ${
                          day.isSelected
                            ? isDarkTheme
                              ? "border-cyan-400/70 bg-cyan-500/10"
                              : "border-cyan-300 bg-cyan-50"
                            : isDarkTheme
                              ? "border-white/10 bg-slate-900/50 hover:bg-slate-800/70"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={[
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                            day.isToday
                              ? "bg-cyan-500 text-slate-950"
                              : day.isCurrentMonth
                                ? isDarkTheme
                                  ? "text-slate-100"
                                  : "text-slate-900"
                                : isDarkTheme
                                  ? "text-slate-500"
                                  : "text-slate-400",
                          ].join(" ")}
                        >
                          {day.date.getDate()}
                        </span>
                        <div className="mt-1 space-y-1">
                          {dateEvents.length > 0 ? (
                            <p className={isDarkTheme ? "text-[10px] text-cyan-300" : "text-[10px] text-cyan-700"}>
                              {dateEvents.length} event{dateEvents.length > 1 ? "s" : ""}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100" : "border-slate-200 bg-white"}>
                <CardHeader className="pb-2">
                  <CardTitle className={isDarkTheme ? "text-lg text-white" : "text-lg text-slate-900"}>This Month</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center justify-between text-sm">
                    <span className={isDarkTheme ? "text-slate-400" : "text-slate-500"}>Total Events</span>
                    <span className={isDarkTheme ? "font-semibold text-white" : "font-semibold text-slate-900"}>
                      {monthlySummary.totalEvents}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={isDarkTheme ? "text-slate-400" : "text-slate-500"}>Meetings</span>
                    <span className={isDarkTheme ? "font-semibold text-white" : "font-semibold text-slate-900"}>
                      {monthlySummary.meetings}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={isDarkTheme ? "text-slate-400" : "text-slate-500"}>Follow-ups</span>
                    <span className={isDarkTheme ? "font-semibold text-white" : "font-semibold text-slate-900"}>
                      {monthlySummary.followUps}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className={isDarkTheme ? "text-slate-400" : "text-slate-500"}>Last Contact</span>
                    <span className={isDarkTheme ? "font-semibold text-white" : "font-semibold text-slate-900"}>
                      {monthlySummary.lastContacts}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100" : "border-slate-200 bg-white"}>
                <CardHeader className="pb-2">
                  <CardTitle className={isDarkTheme ? "text-lg text-white" : "text-lg text-slate-900"}>
                    Upcoming Events
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {logs.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton height={14} count={4} />
                    </div>
                  ) : null}
                  {logs.isError ? (
                    <p className="text-sm text-red-500">Failed to load events from logs.</p>
                  ) : null}
                  {upcomingEvents.map((event) => {
                    const priorityTone =
                      event.priority === "high"
                        ? isDarkTheme
                          ? "border-red-500/40 bg-red-500/10"
                          : "border-red-200 bg-red-50"
                        : event.priority === "medium"
                          ? isDarkTheme
                            ? "border-amber-500/40 bg-amber-500/10"
                            : "border-amber-200 bg-amber-50"
                          : isDarkTheme
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : "border-emerald-200 bg-emerald-50";

                    return (
                      <div key={event.id} className={`rounded-md border p-3 ${priorityTone}`}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className={isDarkTheme ? "text-xs text-slate-300" : "text-xs text-slate-500"}>
                            {isSameDay(event.date, new Date()) &&
                            event.date.getMonth() === new Date().getMonth() &&
                            event.date.getFullYear() === new Date().getFullYear()
                              ? "Today"
                              : formatDateDDMonYYYY(event.date)}
                          </span>
                          <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] uppercase text-slate-600">
                            {event.priority}
                          </span>
                        </div>
                        <p className={isDarkTheme ? "text-sm font-medium text-white" : "text-sm font-medium text-slate-900"}>
                          {event.title}
                        </p>
                        <p className={isDarkTheme ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                          {event.type === "meeting"
                            ? "Meeting"
                            : event.type === "last-contact"
                              ? "Last Contact"
                              : "Follow-up"}
                        </p>
                      </div>
                    );
                  })}
                  {upcomingEvents.length === 0 ? (
                    <p className={isDarkTheme ? "text-sm text-slate-400" : "text-sm text-slate-500"}>
                      No upcoming events.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {isDateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className={isDarkTheme ? "w-full max-w-2xl rounded-xl border border-white/10 bg-slate-900 p-4 shadow-2xl shadow-black/50" : "w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"}
            role="dialog"
            aria-modal="true"
            aria-label="Date events details"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className={isDarkTheme ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"}>
                  Events on {formatDateDDMonYYYY(selectedDate)}
                </h3>
                <p className={isDarkTheme ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                  {selectedDateEvents.length} event{selectedDateEvents.length === 1 ? "" : "s"} scheduled
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDateModalOpen(false)}
                className={isDarkTheme ? "rounded-full px-2 text-slate-300 hover:bg-slate-800 hover:text-white" : "rounded-full px-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"}
                aria-label="Close date details"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {selectedDateEvents.length === 0 ? (
                <div className={isDarkTheme ? "rounded-lg border border-white/10 bg-slate-800/60 p-4 text-sm text-slate-300" : "rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"}>
                  No logs scheduled for this date.
                </div>
              ) : (
                selectedDateEvents.map(({ event, log }) => {
                  const priorityTone =
                    event.priority === "high"
                      ? "bg-red-100 text-red-700"
                      : event.priority === "medium"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700";
                  const typeTone = event.type === "meeting"
                    ? "bg-blue-100 text-blue-700"
                    : event.type === "last-contact"
                      ? "bg-violet-100 text-violet-700"
                      : "bg-orange-100 text-orange-700";

                  return (
                    <div
                      key={event.id}
                      className={isDarkTheme ? "rounded-lg border border-white/10 bg-slate-800/80 p-3" : "rounded-lg border border-slate-200 bg-white p-3"}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-medium ${typeTone}`}>
                          {event.type === "meeting"
                            ? "Meeting"
                            : event.type === "last-contact"
                              ? "Last Contact"
                              : "Follow-up"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 font-medium ${priorityTone}`}>
                          {event.priority}
                        </span>
                        <span className={isDarkTheme ? "text-slate-400" : "text-slate-500"}>
                          {log?.status?.replace(/_/g, " ").toLowerCase() ?? "scheduled"}
                        </span>
                      </div>
                      <p className={isDarkTheme ? "text-base font-semibold text-white" : "text-base font-semibold text-slate-900"}>
                        {event.title}
                      </p>
                      <div className={isDarkTheme ? "mt-2 space-y-1 text-xs text-slate-300" : "mt-2 space-y-1 text-xs text-slate-600"}>
                        <p><span className="font-semibold">Brand:</span> {log?.brand?.name ?? log?.brandId ?? "-"}</p>
                        <p><span className="font-semibold">Type:</span> {event.type === "meeting" ? "Call / Meeting" : event.type === "last-contact" ? "Last Contact" : "Follow-up"}</p>
                        <p className={isDarkTheme ? "rounded-md bg-slate-700/60 px-2 py-1 text-slate-300" : "rounded-md bg-slate-100 px-2 py-1 text-slate-600"}>
                          Notes: {log?.notes || "No notes"}
                        </p>
                        <p><span className="font-semibold">Expected Revenue:</span> {formatInrCurrency(log?.brand?.expectedRevenue ?? log?.expectedRevenue ?? 0)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

type AppShellProps = {
  children: ReactNode;
  isDarkTheme?: boolean;
};

export function AppShell({ children, isDarkTheme = false }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("venta-sidebar-collapsed") === "1";
  });

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("venta-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  const baseItem = isDarkTheme
    ? "block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
    : "block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100";
  const activeItem = isDarkTheme
    ? "block rounded-md bg-cyan-500/20 px-3 py-2 text-sm font-medium text-cyan-200"
    : "block rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white";

  return (
    <div className={isDarkTheme ? "h-screen overflow-hidden bg-slate-950 text-slate-100" : "h-screen overflow-hidden bg-slate-100"}>
      <div className="mx-auto flex h-full max-w-[1800px]">
        <aside
          className={`flex shrink-0 flex-col border-r transition-all duration-200 ${
            collapsed ? "w-[76px]" : "w-[260px]"
          } ${
            isDarkTheme
              ? "border-white/10 bg-slate-900"
              : "border-slate-200 bg-white"
          } h-screen overflow-y-auto`}
        >
          <div className="flex items-center justify-between p-3">
            {!collapsed && (
              <span className={isDarkTheme ? "px-1 text-sm font-semibold text-white" : "px-1 text-sm font-semibold text-slate-900"}>
                Venta Menu
              </span>
            )}
            <button
              type="button"
              onClick={toggleSidebar}
              className={isDarkTheme ? "rounded-md border border-white/15 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800" : "rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? ">" : "<"}
            </button>
          </div>

          <nav className="space-y-1 px-3">
            <Link href="/" className={pathname === "/" ? activeItem : baseItem}>
              {collapsed ? "D" : "Dashboard"}
            </Link>
            <Link href="/brands" className={pathname === "/brands" ? activeItem : baseItem}>
              {collapsed ? "B" : "Brands"}
            </Link>
            <Link href="/contacts" className={pathname === "/contacts" ? activeItem : baseItem}>
              {collapsed ? "C" : "Contacts"}
            </Link>
            <Link href="/employees" className={pathname === "/employees" ? activeItem : baseItem}>
              {collapsed ? "E" : "Employees"}
            </Link>
            <Link href="/logs" className={pathname === "/logs" ? activeItem : baseItem}>
              {collapsed ? "L" : "Logs"}
            </Link>
          </nav>

          <div className="mt-auto px-3 pb-4">
            <Link href="/settings" className={pathname === "/settings" ? activeItem : baseItem}>
              {collapsed ? "S" : "Settings"}
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1 h-screen overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

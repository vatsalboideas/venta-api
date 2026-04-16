"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Skeleton from "react-loading-skeleton";

import { useGlobalSearchQuery } from "@/store/services/api";

type GlobalSearchProps = {
  isDarkTheme?: boolean;
};

export function GlobalSearch({ isDarkTheme = false }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const trimmed = debouncedQuery.trim();

  const shouldSearch = trimmed.length >= 2;
  const search = useGlobalSearchQuery(
    { q: trimmed, limit: 5 },
    { skip: !shouldSearch },
  );

  const hasResults = useMemo(() => {
    if (!search.data) return false;
    return (
      search.data.users.length > 0 ||
      search.data.brands.length > 0 ||
      search.data.contacts.length > 0 ||
      search.data.logs.length > 0
    );
  }, [search.data]);

  const panelClass = isDarkTheme
    ? "absolute top-12 z-[121] w-full rounded-lg border border-white/10 bg-slate-900 p-3 shadow-2xl"
    : "absolute top-12 z-[121] w-full rounded-lg border border-slate-200 bg-white p-3 shadow-2xl";

  const sectionTitleClass = isDarkTheme
    ? "mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
    : "mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500";

  const itemClass = isDarkTheme
    ? "block rounded px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
    : "block rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function closeDialog() {
    setIsOpen(false);
  }
  const skeletonThemeStyle: CSSProperties | undefined = isDarkTheme
    ? ({ "--base-color": "#1e293b", "--highlight-color": "#334155" } as CSSProperties)
    : undefined;

  return (
    <div className="relative z-[121] w-full max-w-xl" style={skeletonThemeStyle}>
      {isOpen && (
        <div
          className={
            isDarkTheme
              ? "fixed inset-0 z-[120] bg-slate-950/45 backdrop-blur-lg"
              : "fixed inset-0 z-[120] bg-slate-900/25 backdrop-blur-lg"
          }
          onClick={closeDialog}
          aria-hidden="true"
        />
      )}

      <div className="relative z-[121]">
        <input
          ref={inputRef}
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          placeholder="Search users, brands, contacts, logs..."
          className={
            isDarkTheme
              ? "h-10 w-full rounded-md border border-white/15 bg-slate-800/95 px-3 text-sm text-slate-100 placeholder:text-slate-400 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
              : "h-10 w-full rounded-md border border-slate-300/90 bg-white/95 px-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
          }
          aria-label="Global search"
        />
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 text-[11px] text-slate-500">
          Ctrl/Cmd + K
        </div>
      </div>

      {isOpen && (
        <div className={panelClass}>
          <div className="mb-3 flex items-center justify-between">
            <div className={isDarkTheme ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
              {shouldSearch ? "Grouped results" : "Type at least 2 characters"}
            </div>
            <div
              className={
                isDarkTheme
                  ? "rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-300"
                  : "rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-700"
              }
            >
              Powered by Typesense
            </div>
          </div>

          {search.isFetching && (
            <div className="space-y-2">
              <Skeleton height={14} count={4} />
            </div>
          )}
          {!search.isFetching && !hasResults && shouldSearch && (
            <p className={isDarkTheme ? "text-sm text-slate-400" : "text-sm text-slate-500"}>
              No matches found.
            </p>
          )}
          {!shouldSearch && (
            <p className={isDarkTheme ? "text-sm text-slate-400" : "text-sm text-slate-500"}>
              Start typing to search across all modules.
            </p>
          )}

          {search.data?.brands.length ? (
            <section className="mb-2 border-b pb-2 last:border-b-0">
              <p className={sectionTitleClass}>Brands</p>
              {search.data.brands.map((brand) => (
                <Link key={brand.id} href={`/brands/${brand.id}`} className={itemClass} onClick={closeDialog}>
                  {brand.name} - {brand.industry}
                </Link>
              ))}
            </section>
          ) : null}
          {search.data?.logs.length ? (
            <section className="mb-2 border-b pb-2 last:border-b-0">
              <p className={sectionTitleClass}>Logs</p>
              {search.data.logs.map((log) => (
                <Link key={log.id} href="/logs" className={itemClass} onClick={closeDialog}>
                  {log.title} - {log.status.replaceAll("_", " ")}
                </Link>
              ))}
            </section>
          ) : null}
          {search.data?.contacts.length ? (
            <section className="mb-2 border-b pb-2 last:border-b-0">
              <p className={sectionTitleClass}>Contacts</p>
              {search.data.contacts.map((contact) => (
                <Link key={contact.id} href="/contacts" className={itemClass} onClick={closeDialog}>
                  {contact.name} - {contact.email}
                </Link>
              ))}
            </section>
          ) : null}
          {search.data?.users.length ? (
            <section>
              <p className={sectionTitleClass}>Employees</p>
              {search.data.users.map((user) => (
                <Link key={user.id} href="/employees" className={itemClass} onClick={closeDialog}>
                  {user.name} ({user.role}) - {user.email}
                </Link>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

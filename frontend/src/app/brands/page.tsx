"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { persistToken } from "@/store/provider";
import {
  useCreateBrandMutation,
  useDeleteBrandMutation,
  useListBrandsQuery,
  useListContactsQuery,
  useUpdateBrandMutation,
} from "@/store/services/api";
import type { RootState } from "@/store";
import type { ForecastCategory, Priority } from "@/types/api";
import { FORECAST_CATEGORIES, PRIORITIES } from "@/types/api";

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
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

export default function BrandsPage() {
  const token = useSelector((state: RootState) => state.auth.token);
  const initialized = useSelector((state: RootState) => state.auth.initialized);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  const [brandName, setBrandName] = useState("");
  const [brandPriority, setBrandPriority] = useState<Priority | "">("");
  const [brandRevenue, setBrandRevenue] = useState("");
  const [brandIndustry, setBrandIndustry] = useState("");
  const [brandForecast, setBrandForecast] = useState<ForecastCategory | "">("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPosition, setNewContactPosition] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [useExistingContacts, setUseExistingContacts] = useState(true);
  const [brandErrors, setBrandErrors] = useState<Record<string, string>>({});
  const [showCreateBrandModal, setShowCreateBrandModal] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [initialEditState, setInitialEditState] = useState<{
    name: string;
    priority: Priority | "";
    revenue: string;
    industry: string;
    forecast: ForecastCategory | "";
    useExistingContacts: boolean;
    selectedContactIds: string[];
    newContactName: string;
    newContactPosition: string;
    newContactEmail: string;
    newContactPhone: string;
  } | null>(null);
  const [contactSearchInput, setContactSearchInput] = useState("");
  const [debouncedContactSearch, setDebouncedContactSearch] = useState("");
  const [contactsVisibleCount, setContactsVisibleCount] = useState(20);
  const [isContactDropdownOpen, setIsContactDropdownOpen] = useState(false);
  const contactDropdownRef = useRef<HTMLDivElement | null>(null);

  const brands = useListBrandsQuery(undefined, { skip: !token });
  const contacts = useListContactsQuery(undefined, { skip: !token });
  const [createBrand, createBrandState] = useCreateBrandMutation();
  const [deleteBrand] = useDeleteBrandMutation();
  const [updateBrand, updateBrandState] = useUpdateBrandMutation();

  const filteredContacts = useMemo(() => {
    const term = debouncedContactSearch.trim().toLowerCase();
    if (!term) return contacts.data ?? [];
    return (contacts.data ?? []).filter((contact) => {
      const name = contact.name?.toLowerCase() ?? "";
      const email = contact.email?.toLowerCase() ?? "";
      const phone = contact.phone?.toLowerCase() ?? "";
      const brandName = contact.brand?.name?.toLowerCase() ?? "";
      return (
        name.includes(term) ||
        email.includes(term) ||
        phone.includes(term) ||
        brandName.includes(term)
      );
    });
  }, [contacts.data, debouncedContactSearch]);

  const visibleContacts = useMemo(
    () => filteredContacts.slice(0, contactsVisibleCount),
    [filteredContacts, contactsVisibleCount],
  );

  const isEditUnchanged = useMemo(() => {
    if (!editingBrandId || !initialEditState) return false;
    const currentIds = [...selectedContactIds].sort();
    const initialIds = [...initialEditState.selectedContactIds].sort();
    return (
      brandName.trim() === initialEditState.name &&
      brandPriority === initialEditState.priority &&
      brandRevenue.trim() === initialEditState.revenue &&
      brandIndustry.trim() === initialEditState.industry &&
      (brandForecast || "") === (initialEditState.forecast || "") &&
      useExistingContacts === initialEditState.useExistingContacts &&
      JSON.stringify(currentIds) === JSON.stringify(initialIds) &&
      newContactName.trim() === initialEditState.newContactName &&
      newContactPosition.trim() === initialEditState.newContactPosition &&
      newContactEmail.trim() === initialEditState.newContactEmail &&
      newContactPhone.trim() === initialEditState.newContactPhone
    );
  }, [
    editingBrandId,
    initialEditState,
    brandName,
    brandPriority,
    brandRevenue,
    brandIndustry,
    brandForecast,
    useExistingContacts,
    selectedContactIds,
    newContactName,
    newContactPosition,
    newContactEmail,
    newContactPhone,
  ]);

  useEffect(() => {
    const stored = window.localStorage.getItem("venta-dashboard-theme");
    if (stored === "light" || stored === "dark" || stored === "system") setThemeMode(stored);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(media.matches);
    const onSystemThemeChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedContactSearch(contactSearchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearchInput]);

  useEffect(() => {
    setContactsVisibleCount(20);
  }, [debouncedContactSearch, showCreateBrandModal]);

  useEffect(() => {
    if (!isContactDropdownOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!contactDropdownRef.current) return;
      const target = event.target as Node;
      if (!contactDropdownRef.current.contains(target)) {
        setIsContactDropdownOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsContactDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isContactDropdownOpen]);

  function onThemeChange(value: "light" | "dark" | "system") {
    setThemeMode(value);
    window.localStorage.setItem("venta-dashboard-theme", value);
  }

  async function onSubmitBrandForm(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!brandName.trim()) errs.brandName = "Name is required";
    if (!brandPriority) errs.brandPriority = "Priority is required";
    if (!brandIndustry.trim()) errs.brandIndustry = "Industry is required";
    if (!brandRevenue || isNaN(Number(brandRevenue)) || Number(brandRevenue) < 0) {
      errs.brandRevenue = "Enter a valid non-negative number";
    }
    if (useExistingContacts) {
      if (selectedContactIds.length === 0) {
        errs.brandContacts = "Select at least one existing contact.";
      }
    } else {
      if (!newContactName.trim()) errs.newContactName = "Name is required";
      if (!newContactPosition.trim()) errs.newContactPosition = "Position is required";
      if (!newContactEmail.trim()) errs.newContactEmail = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newContactEmail.trim())) errs.newContactEmail = "Enter a valid email";
      if (!newContactPhone.trim()) errs.newContactPhone = "Phone is required";
    }
    setBrandErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      const shouldIncludeExistingContacts =
        useExistingContacts || (Boolean(editingBrandId) && selectedContactIds.length > 0);
      const shouldIncludeNewContact = !useExistingContacts && newContactName.trim();

      const payload = {
        name: brandName.trim(),
        priority: brandPriority as Priority,
        expectedRevenue: Number(brandRevenue),
        industry: brandIndustry.trim(),
        forecastCategory: brandForecast || undefined,
        existingContactIds: shouldIncludeExistingContacts ? selectedContactIds : [],
        newContacts: shouldIncludeNewContact
          ? [{
              name: newContactName.trim(),
              position: newContactPosition.trim() || undefined,
              email: newContactEmail.trim() || undefined,
              phone: newContactPhone.trim() || undefined,
            }]
          : undefined,
      };

      if (editingBrandId) {
        await updateBrand({ id: editingBrandId, ...payload }).unwrap();
        setNotice({ type: "success", text: "Brand updated." });
      } else {
        await createBrand(payload).unwrap();
        setNotice({ type: "success", text: "Brand created." });
      }
      setBrandName("");
      setBrandPriority("");
      setBrandRevenue("");
      setBrandIndustry("");
      setBrandForecast("");
      setSelectedContactIds([]);
      setNewContactName("");
      setNewContactPosition("");
      setNewContactEmail("");
      setNewContactPhone("");
      setUseExistingContacts(true);
      setBrandErrors({});
      setShowCreateBrandModal(false);
      setEditingBrandId(null);
      setInitialEditState(null);
    } catch (err) {
      setNotice({ type: "error", text: getErrorMessage(err) });
    }
  }

  async function onDeleteBrand(id: string, name: string) {
    if (!confirm(`Delete brand "${name}"? This will also delete related contacts and logs.`)) return;
    try {
      await deleteBrand(id).unwrap();
      setNotice({ type: "success", text: "Brand deleted." });
    } catch (err) {
      setNotice({ type: "error", text: getErrorMessage(err) });
    }
  }

  function onOpenEditBrand(id: string) {
    void contacts.refetch();
    const brand = brands.data?.find((item) => item.id === id);
    if (!brand) return;
    setEditingBrandId(brand.id);
    setBrandName(brand.name ?? "");
    setBrandPriority(brand.priority ?? "");
    setBrandRevenue(String(brand.expectedRevenue ?? ""));
    setBrandIndustry(brand.industry ?? "");
    setBrandForecast(brand.forecastCategory ?? "");
    setSelectedContactIds(brand.contacts?.map((contact) => contact.id) ?? []);
    setNewContactName("");
    setNewContactPosition("");
    setNewContactEmail("");
    setNewContactPhone("");
    setUseExistingContacts(true);
    setContactSearchInput("");
    setDebouncedContactSearch("");
    setContactsVisibleCount(20);
    setIsContactDropdownOpen(false);
    setBrandErrors({});
    setInitialEditState({
      name: (brand.name ?? "").trim(),
      priority: (brand.priority ?? "") as Priority | "",
      revenue: String(brand.expectedRevenue ?? "").trim(),
      industry: (brand.industry ?? "").trim(),
      forecast: (brand.forecastCategory ?? "") as ForecastCategory | "",
      useExistingContacts: true,
      selectedContactIds: (brand.contacts?.map((contact) => contact.id) ?? []).sort(),
      newContactName: "",
      newContactPosition: "",
      newContactEmail: "",
      newContactPhone: "",
    });
    setShowCreateBrandModal(true);
  }

  function toggleContactSelection(contactId: string) {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId],
    );
  }

  function onOpenCreateBrandModal() {
    void contacts.refetch();
    setEditingBrandId(null);
    setBrandName("");
    setBrandPriority("");
    setBrandRevenue("");
    setBrandIndustry("");
    setBrandForecast("");
    setSelectedContactIds([]);
    setNewContactName("");
    setNewContactPosition("");
    setNewContactEmail("");
    setNewContactPhone("");
    setUseExistingContacts(true);
    setContactSearchInput("");
    setDebouncedContactSearch("");
    setContactsVisibleCount(20);
    setIsContactDropdownOpen(false);
    setShowCreateBrandModal(true);
    setBrandErrors({});
    setInitialEditState(null);
  }

  function onCloseCreateBrandModal() {
    setShowCreateBrandModal(false);
    setEditingBrandId(null);
    setInitialEditState(null);
    setBrandErrors({});
  }

  function removeSelectedContact(contactId: string) {
    setSelectedContactIds((prev) => prev.filter((id) => id !== contactId));
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
            <p className="text-sm text-slate-600">You need an active session before opening brands.</p>
            <Link href="/">
              <Button className="w-full">Go to Login</Button>
            </Link>
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
              <span className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-700"}>Brands</span>
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
                <CardTitle>Brands</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex justify-end">
                  <Button className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined} onClick={onOpenCreateBrandModal}>
                    Add Brand
                  </Button>
                </div>
                <Table>
                  <THead>
                    <TR>
                      <TH>Name</TH>
                      <TH>Contacts</TH>
                      <TH>Priority</TH>
                      <TH>Industry</TH>
                      <TH>Expected Rev.</TH>
                      <TH>Owner</TH>
                      <TH></TH>
                    </TR>
                  </THead>
                  <TBody>
                    {brands.isLoading && <TableLoading cols={7} />}
                    {brands.isError && <TableError cols={7} onRetry={() => brands.refetch()} />}
                    {brands.data?.length === 0 && <TableEmpty cols={7} message="No brands yet. Create one to get started." />}
                    {brands.data?.map((b) => (
                      <TR key={b.id}>
                        <TD className="font-medium">{b.name}</TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>
                          {b.contacts?.length ? b.contacts.map((c) => c.name).join(", ") : "-"}
                        </TD>
                        <TD>
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            b.priority === "HIGH" ? "bg-red-100 text-red-700"
                            : b.priority === "MEDIUM" ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                          }`}>{b.priority}</span>
                        </TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>{b.industry ?? "-"}</TD>
                        <TD>${Number(b.expectedRevenue).toLocaleString()}</TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>{b.owner?.name ?? b.ownerId}</TD>
                        <TD>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => onOpenEditBrand(b.id)}
                              className={isDarkTheme ? "text-xs text-cyan-300 hover:underline" : "text-xs text-blue-600 hover:underline"}
                            >
                              Edit
                            </button>
                            <button onClick={() => onDeleteBrand(b.id, b.name)} className="text-xs text-red-500 hover:underline">
                              Delete
                            </button>
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
        {showCreateBrandModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div
              className={
                isDarkTheme
                  ? "w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/50"
                  : "w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
              }
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className={isDarkTheme ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"}>
                  {editingBrandId ? "Edit Brand" : "Add Brand"}
                </h3>
                <button
                  type="button"
                  onClick={onCloseCreateBrandModal}
                  className={isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}
                >
                  Close
                </button>
              </div>

              <form className="space-y-3" onSubmit={onSubmitBrandForm} noValidate>
                <div className="space-y-1">
                  <Label htmlFor="brandName">Name *</Label>
                  <Input
                    id="brandName"
                    placeholder="Acme Corp"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={brandErrors.brandName} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="brandPriority">Priority *</Label>
                  <Select
                    id="brandPriority"
                    value={brandPriority}
                    onChange={setBrandPriority}
                    options={PRIORITIES}
                    placeholder="Select..."
                    className={isDarkTheme
                      ? "ui-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                      : "ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"}
                  />
                  <FieldError msg={brandErrors.brandPriority} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="brandRevenue">Expected Revenue *</Label>
                  <Input
                    id="brandRevenue"
                    type="number"
                    min="0"
                    placeholder="50000"
                    value={brandRevenue}
                    onChange={(e) => setBrandRevenue(e.target.value)}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={brandErrors.brandRevenue} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="brandIndustry">Industry *</Label>
                  <Input
                    id="brandIndustry"
                    placeholder="Technology"
                    value={brandIndustry}
                    onChange={(e) => setBrandIndustry(e.target.value)}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={brandErrors.brandIndustry} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="brandForecast">Forecast Category</Label>
                  <Select
                    id="brandForecast"
                    value={brandForecast}
                    onChange={setBrandForecast}
                    options={FORECAST_CATEGORIES}
                    placeholder="Select..."
                    className={isDarkTheme
                      ? "ui-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                      : "ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"}
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useExistingContacts}
                    onChange={(e) => setUseExistingContacts(e.target.checked)}
                  />
                  <span className={isDarkTheme ? "text-sm font-medium text-slate-100" : "text-sm font-medium text-slate-900"}>
                    Attach Existing Contacts
                  </span>
                </label>
                <div className={isDarkTheme ? "space-y-2 rounded-md border border-white/10 bg-slate-800/60 p-3" : "space-y-2 rounded-md border border-slate-200 p-3"}>
                  <p className={isDarkTheme ? "text-sm font-medium text-slate-100" : "text-sm font-medium text-slate-900"}>
                    Attach Existing Contacts
                  </p>
                  {selectedContactIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedContactIds.map((contactId) => {
                        const selected = contacts.data?.find((c) => c.id === contactId);
                        return (
                          <span
                            key={contactId}
                            className={isDarkTheme ? "inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-2 py-1 text-xs text-cyan-200" : "inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700"}
                          >
                            {selected?.name ?? contactId}
                            <button type="button" onClick={() => removeSelectedContact(contactId)} className="font-bold">
                              x
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={isDarkTheme ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                      No contacts selected.
                    </p>
                  )}

                  <div className="relative" ref={contactDropdownRef}>
                    <Input
                      value={contactSearchInput}
                      disabled={!useExistingContacts}
                      onFocus={() => setIsContactDropdownOpen(true)}
                      onChange={(e) => {
                        setContactSearchInput(e.target.value);
                        setIsContactDropdownOpen(true);
                      }}
                      placeholder="Search contacts by name, email, phone..."
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                    />
                    {isContactDropdownOpen && useExistingContacts ? (
                      <div className={isDarkTheme ? "absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-white/10 bg-slate-900 shadow-xl" : "absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl"}>
                        {visibleContacts.map((contact) => {
                          const selected = selectedContactIds.includes(contact.id);
                          return (
                            <button
                              key={contact.id}
                              type="button"
                              onClick={() => {
                                toggleContactSelection(contact.id);
                                setIsContactDropdownOpen(false);
                              }}
                              className={isDarkTheme ? "flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800" : "flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"}
                            >
                              <span>
                                {contact.name} ({contact.brand?.name ?? "Unassigned"})
                              </span>
                              {selected ? <span className={isDarkTheme ? "text-cyan-300" : "text-blue-600"}>Selected</span> : null}
                            </button>
                          );
                        })}
                        {filteredContacts.length === 0 ? (
                          <p className={isDarkTheme ? "px-3 py-2 text-xs text-slate-400" : "px-3 py-2 text-xs text-slate-500"}>
                            No contacts found.
                          </p>
                        ) : null}
                        {contactsVisibleCount < filteredContacts.length ? (
                          <button
                            type="button"
                            onClick={() => setContactsVisibleCount((prev) => prev + 20)}
                            className={isDarkTheme ? "w-full border-t border-white/10 px-3 py-2 text-xs text-cyan-300 hover:bg-slate-800" : "w-full border-t border-slate-200 px-3 py-2 text-xs text-blue-600 hover:bg-slate-100"}
                          >
                            Load more
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!useExistingContacts}
                      onClick={() => setIsContactDropdownOpen((prev) => !prev)}
                      className={isDarkTheme ? "text-xs text-slate-300 hover:text-white" : "text-xs text-slate-600 hover:text-slate-900"}
                    >
                      {isContactDropdownOpen ? "Hide contact dropdown" : "Show contact dropdown"}
                    </button>
                  </div>
                </div>
                <div className={isDarkTheme ? "space-y-2 rounded-md border border-white/10 bg-slate-800/60 p-3" : "space-y-2 rounded-md border border-slate-200 p-3"}>
                  <p className={isDarkTheme ? "text-sm font-medium text-slate-100" : "text-sm font-medium text-slate-900"}>
                    Add New Contact
                  </p>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="newContactName">Name *</Label>
                      <Input
                        id="newContactName"
                        disabled={useExistingContacts}
                        placeholder="John Doe"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                      />
                      {!useExistingContacts ? <FieldError msg={brandErrors.newContactName} /> : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="newContactPosition">Position *</Label>
                      <Input
                        id="newContactPosition"
                        disabled={useExistingContacts}
                        placeholder="Sales Manager"
                        value={newContactPosition}
                        onChange={(e) => setNewContactPosition(e.target.value)}
                        className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                      />
                      {!useExistingContacts ? <FieldError msg={brandErrors.newContactPosition} /> : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="newContactEmail">Email *</Label>
                      <Input
                        id="newContactEmail"
                        disabled={useExistingContacts}
                        type="email"
                        placeholder="name@company.com"
                        value={newContactEmail}
                        onChange={(e) => setNewContactEmail(e.target.value)}
                        className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                      />
                      {!useExistingContacts ? <FieldError msg={brandErrors.newContactEmail} /> : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="newContactPhone">Phone *</Label>
                      <Input
                        id="newContactPhone"
                        disabled={useExistingContacts}
                        placeholder="+91 98765 43210"
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                      />
                      {!useExistingContacts ? <FieldError msg={brandErrors.newContactPhone} /> : null}
                    </div>
                  </div>
                </div>
                <FieldError msg={brandErrors.brandContacts} />
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}
                    onClick={onCloseCreateBrandModal}
                  >
                    Cancel
                  </Button>
                  <Button
                    className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined}
                    disabled={createBrandState.isLoading || updateBrandState.isLoading || (Boolean(editingBrandId) && isEditUnchanged)}
                  >
                    {editingBrandId
                      ? (updateBrandState.isLoading ? "Updating..." : "Update Brand")
                      : (createBrandState.isLoading ? "Saving..." : "Create Brand")}
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

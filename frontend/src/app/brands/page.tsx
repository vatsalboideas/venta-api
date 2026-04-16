"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import Skeleton from "react-loading-skeleton";

import { AppShell } from "@/components/layout/app-shell";
import { formatInrCurrency } from "@/lib/currency";
import { getErrorMessage } from "@/lib/error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/toast";
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
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

export default function BrandsPage() {
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

  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [brandSearchInput, setBrandSearchInput] = useState("");
  const [debouncedBrandSearch, setDebouncedBrandSearch] = useState("");
  const [useExistingContacts, setUseExistingContacts] = useState(true);
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
  const brandForm = useForm<{
    brandName: string;
    brandPriority: Priority | "";
    brandRevenue: string;
    brandIndustry: string;
    brandForecast: ForecastCategory | "";
    newContactName: string;
    newContactPosition: string;
    newContactEmail: string;
    newContactPhone: string;
  }>({
    defaultValues: {
      brandName: "",
      brandPriority: "",
      brandRevenue: "",
      brandIndustry: "",
      brandForecast: "",
      newContactName: "",
      newContactPosition: "",
      newContactEmail: "",
      newContactPhone: "",
    },
  });

  const brands = useListBrandsQuery(
    debouncedBrandSearch ? { q: debouncedBrandSearch } : undefined,
    { skip: !token },
  );
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
      !brandForm.formState.isDirty &&
      useExistingContacts === initialEditState.useExistingContacts &&
      JSON.stringify(currentIds) === JSON.stringify(initialIds)
    );
  }, [
    editingBrandId,
    initialEditState,
    brandForm.formState.isDirty,
    useExistingContacts,
    selectedContactIds,
  ]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
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
    const timer = setTimeout(() => {
      setDebouncedBrandSearch(brandSearchInput);
    }, 250);
    return () => clearTimeout(timer);
  }, [brandSearchInput]);

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
    window.dispatchEvent(new CustomEvent("venta-theme-change", { detail: value }));
  }

  async function onSubmitBrandForm(values: {
    brandName: string;
    brandPriority: Priority | "";
    brandRevenue: string;
    brandIndustry: string;
    brandForecast: ForecastCategory | "";
    newContactName: string;
    newContactPosition: string;
    newContactEmail: string;
    newContactPhone: string;
  }) {
    if (useExistingContacts) {
      if (selectedContactIds.length === 0) {
        brandForm.setError("brandName", { message: "Select at least one existing contact." });
        return;
      }
    } else {
      if (!values.newContactName.trim() || !values.newContactPosition.trim() || !values.newContactEmail.trim() || !values.newContactPhone.trim()) return;
    }

    try {
      const shouldIncludeExistingContacts =
        useExistingContacts || (Boolean(editingBrandId) && selectedContactIds.length > 0);
      const shouldIncludeNewContact = !useExistingContacts && values.newContactName.trim();

      const payload = {
        name: values.brandName.trim(),
        priority: values.brandPriority as Priority,
        expectedRevenue: Number(values.brandRevenue),
        industry: values.brandIndustry.trim(),
        forecastCategory: values.brandForecast || undefined,
        existingContactIds: shouldIncludeExistingContacts ? selectedContactIds : [],
        newContacts: shouldIncludeNewContact
          ? [{
              name: values.newContactName.trim(),
              position: values.newContactPosition.trim() || undefined,
              email: values.newContactEmail.trim() || undefined,
              phone: values.newContactPhone.trim() || undefined,
            }]
          : undefined,
      };

      if (editingBrandId) {
        await updateBrand({ id: editingBrandId, ...payload }).unwrap();
        notifySuccess("Brand updated.");
      } else {
        await createBrand(payload).unwrap();
        notifySuccess("Brand created.");
      }
      brandForm.reset();
      setSelectedContactIds([]);
      setUseExistingContacts(true);
      setShowCreateBrandModal(false);
      setEditingBrandId(null);
      setInitialEditState(null);
    } catch (err) {
      notifyError(getErrorMessage(err, "Save brand failed"));
    }
  }

  async function onDeleteBrand(id: string, name: string) {
    if (!confirm(`Delete brand "${name}"? This will also delete related contacts and logs.`)) return;
    try {
      await deleteBrand(id).unwrap();
      notifySuccess("Brand deleted.");
    } catch (err) {
      notifyError(getErrorMessage(err, "Delete brand failed"));
    }
  }

  function onOpenEditBrand(id: string) {
    void contacts.refetch();
    const brand = brands.data?.find((item) => item.id === id);
    if (!brand) return;
    setEditingBrandId(brand.id);
    brandForm.reset({
      brandName: brand.name ?? "",
      brandPriority: (brand.priority ?? "") as Priority | "",
      brandRevenue: String(brand.expectedRevenue ?? ""),
      brandIndustry: brand.industry ?? "",
      brandForecast: (brand.forecastCategory ?? "") as ForecastCategory | "",
      newContactName: "",
      newContactPosition: "",
      newContactEmail: "",
      newContactPhone: "",
    });
    setSelectedContactIds(brand.contacts?.map((contact) => contact.id) ?? []);
    setUseExistingContacts(true);
    setContactSearchInput("");
    setDebouncedContactSearch("");
    setContactsVisibleCount(20);
    setIsContactDropdownOpen(false);
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
    brandForm.reset();
    setSelectedContactIds([]);
    setUseExistingContacts(true);
    setContactSearchInput("");
    setDebouncedContactSearch("");
    setContactsVisibleCount(20);
    setIsContactDropdownOpen(false);
    setShowCreateBrandModal(true);
    setInitialEditState(null);
  }

  function onCloseCreateBrandModal() {
    setShowCreateBrandModal(false);
    setEditingBrandId(null);
    setInitialEditState(null);
  }

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showCreateBrandModal) {
        onCloseCreateBrandModal();
      }
    };

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [showCreateBrandModal]);

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
          <div className="grid gap-6">
            <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20" : undefined}>
              <CardHeader>
                <CardTitle>Brands</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="w-full md:max-w-xl">
                    <Input
                      value={brandSearchInput}
                      onChange={(e) => setBrandSearchInput(e.target.value)}
                      placeholder="Search brands, industry, owner, or contacts..."
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                    />
                  </div>
                  <Button className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined} onClick={onOpenCreateBrandModal}>
                    Add Brand
                  </Button>
                </div>
                {brands.isLoading ? (
                  <div className="rounded-md border border-dashed border-slate-300 p-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="rounded-lg border border-slate-200 bg-white p-4">
                          <Skeleton height={20} width="60%" />
                          <Skeleton height={16} count={4} className="mt-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {brands.isError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
                    Failed to load brands.{" "}
                    <button onClick={() => brands.refetch()} className="underline hover:opacity-70">
                      Retry
                    </button>
                  </div>
                ) : null}
                {!brands.isLoading && !brands.isError && brands.data?.length === 0 ? (
                  <div className={isDarkTheme ? "rounded-md border border-white/10 bg-slate-800/50 p-6 text-center text-sm text-slate-300" : "rounded-md border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600"}>
                    {debouncedBrandSearch
                      ? `No brands found for "${debouncedBrandSearch}".`
                      : "No brands yet. Create one to get started."}
                  </div>
                ) : null}
                {!brands.isLoading && !brands.isError && (brands.data?.length ?? 0) > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {brands.data?.map((b) => (
                      <div
                        key={b.id}
                        className={isDarkTheme ? "rounded-lg border border-white/10 bg-slate-800/80 p-4" : "rounded-lg border border-slate-200 bg-white p-4"}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <Link
                            href={`/brands/${b.id}`}
                            className={isDarkTheme ? "text-base font-semibold text-cyan-300 hover:underline" : "text-base font-semibold text-blue-700 hover:underline"}
                          >
                            {b.name}
                          </Link>
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            b.priority === "HIGH" ? "bg-red-100 text-red-700"
                            : b.priority === "MEDIUM" ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                          }`}>{b.priority}</span>
                        </div>
                        <div className={isDarkTheme ? "space-y-1 text-sm text-slate-300" : "space-y-1 text-sm text-slate-600"}>
                          <p><span className="font-medium">Industry:</span> {b.industry ?? "-"}</p>
                          <p><span className="font-medium">Expected Revenue:</span> {formatInrCurrency(b.expectedRevenue)}</p>
                          <p><span className="font-medium">Owner:</span> {b.owner?.name ?? b.ownerId}</p>
                          <p><span className="font-medium">Contacts:</span> {b.contacts?.length ?? 0}</p>
                        </div>
                        <div className="mt-4 flex items-center gap-3 text-xs">
                          <Link
                            href={`/brands/${b.id}`}
                            className={isDarkTheme ? "text-cyan-300 hover:underline" : "text-blue-600 hover:underline"}
                          >
                            View details
                          </Link>
                          <button
                            onClick={() => onOpenEditBrand(b.id)}
                            className={isDarkTheme ? "text-cyan-300 hover:underline" : "text-blue-600 hover:underline"}
                          >
                            Edit
                          </button>
                          <button onClick={() => onDeleteBrand(b.id, b.name)} className="text-red-500 hover:underline">
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
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

              <form className="space-y-3" onSubmit={brandForm.handleSubmit(onSubmitBrandForm)} noValidate>
                <div className="space-y-1">
                  <Label htmlFor="brandName">Name *</Label>
                  <Input
                    id="brandName"
                    placeholder="Acme Corp"
                    {...brandForm.register("brandName", { required: "Name is required" })}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={brandForm.formState.errors.brandName?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="brandPriority">Priority *</Label>
                  <Controller
                    control={brandForm.control}
                    name="brandPriority"
                    rules={{ required: "Priority is required" }}
                    render={({ field }) => (
                      <Select
                        id="brandPriority"
                        value={field.value}
                        onChange={field.onChange}
                        options={PRIORITIES}
                        placeholder="Select..."
                        className={isDarkTheme
                          ? "ui-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                          : "ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"}
                      />
                    )}
                  />
                  <FieldError msg={brandForm.formState.errors.brandPriority?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="brandRevenue">Expected Revenue *</Label>
                  <Input
                    id="brandRevenue"
                    type="number"
                    min="0"
                    placeholder="50000"
                    {...brandForm.register("brandRevenue", {
                      required: "Enter expected revenue",
                      validate: (value) => (!isNaN(Number(value)) && Number(value) >= 0) || "Enter a valid non-negative number",
                    })}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={brandForm.formState.errors.brandRevenue?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="brandIndustry">Industry *</Label>
                  <Input
                    id="brandIndustry"
                    placeholder="Technology"
                    {...brandForm.register("brandIndustry", { required: "Industry is required" })}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={brandForm.formState.errors.brandIndustry?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="brandForecast">Forecast Category</Label>
                  <Controller
                    control={brandForm.control}
                    name="brandForecast"
                    render={({ field }) => (
                      <Select
                        id="brandForecast"
                        value={field.value}
                        onChange={field.onChange}
                        options={FORECAST_CATEGORIES}
                        placeholder="Select..."
                        className={isDarkTheme
                          ? "ui-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                          : "ui-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"}
                      />
                    )}
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
                        {contacts.isLoading ? (
                          <div className="px-3 py-2">
                            <Skeleton height={14} count={3} />
                          </div>
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
                        {...brandForm.register("newContactName", { required: !useExistingContacts ? "Name is required" : false })}
                        className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                      />
                      {!useExistingContacts ? <FieldError msg={brandForm.formState.errors.newContactName?.message} /> : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="newContactPosition">Position *</Label>
                      <Input
                        id="newContactPosition"
                        disabled={useExistingContacts}
                        placeholder="Sales Manager"
                        {...brandForm.register("newContactPosition", { required: !useExistingContacts ? "Position is required" : false })}
                        className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                      />
                      {!useExistingContacts ? <FieldError msg={brandForm.formState.errors.newContactPosition?.message} /> : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="newContactEmail">Email *</Label>
                      <Input
                        id="newContactEmail"
                        disabled={useExistingContacts}
                        type="email"
                        placeholder="name@company.com"
                        {...brandForm.register("newContactEmail", {
                          required: !useExistingContacts ? "Email is required" : false,
                          pattern: !useExistingContacts ? { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" } : undefined,
                        })}
                        className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                      />
                      {!useExistingContacts ? <FieldError msg={brandForm.formState.errors.newContactEmail?.message} /> : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="newContactPhone">Phone *</Label>
                      <Input
                        id="newContactPhone"
                        disabled={useExistingContacts}
                        placeholder="+91 98765 43210"
                        {...brandForm.register("newContactPhone", { required: !useExistingContacts ? "Phone is required" : false })}
                        className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                      />
                      {!useExistingContacts ? <FieldError msg={brandForm.formState.errors.newContactPhone?.message} /> : null}
                    </div>
                  </div>
                </div>
                <FieldError msg={brandForm.formState.errors.brandName?.message === "Select at least one existing contact." ? brandForm.formState.errors.brandName.message : undefined} />
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

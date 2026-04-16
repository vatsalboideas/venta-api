"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useSelector } from "react-redux";
import Skeleton from "react-loading-skeleton";

import { AppShell } from "@/components/layout/app-shell";
import { getErrorMessage } from "@/lib/error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/toast";
import { persistToken } from "@/store/provider";
import {
  useCreateContactMutation,
  useDeleteContactMutation,
  useListBrandsQuery,
  useListContactsQuery,
  useMeQuery,
  useUpdateContactMutation,
} from "@/store/services/api";
import type { RootState } from "@/store";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

type ContactFormValues = {
  brandId: string;
  name: string;
  position: string;
  email: string;
  phone: string;
};

type BrandOption = { id: string; name: string };

function ContactFormFields({
  form,
  brands,
  isDarkTheme,
  idPrefix,
  placeholders,
  disableBrandAndName = false,
}: {
  form: UseFormReturn<ContactFormValues>;
  brands?: BrandOption[];
  isDarkTheme: boolean;
  idPrefix: string;
  placeholders?: Partial<Record<keyof ContactFormValues, string>>;
  disableBrandAndName?: boolean;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}Brand`}>Brand *</Label>
        <select
          id={`${idPrefix}Brand`}
          {...form.register("brandId", { required: "Select a brand" })}
          disabled={disableBrandAndName}
          className={isDarkTheme
            ? "ui-native-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
            : "ui-native-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"}
        >
          <option value="">Select brand...</option>
          {brands?.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
        <FieldError msg={form.formState.errors.brandId?.message} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}Name`}>Name *</Label>
        <Input
          id={`${idPrefix}Name`}
          placeholder={placeholders?.name}
          {...form.register("name", { required: "Name is required" })}
          readOnly={disableBrandAndName}
          className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
        />
        <FieldError msg={form.formState.errors.name?.message} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}Position`}>Position *</Label>
        <Input
          id={`${idPrefix}Position`}
          placeholder={placeholders?.position}
          {...form.register("position", { required: "Position is required" })}
          className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
        />
        <FieldError msg={form.formState.errors.position?.message} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}Email`}>Email *</Label>
        <Input
          id={`${idPrefix}Email`}
          type="email"
          placeholder={placeholders?.email}
          {...form.register("email", {
            required: "Email is required",
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
          })}
          className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
        />
        <FieldError msg={form.formState.errors.email?.message} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}Phone`}>Phone *</Label>
        <Input
          id={`${idPrefix}Phone`}
          placeholder={placeholders?.phone}
          {...form.register("phone", { required: "Phone is required" })}
          className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
        />
        <FieldError msg={form.formState.errors.phone?.message} />
      </div>
    </>
  );
}

export default function ContactsPage() {
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

  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [brandFilterInput, setBrandFilterInput] = useState("");
  const [debouncedBrandSearch, setDebouncedBrandSearch] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [visibleBrandCount, setVisibleBrandCount] = useState(8);
  const [visibleCount, setVisibleCount] = useState(12);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const brandLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const brandDropdownRef = useRef<HTMLDivElement | null>(null);
  const createForm = useForm<ContactFormValues>({
    defaultValues: { brandId: "", name: "", position: "", email: "", phone: "" },
  });
  const editForm = useForm<ContactFormValues>({
    defaultValues: { brandId: "", name: "", position: "", email: "", phone: "" },
  });

  const brands = useListBrandsQuery(undefined, { skip: !token });
  const brandFilterOptions = useListBrandsQuery(
    { q: debouncedBrandSearch.trim() || undefined },
    { skip: !token },
  );
  const contacts = useListContactsQuery(
    {
      q: debouncedSearch.trim() || undefined,
      brandId: selectedBrandId || undefined,
    },
    { skip: !token },
  );
  const [createContact, createContactState] = useCreateContactMutation();
  const [deleteContact] = useDeleteContactMutation();
  const [updateContact, updateContactState] = useUpdateContactMutation();
  const me = useMeQuery(undefined, { skip: !token });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  function onThemeChange(value: "light" | "dark" | "system") {
    setThemeMode(value);
    window.localStorage.setItem("venta-dashboard-theme", value);
    window.dispatchEvent(new CustomEvent("venta-theme-change", { detail: value }));
  }

  const editingContact = useMemo(
    () => contacts.data?.find((item) => item.id === editingContactId) ?? null,
    [contacts.data, editingContactId],
  );
  const filteredContacts = useMemo(() => contacts.data ?? [], [contacts.data]);
  const visibleBrandOptions = useMemo(
    () => (brandFilterOptions.data ?? []).slice(0, visibleBrandCount),
    [brandFilterOptions.data, visibleBrandCount],
  );
  const hasMoreBrandOptions = visibleBrandCount < (brandFilterOptions.data?.length ?? 0);
  const visibleContacts = useMemo(
    () => filteredContacts.slice(0, visibleCount),
    [filteredContacts, visibleCount],
  );
  const hasMoreContacts = visibleCount < filteredContacts.length;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
      setVisibleCount(12);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedBrandSearch(brandFilterInput);
      setVisibleBrandCount(8);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [brandFilterInput]);

  useEffect(() => {
    if (!hasMoreContacts || contacts.isLoading || contacts.isError) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((current) => Math.min(current + 12, filteredContacts.length));
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreContacts, contacts.isLoading, contacts.isError, filteredContacts.length]);

  useEffect(() => {
    if (!isBrandDropdownOpen || !hasMoreBrandOptions || brandFilterOptions.isLoading) return;
    const node = brandLoadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleBrandCount((current) =>
            Math.min(current + 8, brandFilterOptions.data?.length ?? current + 8),
          );
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isBrandDropdownOpen, hasMoreBrandOptions, brandFilterOptions.isLoading, brandFilterOptions.data]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (brandDropdownRef.current?.contains(target)) return;
      setIsBrandDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  async function onCreateContact(values: ContactFormValues) {
    try {
      await createContact({
        brandId: values.brandId,
        name: values.name.trim(),
        position: values.position.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
      }).unwrap();
      notifySuccess("Contact created.");
      onCloseCreateContact();
    } catch (err) {
      notifyError(getErrorMessage(err, "Create contact failed"));
    }
  }

  async function onDeleteContact(id: string, name: string) {
    if (!confirm(`Delete contact "${name}"?`)) return;
    try {
      await deleteContact(id).unwrap();
      notifySuccess("Contact deleted.");
    } catch (err) {
      notifyError(getErrorMessage(err, "Delete contact failed"));
    }
  }

  function onOpenEditContact(id: string) {
    const contact = contacts.data?.find((item) => item.id === id);
    if (!contact) return;
    setEditingContactId(contact.id);
    editForm.reset({
      brandId: contact.brandId ?? "",
      name: contact.name ?? "",
      position: contact.position ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
    });
  }

  const onCloseEditContact = useCallback(() => {
    setEditingContactId(null);
    editForm.reset();
  }, [editForm]);

  function onOpenCreateContact() {
    createForm.reset();
    setIsCreateModalOpen(true);
  }

  const onCloseCreateContact = useCallback(() => {
    setIsCreateModalOpen(false);
    createForm.reset();
  }, [createForm]);

  function onSelectBrandFilter(brand: { id: string; name: string } | null) {
    if (!brand) {
      setSelectedBrandId("");
      setBrandFilterInput("");
      setDebouncedBrandSearch("");
    } else {
      setSelectedBrandId(brand.id);
      setBrandFilterInput(brand.name);
      setDebouncedBrandSearch(brand.name);
    }
    setIsBrandDropdownOpen(false);
  }

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && editingContactId) {
        onCloseEditContact();
      }
      if (event.key === "Escape" && isCreateModalOpen) {
        onCloseCreateContact();
      }
    };

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [editingContactId, isCreateModalOpen, onCloseCreateContact, onCloseEditContact]);

  async function onUpdateContact(values: ContactFormValues) {
    if (!editingContactId) return;

    const isBoss = me.data?.role === "BOSS";
    const immutableName = editingContact?.name ?? values.name;
    const immutableBrandId = editingContact?.brandId ?? values.brandId;

    try {
      await updateContact({
        id: editingContactId,
        brandId: isBoss ? values.brandId : immutableBrandId,
        name: isBoss ? values.name.trim() : immutableName,
        position: values.position.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
      }).unwrap();
      notifySuccess("Contact updated.");
      onCloseEditContact();
    } catch (err) {
      notifyError(getErrorMessage(err, "Update contact failed"));
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
            <p className="text-sm text-slate-600">You need an active session before opening contacts.</p>
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
              <span className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-700"}>Contacts</span>
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
          <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20" : undefined}>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Contacts</CardTitle>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search by name, email, phone, brand..."
                    className={isDarkTheme
                      ? "w-full border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 sm:w-80"
                      : "w-full sm:w-80"}
                  />
                  <div ref={brandDropdownRef} className="relative w-full sm:w-72">
                    <Input
                      value={brandFilterInput}
                      onChange={(event) => {
                        setBrandFilterInput(event.target.value);
                        setSelectedBrandId("");
                        setIsBrandDropdownOpen(true);
                      }}
                      onFocus={() => setIsBrandDropdownOpen(true)}
                      placeholder="Filter by brand (All Brands)"
                      className={isDarkTheme
                        ? "w-full border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400"
                        : "w-full"}
                    />
                    {isBrandDropdownOpen ? (
                      <div
                        className={
                          isDarkTheme
                            ? "absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-white/15 bg-slate-900 p-1 shadow-2xl"
                            : "absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white p-1 shadow-xl"
                        }
                      >
                        <button
                          type="button"
                          onClick={() => onSelectBrandFilter(null)}
                          className={isDarkTheme
                            ? "w-full rounded px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800"
                            : "w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"}
                        >
                          All Brands
                        </button>
                        {brandFilterOptions.isLoading ? (
                          <div className="px-3 py-2">
                            <Skeleton height={12} count={3} />
                          </div>
                        ) : null}
                        {!brandFilterOptions.isLoading && visibleBrandOptions.length === 0 ? (
                          <p className={isDarkTheme ? "px-3 py-2 text-xs text-slate-400" : "px-3 py-2 text-xs text-slate-500"}>
                            No brands found
                          </p>
                        ) : null}
                        {visibleBrandOptions.map((brand) => (
                          <button
                            type="button"
                            key={brand.id}
                            onClick={() => onSelectBrandFilter(brand)}
                            className={isDarkTheme
                              ? "w-full rounded px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800"
                              : "w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"}
                          >
                            {brand.name}
                          </button>
                        ))}
                        {hasMoreBrandOptions ? (
                          <div
                            ref={brandLoadMoreRef}
                            className={isDarkTheme ? "px-3 py-2 text-xs text-slate-400" : "px-3 py-2 text-xs text-slate-500"}
                          >
                            <Skeleton height={12} width={120} />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    onClick={onOpenCreateContact}
                    className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined}
                  >
                    Add Contact
                  </Button>
                </div>
              </div>
            </CardHeader>
              <CardContent>
                {contacts.isLoading && (
                  <div className={isDarkTheme ? "rounded-md border border-white/10 bg-slate-800/40 p-6" : "rounded-md border border-slate-200 bg-slate-50 p-6"}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="rounded-md border border-slate-200 p-4">
                          <Skeleton height={18} width="60%" />
                          <Skeleton height={14} count={4} className="mt-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {contacts.isError && (
                  <div className={isDarkTheme ? "rounded-md border border-red-500/40 bg-red-950/30 p-6 text-center text-red-200" : "rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-600"}>
                    Failed to load contacts.{" "}
                    <button onClick={() => contacts.refetch()} className="underline hover:opacity-70">
                      Retry
                    </button>
                  </div>
                )}
                {!contacts.isLoading && !contacts.isError && filteredContacts.length === 0 && (
                  <div className={isDarkTheme ? "rounded-md border border-white/10 bg-slate-800/40 p-6 text-center text-slate-300" : "rounded-md border border-slate-200 bg-slate-50 p-6 text-center text-slate-500"}>
                    {debouncedSearch.trim() ? "No contacts match your search." : "No contacts yet."}
                  </div>
                )}
                {!contacts.isLoading && !contacts.isError && filteredContacts.length > 0 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {visibleContacts.map((contact) => (
                      <Card key={contact.id} className={isDarkTheme ? "border-white/10 bg-slate-800/70" : "border-slate-200 bg-white"}>
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={isDarkTheme ? "text-base font-semibold text-white" : "text-base font-semibold text-slate-900"}>
                                {contact.name}
                              </p>
                              <p className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-500"}>
                                {contact.position || "-"}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => onOpenEditContact(contact.id)}
                                className={isDarkTheme ? "text-xs text-cyan-300 hover:underline" : "text-xs text-blue-600 hover:underline"}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => onDeleteContact(contact.id, contact.name)}
                                className="text-xs text-red-500 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p className={isDarkTheme ? "text-slate-300" : "text-slate-600"}>
                              <span className={isDarkTheme ? "text-slate-400" : "text-slate-500"}>Email:</span>{" "}
                              {contact.email || "-"}
                            </p>
                            <p className={isDarkTheme ? "text-slate-300" : "text-slate-600"}>
                              <span className={isDarkTheme ? "text-slate-400" : "text-slate-500"}>Phone:</span>{" "}
                              {contact.phone || "-"}
                            </p>
                            <p className={isDarkTheme ? "text-slate-300" : "text-slate-600"}>
                              <span className={isDarkTheme ? "text-slate-400" : "text-slate-500"}>Brand:</span>{" "}
                              {contact.brand?.name ?? contact.brandId}
                            </p>
                            <p className={isDarkTheme ? "text-slate-300" : "text-slate-600"}>
                              <span className={isDarkTheme ? "text-slate-400" : "text-slate-500"}>Added by:</span>{" "}
                              {contact.creator?.name || "-"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      ))}
                    </div>
                    {hasMoreContacts ? (
                      <div
                        ref={loadMoreRef}
                        className={isDarkTheme ? "py-3 text-center text-sm text-slate-400" : "py-3 text-center text-sm text-slate-500"}
                      >
                        <Skeleton height={14} width={150} className="mx-auto" />
                      </div>
                    ) : (
                      <div className={isDarkTheme ? "py-1 text-center text-xs text-slate-500" : "py-1 text-center text-xs text-slate-400"}>
                        Showing {visibleContacts.length} of {filteredContacts.length} contacts
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
          </Card>
        </div>

        {isCreateModalOpen ? (
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
                  Add Contact
                </h3>
                <button
                  type="button"
                  onClick={onCloseCreateContact}
                  className={isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}
                >
                  Close
                </button>
              </div>

              <form className="space-y-3" onSubmit={createForm.handleSubmit(onCreateContact)} noValidate>
                <ContactFormFields
                  form={createForm}
                  brands={brands.data}
                  isDarkTheme={isDarkTheme}
                  idPrefix="contact"
                  placeholders={{ name: "John Doe", position: "Sales Manager", email: "name@company.com", phone: "+91 98765 43210" }}
                />

                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}
                    onClick={onCloseCreateContact}
                  >
                    Cancel
                  </Button>
                  <Button className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined} disabled={createContactState.isLoading}>
                    {createContactState.isLoading ? "Saving..." : "Create Contact"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {editingContactId ? (
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
                  Edit Contact{editingContact?.name ? `: ${editingContact.name}` : ""}
                </h3>
                <button
                  type="button"
                  onClick={onCloseEditContact}
                  className={isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}
                >
                  Close
                </button>
              </div>

              <form className="space-y-3" onSubmit={editForm.handleSubmit(onUpdateContact)} noValidate>
                <ContactFormFields
                  form={editForm}
                  brands={brands.data}
                  isDarkTheme={isDarkTheme}
                  idPrefix="editContact"
                  disableBrandAndName={me.data?.role !== "BOSS"}
                />
                {me.data?.role !== "BOSS" ? (
                  <p className={isDarkTheme ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                    Brand and name can only be changed by Boss users.
                  </p>
                ) : null}

                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}
                    onClick={onCloseEditContact}
                  >
                    Cancel
                  </Button>
                  <Button className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined} disabled={updateContactState.isLoading}>
                    {updateContactState.isLoading ? "Updating..." : "Update Contact"}
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

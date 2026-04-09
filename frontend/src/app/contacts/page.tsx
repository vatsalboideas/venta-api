"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { persistToken } from "@/store/provider";
import {
  useCreateContactMutation,
  useDeleteContactMutation,
  useListBrandsQuery,
  useListContactsQuery,
  useUpdateContactMutation,
} from "@/store/services/api";
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

export default function ContactsPage() {
  const token = useSelector((state: RootState) => state.auth.token);
  const initialized = useSelector((state: RootState) => state.auth.initialized);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  const [contactBrandId, setContactBrandId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPosition, setContactPosition] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});

  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactBrandId, setEditContactBrandId] = useState("");
  const [editContactName, setEditContactName] = useState("");
  const [editContactPosition, setEditContactPosition] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactErrors, setEditContactErrors] = useState<Record<string, string>>({});

  const brands = useListBrandsQuery(undefined, { skip: !token });
  const contacts = useListContactsQuery(undefined, { skip: !token });
  const [createContact, createContactState] = useCreateContactMutation();
  const [deleteContact] = useDeleteContactMutation();
  const [updateContact, updateContactState] = useUpdateContactMutation();

  useEffect(() => {
    const stored = window.localStorage.getItem("venta-dashboard-theme");
    if (stored === "light" || stored === "dark" || stored === "system") setThemeMode(stored);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(media.matches);
    const onSystemThemeChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  function onThemeChange(value: "light" | "dark" | "system") {
    setThemeMode(value);
    window.localStorage.setItem("venta-dashboard-theme", value);
  }

  async function onCreateContact(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!contactBrandId) errs.brandId = "Select a brand";
    if (!contactName.trim()) errs.name = "Name is required";
    if (!contactPosition.trim()) errs.position = "Position is required";
    if (!contactEmail.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) errs.email = "Enter a valid email";
    if (!contactPhone.trim()) errs.phone = "Phone is required";
    setContactErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      await createContact({
        brandId: contactBrandId,
        name: contactName.trim(),
        position: contactPosition.trim(),
        email: contactEmail.trim(),
        phone: contactPhone.trim(),
      }).unwrap();
      setNotice({ type: "success", text: "Contact created." });
      setContactBrandId("");
      setContactName("");
      setContactPosition("");
      setContactEmail("");
      setContactPhone("");
      setContactErrors({});
    } catch (err) {
      setNotice({ type: "error", text: getErrorMessage(err) });
    }
  }

  async function onDeleteContact(id: string, name: string) {
    if (!confirm(`Delete contact "${name}"?`)) return;
    try {
      await deleteContact(id).unwrap();
      setNotice({ type: "success", text: "Contact deleted." });
    } catch (err) {
      setNotice({ type: "error", text: getErrorMessage(err) });
    }
  }

  function onOpenEditContact(id: string) {
    const contact = contacts.data?.find((item) => item.id === id);
    if (!contact) return;
    setEditingContactId(contact.id);
    setEditContactBrandId(contact.brandId ?? "");
    setEditContactName(contact.name ?? "");
    setEditContactPosition(contact.position ?? "");
    setEditContactEmail(contact.email ?? "");
    setEditContactPhone(contact.phone ?? "");
    setEditContactErrors({});
  }

  function onCloseEditContact() {
    setEditingContactId(null);
    setEditContactErrors({});
  }

  async function onUpdateContact(e: FormEvent) {
    e.preventDefault();
    if (!editingContactId) return;

    const errs: Record<string, string> = {};
    if (!editContactBrandId) errs.brandId = "Select a brand";
    if (!editContactName.trim()) errs.name = "Name is required";
    if (!editContactPosition.trim()) errs.position = "Position is required";
    if (!editContactEmail.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editContactEmail.trim())) errs.email = "Enter a valid email";
    if (!editContactPhone.trim()) errs.phone = "Phone is required";
    setEditContactErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      await updateContact({
        id: editingContactId,
        brandId: editContactBrandId,
        name: editContactName.trim(),
        position: editContactPosition.trim(),
        email: editContactEmail.trim(),
        phone: editContactPhone.trim(),
      }).unwrap();
      setNotice({ type: "success", text: "Contact updated." });
      onCloseEditContact();
    } catch (err) {
      setNotice({ type: "error", text: getErrorMessage(err) });
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

  return (
    <AppShell isDarkTheme={isDarkTheme}>
      <main className={isDarkTheme ? "min-h-screen bg-slate-950 text-slate-100" : "min-h-screen bg-slate-100"}>
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
          {notice && <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />}

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20 lg:col-span-1" : "lg:col-span-1"}>
              <CardHeader>
                <CardTitle>New Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={onCreateContact} noValidate>
                  <div className="space-y-1">
                    <Label htmlFor="contactBrand">Brand *</Label>
                    <select
                      id="contactBrand"
                      value={contactBrandId}
                      onChange={(e) => setContactBrandId(e.target.value)}
                      className={isDarkTheme
                        ? "ui-native-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                        : "ui-native-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"}
                    >
                      <option value="">Select brand...</option>
                      {brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <FieldError msg={contactErrors.brandId} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="contactName">Name *</Label>
                    <Input
                      id="contactName"
                      placeholder="John Doe"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                    />
                    <FieldError msg={contactErrors.name} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="contactPosition">Position *</Label>
                    <Input
                      id="contactPosition"
                      placeholder="Sales Manager"
                      value={contactPosition}
                      onChange={(e) => setContactPosition(e.target.value)}
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                    />
                    <FieldError msg={contactErrors.position} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="contactEmail">Email *</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="name@company.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                    />
                    <FieldError msg={contactErrors.email} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="contactPhone">Phone *</Label>
                    <Input
                      id="contactPhone"
                      placeholder="+91 98765 43210"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                    />
                    <FieldError msg={contactErrors.phone} />
                  </div>
                  <Button className={isDarkTheme ? "w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "w-full"} disabled={createContactState.isLoading}>
                    {createContactState.isLoading ? "Saving..." : "Create Contact"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20 lg:col-span-2" : "lg:col-span-2"}>
              <CardHeader>
                <CardTitle>Contacts</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <THead>
                    <TR>
                      <TH>Name</TH>
                      <TH>Position</TH>
                      <TH>Email</TH>
                      <TH>Phone</TH>
                      <TH>Brand</TH>
                      <TH>Added by</TH>
                      <TH></TH>
                    </TR>
                  </THead>
                  <TBody>
                    {contacts.isLoading && <TableLoading cols={7} />}
                    {contacts.isError && <TableError cols={7} onRetry={() => contacts.refetch()} />}
                    {contacts.data?.length === 0 && <TableEmpty cols={7} message="No contacts yet." />}
                    {contacts.data?.map((c) => (
                      <TR key={c.id}>
                        <TD className="font-medium">{c.name}</TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>{c.position ?? "-"}</TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>{c.email ?? "-"}</TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>{c.phone ?? "-"}</TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>{c.brand?.name ?? c.brandId}</TD>
                        <TD className={isDarkTheme ? "text-slate-300" : "text-slate-500"}>{c.creator?.name ?? "-"}</TD>
                        <TD>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => onOpenEditContact(c.id)}
                              className={isDarkTheme ? "text-xs text-cyan-300 hover:underline" : "text-xs text-blue-600 hover:underline"}
                            >
                              Edit
                            </button>
                            <button onClick={() => onDeleteContact(c.id, c.name)} className="text-xs text-red-500 hover:underline">
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
                  Edit Contact
                </h3>
                <button
                  type="button"
                  onClick={onCloseEditContact}
                  className={isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}
                >
                  Close
                </button>
              </div>

              <form className="space-y-3" onSubmit={onUpdateContact} noValidate>
                <div className="space-y-1">
                  <Label htmlFor="editContactBrand">Brand *</Label>
                  <select
                    id="editContactBrand"
                    value={editContactBrandId}
                    onChange={(e) => setEditContactBrandId(e.target.value)}
                    className={isDarkTheme
                      ? "ui-native-select flex h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                      : "ui-native-select flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"}
                  >
                    <option value="">Select brand...</option>
                    {brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <FieldError msg={editContactErrors.brandId} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editContactName">Name *</Label>
                  <Input
                    id="editContactName"
                    value={editContactName}
                    onChange={(e) => setEditContactName(e.target.value)}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={editContactErrors.name} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editContactPosition">Position *</Label>
                  <Input
                    id="editContactPosition"
                    value={editContactPosition}
                    onChange={(e) => setEditContactPosition(e.target.value)}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={editContactErrors.position} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editContactEmail">Email *</Label>
                  <Input
                    id="editContactEmail"
                    type="email"
                    value={editContactEmail}
                    onChange={(e) => setEditContactEmail(e.target.value)}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={editContactErrors.email} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editContactPhone">Phone *</Label>
                  <Input
                    id="editContactPhone"
                    value={editContactPhone}
                    onChange={(e) => setEditContactPhone(e.target.value)}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={editContactErrors.phone} />
                </div>

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

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useForm } from "react-hook-form";
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
  useCreateDepartmentMutation,
  useCreateEmployeeTypeMutation,
  useCreateInternMutation,
  useDeleteDepartmentMutation,
  useDeleteEmployeeTypeMutation,
  useDeleteUserMutation,
  useListDepartmentsQuery,
  useListEmployeeTypesQuery,
  useListUsersQuery,
  useMeQuery,
  useUpdateDepartmentMutation,
  useUpdateEmployeeTypeMutation,
  useUpdateUserMutation,
} from "@/store/services/api";
import type { RootState } from "@/store";
import type { Department, EmployeeType, User } from "@/types/api";

function roleLabel(role: string) {
  const map: Record<string, string> = { BOSS: "Boss", MANAGER: "Manager", EMPLOYEE: "Employee", INTERN: "Intern" };
  return map[role] ?? role;
}

function canCreateRole(actorRole: User["role"] | undefined, targetRole: User["role"]): boolean {
  if (actorRole === "BOSS") return targetRole === "MANAGER" || targetRole === "EMPLOYEE" || targetRole === "INTERN";
  if (actorRole === "MANAGER") return targetRole === "EMPLOYEE" || targetRole === "INTERN";
  if (actorRole === "EMPLOYEE") return targetRole === "INTERN";
  return false;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

export default function EmployeesPage() {
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
  const [showCreateInternModal, setShowCreateInternModal] = useState(false);
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<User | null>(null);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingEmployeeType, setEditingEmployeeType] = useState<EmployeeType | null>(null);
  const [showEmployeeTypeModal, setShowEmployeeTypeModal] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<string | null>(null);
  const [deletingEmployeeTypeId, setDeletingEmployeeTypeId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(12);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const createInternForm = useForm<{
    name: string;
    email: string;
    password: string;
    phone: string;
    role: "MANAGER" | "EMPLOYEE" | "INTERN";
    department: string;
    position: string;
  }>({ defaultValues: { name: "", email: "", password: "", phone: "", role: "INTERN", department: "", position: "" } });
  const departmentForm = useForm<{ name: string }>({ defaultValues: { name: "" } });
  const employeeTypeForm = useForm<{ code: "BOSS" | "MANAGER" | "EMPLOYEE" | "INTERN"; label: string }>({
    defaultValues: { code: "EMPLOYEE", label: "" },
  });
  const editEmployeeForm = useForm<{
    name: string;
    email: string;
    phone: string;
    department: string;
    position: string;
    role: "MANAGER" | "EMPLOYEE" | "INTERN";
  }>({
    defaultValues: { name: "", email: "", phone: "", department: "", position: "", role: "EMPLOYEE" },
  });

  const me = useMeQuery(undefined, { skip: !token });
  const users = useListUsersQuery(
    { q: debouncedSearch.trim() || undefined, page: 1, limit: visibleLimit },
    { skip: !token },
  );
  const [createIntern, createInternState] = useCreateInternMutation();
  const [updateUser, updateUserState] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();
  const departments = useListDepartmentsQuery(undefined, { skip: !token });
  const [createDepartment, createDepartmentState] = useCreateDepartmentMutation();
  const [updateDepartment, updateDepartmentState] = useUpdateDepartmentMutation();
  const [deleteDepartment] = useDeleteDepartmentMutation();
  const employeeTypes = useListEmployeeTypesQuery(undefined, { skip: !token });
  const [createEmployeeType, createEmployeeTypeState] = useCreateEmployeeTypeMutation();
  const [updateEmployeeType, updateEmployeeTypeState] = useUpdateEmployeeTypeMutation();
  const [deleteEmployeeType] = useDeleteEmployeeTypeMutation();

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
      setVisibleLimit(12);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const employees = useMemo(() => users.data ?? [], [users.data]);
  const hasMore = employees.length >= visibleLimit;
  const usersById = useMemo(() => new Map(employees.map((user) => [user.id, user])), [employees]);
  const currentUser = me.data;

  const isDescendantOfCurrentUser = useMemo(() => {
    const currentUserId = currentUser?.id;
    return (userId: string): boolean => {
      if (!currentUserId) return false;
      const visited = new Set<string>();
      let cursorId = usersById.get(userId)?.createdBy ?? null;
      while (cursorId) {
        if (visited.has(cursorId)) break;
        if (cursorId === currentUserId) return true;
        visited.add(cursorId);
        cursorId = usersById.get(cursorId)?.createdBy ?? null;
      }
      return false;
    };
  }, [currentUser?.id, usersById]);

  const canManageUser = useMemo(() => {
    return (target: User): boolean => {
      const actorRole = currentUser?.role;
      if (actorRole === "BOSS") return target.role !== "BOSS";
      if (actorRole !== "MANAGER" && actorRole !== "EMPLOYEE") return false;
      if (!canCreateRole(actorRole, target.role)) return false;
      return isDescendantOfCurrentUser(target.id);
    };
  }, [currentUser?.role, isDescendantOfCurrentUser]);

  const deleteTransferOptions = useMemo(() => {
    if (!employeeToDelete) return [] as User[];

    const getManagerAnchorId = (user: User): string | null => {
      if (user.role === "MANAGER") return user.id;
      let cursorId = user.createdBy ?? null;
      const visited = new Set<string>();
      while (cursorId) {
        if (visited.has(cursorId)) break;
        visited.add(cursorId);
        const node = usersById.get(cursorId);
        if (!node) break;
        if (node.role === "MANAGER") return node.id;
        cursorId = node.createdBy ?? null;
      }
      return null;
    };

    if (employeeToDelete.role === "MANAGER") {
      return employees.filter((u) => u.id !== employeeToDelete.id && u.role === "MANAGER");
    }

    const sourceManager = getManagerAnchorId(employeeToDelete);
    return employees.filter((u) => {
      if (u.id === employeeToDelete.id) return false;
      if (u.role !== "EMPLOYEE" && u.role !== "INTERN") return false;
      return Boolean(sourceManager && getManagerAnchorId(u) === sourceManager);
    });
  }, [employeeToDelete, employees, usersById]);

  useEffect(() => {
    if (!hasMore || users.isLoading || users.isFetching || users.isError) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          setVisibleLimit((current) => current + 12);
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, users.isLoading, users.isFetching, users.isError]);

  function onThemeChange(value: "light" | "dark" | "system") {
    setThemeMode(value);
    window.localStorage.setItem("venta-dashboard-theme", value);
    window.dispatchEvent(new CustomEvent("venta-theme-change", { detail: value }));
  }

  async function onCreateIntern(values: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: "MANAGER" | "EMPLOYEE" | "INTERN";
    department: string;
    position: string;
  }) {
    try {
      await createIntern({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password.trim(),
        phone: values.phone.trim() || undefined,
        role: values.role,
        department: values.department.trim() || undefined,
        position: values.position.trim() || undefined,
      }).unwrap();
      notifySuccess("Intern created successfully.");
      createInternForm.reset();
      setShowCreateInternModal(false);
    } catch (err) {
      notifyError(getErrorMessage(err, "Create intern failed"));
    }
  }

  function onOpenCreateInternModal() {
    createInternForm.reset({ name: "", email: "", password: "", phone: "", role: "INTERN", department: "", position: "" });
    setShowCreateInternModal(true);
  }

  function onCloseCreateInternModal() {
    setShowCreateInternModal(false);
    createInternForm.reset();
  }

  async function onSubmitDepartment(values: { name: string }) {
    try {
      if (editingDepartment) {
        await updateDepartment({ id: editingDepartment.id, body: { name: values.name.trim() } }).unwrap();
        notifySuccess("Department updated.");
      } else {
        await createDepartment({ name: values.name.trim() }).unwrap();
        notifySuccess("Department created.");
      }
      setEditingDepartment(null);
      departmentForm.reset({ name: "" });
    } catch (err) {
      notifyError(getErrorMessage(err, "Department save failed"));
    }
  }

  function onEditDepartment(department: Department) {
    setEditingDepartment(department);
    departmentForm.reset({ name: department.name });
  }

  async function onDeleteDepartment(department: Department) {
    setDeletingDepartmentId(department.id);
    try {
      await deleteDepartment(department.id).unwrap();
      notifySuccess("Department deleted.");
      if (editingDepartment?.id === department.id) {
        setEditingDepartment(null);
        departmentForm.reset({ name: "" });
      }
    } catch (err) {
      notifyError(getErrorMessage(err, "Delete department failed"));
    } finally {
      setDeletingDepartmentId(null);
    }
  }

  async function onSubmitEmployeeType(values: { code: "BOSS" | "MANAGER" | "EMPLOYEE" | "INTERN"; label: string }) {
    try {
      if (editingEmployeeType) {
        await updateEmployeeType({ id: editingEmployeeType.id, body: { label: values.label.trim() } }).unwrap();
        notifySuccess("Employee type updated.");
      } else {
        await createEmployeeType({ code: values.code, label: values.label.trim() }).unwrap();
        notifySuccess("Employee type created.");
      }
      setEditingEmployeeType(null);
      employeeTypeForm.reset({ code: "EMPLOYEE", label: "" });
      setShowEmployeeTypeModal(false);
    } catch (err) {
      notifyError(getErrorMessage(err, "Employee type save failed"));
    }
  }

  function onEditEmployeeType(type: EmployeeType) {
    setEditingEmployeeType(type);
    employeeTypeForm.reset({ code: type.code, label: type.label });
    setShowEmployeeTypeModal(true);
  }

  function onOpenAddEmployeeTypeModal() {
    setEditingEmployeeType(null);
    employeeTypeForm.reset({ code: "EMPLOYEE", label: "" });
    setShowEmployeeTypeModal(true);
  }

  function onCloseEmployeeTypeModal() {
    setShowEmployeeTypeModal(false);
    setEditingEmployeeType(null);
    employeeTypeForm.reset({ code: "EMPLOYEE", label: "" });
  }

  async function onDeleteEmployeeType(type: EmployeeType) {
    setDeletingEmployeeTypeId(type.id);
    try {
      await deleteEmployeeType(type.id).unwrap();
      notifySuccess("Employee type deleted.");
      if (editingEmployeeType?.id === type.id) {
        setEditingEmployeeType(null);
        employeeTypeForm.reset({ code: "EMPLOYEE", label: "" });
      }
    } catch (err) {
      notifyError(getErrorMessage(err, "Delete employee type failed"));
    } finally {
      setDeletingEmployeeTypeId(null);
    }
  }

  function onOpenEditEmployeeModal(employee: User) {
    setSelectedEmployee(employee);
    editEmployeeForm.reset({
      name: employee.name ?? "",
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      department: employee.department ?? "",
      position: employee.position ?? "",
      role: employee.role as "MANAGER" | "EMPLOYEE" | "INTERN",
    });
    setShowEditEmployeeModal(true);
  }

  function onCloseEditEmployeeModal() {
    setShowEditEmployeeModal(false);
    setSelectedEmployee(null);
    editEmployeeForm.reset();
  }

  async function onUpdateEmployee(values: {
    name: string;
    email: string;
    phone: string;
    department: string;
    position: string;
    role: "MANAGER" | "EMPLOYEE" | "INTERN";
  }) {
    if (!selectedEmployee) return;
    try {
      await updateUser({
        id: selectedEmployee.id,
        body: {
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim() || null,
          department: values.department.trim() || null,
          position: values.position.trim() || null,
          role: values.role,
        },
      }).unwrap();
      notifySuccess("Employee updated successfully.");
      onCloseEditEmployeeModal();
    } catch (err) {
      notifyError(getErrorMessage(err, "Update employee failed"));
    }
  }

  function onRequestDeleteEmployee(employee: User) {
    setEmployeeToDelete(employee);
    setTransferTargetId("");
    setShowDeleteConfirmModal(true);
  }

  function onCloseDeleteConfirmModal() {
    setShowDeleteConfirmModal(false);
    setEmployeeToDelete(null);
    setTransferTargetId("");
  }

  async function onConfirmDeleteEmployee() {
    if (!employeeToDelete) return;
    setDeletingUserId(employeeToDelete.id);
    try {
      await deleteUser({
        id: employeeToDelete.id,
        transferToUserId: transferTargetId.trim() || undefined,
      }).unwrap();
      notifySuccess("Employee deleted successfully.");
      onCloseDeleteConfirmModal();
    } catch (err) {
      notifyError(getErrorMessage(err, "Delete employee failed"));
    } finally {
      setDeletingUserId(null);
    }
  }

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showCreateInternModal) {
        setShowCreateInternModal(false);
        createInternForm.reset();
      }
    };

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [createInternForm, showCreateInternModal]);

  const isDarkTheme = themeMode === "dark" || (themeMode === "system" && systemPrefersDark);
  const skeletonThemeStyle: CSSProperties | undefined = isDarkTheme
    ? ({ "--base-color": "#1e293b", "--highlight-color": "#334155" } as CSSProperties)
    : undefined;

  const title = useMemo(() => "All Employees & Interns", []);
  const departmentOptions = departments.data ?? [];
  const employeeTypeOptions = employeeTypes.data ?? [];
  const assignableRoleOptions = useMemo(
    () => employeeTypeOptions.filter((type) => canCreateRole(currentUser?.role, type.code)),
    [employeeTypeOptions, currentUser?.role],
  );

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
            <p className="text-sm text-slate-600">You need an active session before opening employees.</p>
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
              <span className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-700"}>Employees</span>
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
            {me.data?.role === "BOSS" ? (
              <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20" : undefined}>
                <CardHeader>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <CardTitle>Departments</CardTitle>
                      <p className={isDarkTheme ? "mt-1 text-xs text-slate-400" : "mt-1 text-xs text-slate-500"}>
                        Only Boss can manage departments. Employees use these values in profiles.
                      </p>
                    </div>
                    <span
                      className={
                        isDarkTheme
                          ? "rounded-full border border-white/15 bg-slate-800 px-2.5 py-1 text-xs text-slate-300"
                          : "rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                      }
                    >
                      {departmentOptions.length} {departmentOptions.length === 1 ? "department" : "departments"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form
                    className={isDarkTheme ? "rounded-lg border border-white/10 bg-slate-800/50 p-3" : "rounded-lg border border-slate-200 bg-slate-50 p-3"}
                    onSubmit={departmentForm.handleSubmit(onSubmitDepartment)}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        placeholder="Department name (e.g. Sales, Marketing)"
                        {...departmentForm.register("name", { required: "Department name is required" })}
                        className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400" : "bg-white"}
                      />
                      <Button type="submit" disabled={createDepartmentState.isLoading || updateDepartmentState.isLoading}>
                        {editingDepartment
                          ? updateDepartmentState.isLoading
                            ? "Updating..."
                            : "Update"
                          : createDepartmentState.isLoading
                            ? "Adding..."
                            : "Add"}
                      </Button>
                      {editingDepartment ? (
                        <Button
                          type="button"
                          variant="outline"
                          className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"}
                          onClick={() => {
                            setEditingDepartment(null);
                            departmentForm.reset({ name: "" });
                          }}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </form>
                  <FieldError msg={departmentForm.formState.errors.name?.message} />
                  {departmentOptions.length === 0 ? (
                    <div className={isDarkTheme ? "rounded-md border border-white/10 bg-slate-800/40 p-4 text-sm text-slate-300" : "rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"}>
                      No departments created yet. Add your first department above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {departmentOptions.map((dept) => (
                        <div
                          key={dept.id}
                          className={
                            isDarkTheme
                              ? "flex items-center justify-between rounded-md border border-white/10 bg-slate-800/60 p-3"
                              : "flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-3"
                          }
                        >
                          <span className={isDarkTheme ? "text-sm font-medium text-slate-200" : "text-sm font-medium text-slate-700"}>{dept.name}</span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"}
                              onClick={() => onEditDepartment(dept)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className={isDarkTheme ? "bg-red-500 text-white hover:bg-red-400" : "bg-red-600 text-white hover:bg-red-500"}
                              onClick={() => onDeleteDepartment(dept)}
                              disabled={deletingDepartmentId === dept.id}
                            >
                              {deletingDepartmentId === dept.id ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
            {me.data?.role === "BOSS" ? (
              <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20" : undefined}>
                <CardHeader>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <CardTitle>Employee Types</CardTitle>
                      <p className={isDarkTheme ? "mt-1 text-xs text-slate-400" : "mt-1 text-xs text-slate-500"}>
                        Allowed roles are Boss, Manager, Employee, Intern.
                      </p>
                    </div>
                    <span
                      className={
                        isDarkTheme
                          ? "rounded-full border border-white/15 bg-slate-800 px-2.5 py-1 text-xs text-slate-300"
                          : "rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                      }
                    >
                      {employeeTypeOptions.length} types
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-end">
                    <Button onClick={onOpenAddEmployeeTypeModal} className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined}>
                      Add Employee Type
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {employeeTypeOptions.map((type) => (
                      <div
                        key={type.id}
                        className={
                          isDarkTheme
                            ? "flex items-center justify-between rounded-md border border-white/10 bg-slate-800/60 p-3"
                            : "flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-3"
                        }
                      >
                        <div>
                          <p className={isDarkTheme ? "text-sm font-medium text-slate-200" : "text-sm font-medium text-slate-700"}>{type.label}</p>
                          <p className={isDarkTheme ? "text-xs text-slate-400" : "text-xs text-slate-500"}>{type.code}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"}
                            onClick={() => onEditEmployeeType(type)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className={isDarkTheme ? "bg-red-500 text-white hover:bg-red-400" : "bg-red-600 text-white hover:bg-red-500"}
                            onClick={() => onDeleteEmployeeType(type)}
                            disabled={deletingEmployeeTypeId === type.id}
                          >
                            {deletingEmployeeTypeId === type.id ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
            <Card className={isDarkTheme ? "border-white/10 bg-slate-900 text-slate-100 shadow-black/20" : undefined}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>{title}</CardTitle>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <Input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="Search by name, role, email, department, position, added by..."
                      className={isDarkTheme
                        ? "w-full border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 sm:w-96"
                        : "w-full sm:w-96"}
                    />
                    {currentUser?.role === "BOSS" || currentUser?.role === "MANAGER" || currentUser?.role === "EMPLOYEE" ? (
                      <Button
                        className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined}
                        onClick={onOpenCreateInternModal}
                      >
                        Add New Employee
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className={isDarkTheme ? "mb-4 text-xs text-slate-400" : "mb-4 text-xs text-slate-500"}>
                  Logged in as: {me.data?.name ?? "Unknown user"}
                </p>
                {users.isLoading && visibleLimit === 12 ? (
                  <div className={isDarkTheme ? "rounded-md border border-white/10 bg-slate-800/40 p-6" : "rounded-md border border-slate-200 bg-slate-50 p-6"}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {Array.from({ length: 8 }).map((_, idx) => (
                        <div key={idx} className="rounded-md border border-slate-200 p-4">
                          <Skeleton height={18} width="55%" />
                          <Skeleton height={14} count={4} className="mt-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {users.isError ? (
                  <div className={isDarkTheme ? "rounded-md border border-red-500/40 bg-red-950/30 p-6 text-center text-red-200" : "rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-600"}>
                    Failed to load employees.{" "}
                    <button onClick={() => users.refetch()} className="underline hover:opacity-70">
                      Retry
                    </button>
                  </div>
                ) : null}
                {!users.isLoading && !users.isError && employees.length === 0 ? (
                  <div className={isDarkTheme ? "rounded-md border border-white/10 bg-slate-800/40 p-6 text-center text-slate-300" : "rounded-md border border-slate-200 bg-slate-50 p-6 text-center text-slate-500"}>
                    {debouncedSearch.trim() ? "No employees match your search." : "No users found."}
                  </div>
                ) : null}
                {!users.isLoading && !users.isError && employees.length > 0 ? (
                  <div className="space-y-3">
                    <p className={isDarkTheme ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                      Showing {employees.length} {employees.length === 1 ? "employee" : "employees"}
                    </p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {employees.map((user) => (
                        <Card
                          key={user.id}
                          className={
                            isDarkTheme
                              ? "border-white/10 bg-slate-900/80 shadow-sm shadow-black/30"
                              : "border-slate-200 bg-white shadow-sm"
                          }
                        >
                          <CardContent className="space-y-4 p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className={isDarkTheme ? "text-base font-semibold text-white" : "text-base font-semibold text-slate-900"}>
                                  {user.name}
                                </p>
                                <p className={isDarkTheme ? "text-sm text-slate-300" : "text-sm text-slate-600"}>{user.email}</p>
                              </div>
                              <span
                                className={
                                  isDarkTheme
                                    ? "rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200"
                                    : "rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700"
                                }
                              >
                                {roleLabel(user.role)}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-2 text-sm">
                              <p className={isDarkTheme ? "text-slate-300" : "text-slate-700"}>
                                <span className={isDarkTheme ? "text-slate-500" : "text-slate-500"}>Department: </span>
                                {user.department ?? "-"}
                              </p>
                              <p className={isDarkTheme ? "text-slate-300" : "text-slate-700"}>
                                <span className={isDarkTheme ? "text-slate-500" : "text-slate-500"}>Position: </span>
                                {user.position ?? "-"}
                              </p>
                              <p className={isDarkTheme ? "text-slate-300" : "text-slate-700"}>
                                <span className={isDarkTheme ? "text-slate-500" : "text-slate-500"}>Added by: </span>
                                {user.creator?.name ?? (user.createdBy ? user.createdBy : "-")}
                              </p>
                            </div>

                            {canManageUser(user) ? (
                              <div className="flex items-center gap-2 border-t pt-3 dark:border-white/10">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}
                                  onClick={() => onOpenEditEmployeeModal(user)}
                                >
                                  Edit Employee
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  className={
                                    isDarkTheme
                                      ? "bg-red-500 text-white hover:bg-red-400"
                                      : "bg-red-600 text-white hover:bg-red-500"
                                  }
                                  onClick={() => onRequestDeleteEmployee(user)}
                                  disabled={deletingUserId === user.id}
                                >
                                  {deletingUserId === user.id ? "Deleting..." : "Delete"}
                                </Button>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {users.isFetching ? (
                      <div className={isDarkTheme ? "py-3 text-center text-sm text-slate-400" : "py-3 text-center text-sm text-slate-500"}>
                        <Skeleton height={14} width={160} className="mx-auto" />
                      </div>
                    ) : null}
                    {!users.isFetching && hasMore ? (
                      <div ref={loadMoreRef} className="h-1 w-full" aria-hidden />
                    ) : null}
                    {!users.isFetching && !hasMore ? (
                      <div className={isDarkTheme ? "py-1 text-center text-xs text-slate-500" : "py-1 text-center text-xs text-slate-400"}>
                        End of employee list
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>

        {showCreateInternModal ? (
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
                  Add New Intern
                </h3>
                <button
                  type="button"
                  onClick={onCloseCreateInternModal}
                  className={isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}
                >
                  Close
                </button>
              </div>

              <form className="space-y-3" onSubmit={createInternForm.handleSubmit(onCreateIntern)} noValidate>
                <div className="space-y-1">
                  <Label htmlFor="internName">Name *</Label>
                  <Input
                    id="internName"
                    placeholder="Intern name"
                    {...createInternForm.register("name", { required: "Name is required" })}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={createInternForm.formState.errors.name?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="internEmail">Email *</Label>
                  <Input
                    id="internEmail"
                    type="email"
                    placeholder="intern@company.com"
                    {...createInternForm.register("email", {
                      required: "Email is required",
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
                    })}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={createInternForm.formState.errors.email?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="internPassword">Password *</Label>
                  <Input
                    id="internPassword"
                    type="password"
                    placeholder="At least 8 characters"
                    {...createInternForm.register("password", {
                      required: "Password is required",
                      minLength: { value: 8, message: "Password must be at least 8 characters" },
                    })}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                  <FieldError msg={createInternForm.formState.errors.password?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="internRole">Role *</Label>
                  <select
                    id="internRole"
                    {...createInternForm.register("role", { required: "Role is required" })}
                    className={isDarkTheme
                      ? "h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                      : "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"}
                  >
                    {assignableRoleOptions.map((type) => (
                        <option key={type.id} value={type.code}>
                          {type.label}
                        </option>
                      ))}
                  </select>
                  <FieldError msg={createInternForm.formState.errors.role?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="internPhone">Phone</Label>
                  <Input
                    id="internPhone"
                    placeholder="+91 98765 43210"
                    {...createInternForm.register("phone")}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="internDepartment">Department</Label>
                  <select
                    id="internDepartment"
                    {...createInternForm.register("department")}
                    className={isDarkTheme
                      ? "h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                      : "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"}
                  >
                    <option value="">Select department</option>
                    {departmentOptions.map((department) => (
                      <option key={department.id} value={department.name}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="internPosition">Position</Label>
                  <Input
                    id="internPosition"
                    placeholder="Sales Intern"
                    {...createInternForm.register("position")}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus-visible:ring-cyan-400/30" : undefined}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}
                    onClick={onCloseCreateInternModal}
                  >
                    Cancel
                  </Button>
                  <Button className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined} disabled={createInternState.isLoading}>
                    {createInternState.isLoading ? "Saving..." : "Create Intern"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
        {showEditEmployeeModal && selectedEmployee ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
            <div
              className={
                isDarkTheme
                  ? "w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/50"
                  : "w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
              }
            >
              <div className="mb-5 flex items-start justify-between gap-3 border-b pb-4 dark:border-white/10">
                <div>
                  <h3 className={isDarkTheme ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"}>
                    Edit Employee
                  </h3>
                  <p className={isDarkTheme ? "mt-1 text-sm text-slate-400" : "mt-1 text-sm text-slate-500"}>
                    Update profile details and role for this employee.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCloseEditEmployeeModal}
                  className={isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}
                >
                  Close
                </button>
              </div>
              <form className="space-y-4" onSubmit={editEmployeeForm.handleSubmit(onUpdateEmployee)} noValidate>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="editName">Name *</Label>
                    <Input
                      id="editName"
                      {...editEmployeeForm.register("name", { required: "Name is required" })}
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400" : undefined}
                    />
                    <FieldError msg={editEmployeeForm.formState.errors.name?.message} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="editEmail">Email *</Label>
                    <Input
                      id="editEmail"
                      type="email"
                      {...editEmployeeForm.register("email", {
                        required: "Email is required",
                        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
                      })}
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400" : undefined}
                    />
                    <FieldError msg={editEmployeeForm.formState.errors.email?.message} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="editRole">Role *</Label>
                    <select
                      id="editRole"
                      {...editEmployeeForm.register("role", { required: "Role is required" })}
                      className={isDarkTheme
                        ? "h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                        : "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"}
                    >
                      {assignableRoleOptions.map((type) => (
                          <option key={type.id} value={type.code}>
                            {type.label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="editPhone">Phone</Label>
                    <Input
                      id="editPhone"
                      {...editEmployeeForm.register("phone")}
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400" : undefined}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="editDepartment">Department</Label>
                    <select
                      id="editDepartment"
                      {...editEmployeeForm.register("department")}
                      className={isDarkTheme
                        ? "h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                        : "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"}
                    >
                      <option value="">Select department</option>
                      {departmentOptions.map((department) => (
                        <option key={department.id} value={department.name}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="editPosition">Position</Label>
                    <Input
                      id="editPosition"
                      {...editEmployeeForm.register("position")}
                      className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400" : undefined}
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t pt-4 dark:border-white/10">
                  <Button
                    type="button"
                    variant="outline"
                    className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}
                    onClick={onCloseEditEmployeeModal}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined} disabled={updateUserState.isLoading}>
                    {updateUserState.isLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
        {showDeleteConfirmModal && employeeToDelete ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div
              className={
                isDarkTheme
                  ? "w-full max-w-lg rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/50"
                  : "w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
              }
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className={isDarkTheme ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"}>
                  Delete Employee
                </h3>
                <button
                  type="button"
                  onClick={onCloseDeleteConfirmModal}
                  className={isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}
                >
                  Close
                </button>
              </div>
              <div
                className={
                  isDarkTheme
                    ? "rounded-md border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-100"
                    : "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                }
              >
                You are deleting <span className="font-semibold">{employeeToDelete.name}</span>. All linked data will be reassigned based on hierarchy rules, then this user is soft-deleted.
              </div>
              <div className="mt-4 space-y-1">
                <Label htmlFor="transferTarget">Transfer data to (optional)</Label>
                <select
                  id="transferTarget"
                  value={transferTargetId}
                  onChange={(event) => setTransferTargetId(event.target.value)}
                  className={isDarkTheme
                    ? "h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                    : "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"}
                >
                  <option value="">
                    {employeeToDelete.role === "MANAGER"
                      ? "Select a manager (required)"
                      : "Auto transfer by hierarchy"}
                  </option>
                  {deleteTransferOptions.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} - {roleLabel(candidate.role)}
                    </option>
                  ))}
                </select>
                <p className={isDarkTheme ? "text-xs text-slate-400" : "text-xs text-slate-500"}>
                  {employeeToDelete.role === "MANAGER"
                    ? "Manager deletion requires selecting another manager."
                    : "If no user is selected, data is transferred automatically by reporting hierarchy."}
                </p>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : undefined}
                  onClick={onCloseDeleteConfirmModal}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className={
                    isDarkTheme
                      ? "bg-red-500 text-white hover:bg-red-400"
                      : "bg-red-600 text-white hover:bg-red-500"
                  }
                  onClick={onConfirmDeleteEmployee}
                  disabled={
                    deletingUserId === employeeToDelete.id ||
                    (employeeToDelete.role === "MANAGER" && transferTargetId.trim() === "")
                  }
                >
                  {deletingUserId === employeeToDelete.id ? "Deleting..." : "Confirm Delete"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {showEmployeeTypeModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div
              className={
                isDarkTheme
                  ? "w-full max-w-lg rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/50"
                  : "w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
              }
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className={isDarkTheme ? "text-lg font-semibold text-white" : "text-lg font-semibold text-slate-900"}>
                  {editingEmployeeType ? "Update Employee Type" : "Add Employee Type"}
                </h3>
                <button
                  type="button"
                  onClick={onCloseEmployeeTypeModal}
                  className={isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}
                >
                  Close
                </button>
              </div>
              <form className="space-y-3" onSubmit={employeeTypeForm.handleSubmit(onSubmitEmployeeType)}>
                <div className="space-y-1">
                  <Label htmlFor="employeeTypeCode">Code</Label>
                  <select
                    id="employeeTypeCode"
                    {...employeeTypeForm.register("code")}
                    disabled={Boolean(editingEmployeeType)}
                    className={isDarkTheme
                      ? "h-10 w-full rounded-md border border-white/15 bg-slate-800 px-3 text-sm text-slate-100"
                      : "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"}
                  >
                    <option value="BOSS">BOSS</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="INTERN">INTERN</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="employeeTypeLabel">Label</Label>
                  <Input
                    id="employeeTypeLabel"
                    placeholder="Display label"
                    {...employeeTypeForm.register("label", { required: "Label is required" })}
                    className={isDarkTheme ? "border-white/15 bg-slate-800 text-slate-100 placeholder:text-slate-400" : undefined}
                  />
                  <FieldError msg={employeeTypeForm.formState.errors.label?.message} />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={isDarkTheme ? "border-white/20 bg-slate-800 text-slate-100 hover:bg-slate-700" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"}
                    onClick={onCloseEmployeeTypeModal}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className={isDarkTheme ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : undefined}
                    disabled={createEmployeeTypeState.isLoading || updateEmployeeTypeState.isLoading}
                  >
                    {editingEmployeeType
                      ? updateEmployeeTypeState.isLoading
                        ? "Updating..."
                        : "Update"
                      : createEmployeeTypeState.isLoading
                        ? "Adding..."
                        : "Add"}
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

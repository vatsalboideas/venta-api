"use client";

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { decryptPayload, encryptPayload } from "@/lib/encryption";
import { setToken } from "@/store/slices/auth-slice";
import type {
  Brand,
  ConversionRateResponse,
  Contact,
  CreateInternRequest,
  CreateBrandRequest,
  CreateContactRequest,
  CreateLogRequest,
  Department,
  DepartmentRequest,
  DeleteUserRequest,
  Disable2FARequest,
  EmployeeType,
  EmployeeTypeRequest,
  GlobalSearchResponse,
  LeaderboardItem,
  LoginResponse,
  LogItem,
  LogRevision,
  RegisterRequest,
  RegisterResponse,
  RevenueTrendItem,
  Setup2FAResponse,
  UpdateBrandRequest,
  UpdateContactRequest,
  UpdateLogRequest,
  UpdateUserRequest,
  User,
  Verify2FASetupRequest,
  VerifyTwoFARequest,
  VerifyTwoFAResponse,
} from "@/types/api";

const backendPublicKey = process.env.NEXT_PUBLIC_BACKEND_PUBLIC_KEY ?? "";
const legacyClientSecret = process.env.NEXT_PUBLIC_CLIENT_ENCRYPTION_SECRET ?? "";
const TOKEN_KEY = "venta-token";

function shouldAutoLogout(url: string | undefined): boolean {
  if (!url) return false;
  // Treat only session-check endpoints as hard-auth failures.
  return url.includes("/auth/me");
}

function getErrorMessageText(error: { data?: unknown }): string {
  const data = error.data;
  if (!data || typeof data !== "object") return "";
  const maybeMessage = (data as { message?: unknown }).message;
  return typeof maybeMessage === "string" ? maybeMessage.toLowerCase() : "";
}

function isAuthFailure(error: { status: unknown; data?: unknown }): boolean {
  if (error.status !== 401) return false;
  const message = getErrorMessageText(error);
  if (!message) return true;
  return (
    message.includes("unauthorized") ||
    message.includes("token") ||
    message.includes("expired") ||
    message.includes("invalid")
  );
}

function logoutAndRedirect(apiStore: { dispatch: (action: unknown) => void }) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  apiStore.dispatch(setToken(null));
  if (window.location.pathname !== "/") {
    window.location.replace("/");
  }
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/api/proxy",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as { auth: { token: string | null } }).auth.token;
    headers.set("x-encrypted", "1");
    if (token) headers.set("authorization", `Bearer ${token}`);
    return headers;
  },
});

async function maybeDecryptErrorPayload(error: { data?: unknown }, transportKey: string | null) {
  const encrypted = error.data as { payload?: string } | undefined;
  if (!encrypted?.payload || !transportKey) return;

  try {
    error.data = await decryptPayload(encrypted.payload, transportKey);
  } catch (decryptError) {
    // Keep original payload if decrypt fails, but add trace detail for debugging.
    console.warn("[API Error] Failed to decrypt error payload", { decryptError });
  }
}

export const api = createApi({
  reducerPath: "api",
  refetchOnFocus: true,
  refetchOnReconnect: true,
  refetchOnMountOrArgChange: true,
  baseQuery: async (args, apiStore, extraOptions) => {
    const request = typeof args === "string" ? { url: args } : { ...args };
    const currentToken = (apiStore.getState() as { auth: { token: string | null } }).auth.token;
    const transportKeyMaterial = backendPublicKey || legacyClientSecret;
    if (!transportKeyMaterial) {
      return {
        error: {
          status: "CUSTOM_ERROR",
          error: "Transport encryption key is not configured",
        },
      };
    }
    const encryptedRequest = await encryptPayload(request.body ?? {}, transportKeyMaterial);
    request.headers = {
      ...(typeof request.headers === "object" && request.headers !== null ? request.headers : {}),
      ...(encryptedRequest.transportKey ? { "x-transport-key": encryptedRequest.transportKey } : {}),
    };
    if (request.body !== undefined) {
      request.body = { payload: encryptedRequest.payload };
    }
    const result = await rawBaseQuery(request, apiStore, extraOptions);
    if (result.error) {
      await maybeDecryptErrorPayload(result.error as { data?: unknown }, encryptedRequest.rawTransportKey);
      const error = result.error as { status: unknown; data?: unknown };
      if (currentToken && shouldAutoLogout(request.url) && isAuthFailure(error)) {
        logoutAndRedirect(apiStore);
      }
      return result;
    }
    const encrypted = result.data as { payload?: string };
    if (encrypted?.payload) {
      result.data = await decryptPayload(encrypted.payload, encryptedRequest.rawTransportKey);
    }
    return result;
  },
  tagTypes: ["Brands", "Contacts", "Logs", "Me", "Employees"],
  endpoints: (builder) => ({
    // ── Auth ────────────────────────────────────────────────────────────────
    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
    }),
    login: builder.mutation<LoginResponse, { email: string; password: string }>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
    }),
    verifyTwoFA: builder.mutation<VerifyTwoFAResponse, VerifyTwoFARequest>({
      query: (body) => ({ url: "/auth/2fa/verify-login", method: "POST", body }),
    }),
    me: builder.query<User, void>({
      query: () => "/auth/me",
      providesTags: ["Me"],
    }),
    updateMe: builder.mutation<User, UpdateUserRequest>({
      query: (body) => ({ url: "/auth/me", method: "PATCH", body }),
      invalidatesTags: ["Me"],
    }),
    setup2FA: builder.mutation<Setup2FAResponse, void>({
      query: () => ({ url: "/auth/2fa/setup", method: "POST", body: {} }),
    }),
    verifySetup2FA: builder.mutation<{ message: string }, Verify2FASetupRequest>({
      query: (body) => ({ url: "/auth/2fa/verify-setup", method: "POST", body }),
      invalidatesTags: ["Me"],
    }),
    disable2FA: builder.mutation<{ message: string }, Disable2FARequest>({
      query: (body) => ({ url: "/auth/2fa/disable", method: "POST", body }),
      invalidatesTags: ["Me"],
    }),
    listUsers: builder.query<User[], { q?: string; page?: number; limit?: number } | void>({
      query: (params) => {
        const query = new URLSearchParams();
        const q = params?.q?.trim();
        if (q) query.set("q", q);
        if (params?.page && params.page > 0) query.set("page", String(params.page));
        if (params?.limit && params.limit > 0) query.set("limit", String(params.limit));
        const qs = query.toString();
        return qs ? `/auth/users?${qs}` : "/auth/users";
      },
      providesTags: ["Employees"],
    }),
    createIntern: builder.mutation<User, CreateInternRequest>({
      query: (body) => ({ url: "/auth/interns", method: "POST", body }),
      invalidatesTags: ["Employees"],
    }),
    updateUser: builder.mutation<User, { id: string; body: UpdateUserRequest }>({
      query: ({ id, body }) => ({ url: `/auth/users/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _err, { id }) => [{ type: "Employees", id }, "Employees"],
    }),
    deleteUser: builder.mutation<{ message: string; transferredTo: string }, DeleteUserRequest>({
      query: ({ id, transferToUserId }) => {
        const query = new URLSearchParams();
        if (transferToUserId) query.set("transferToUserId", transferToUserId);
        const qs = query.toString();
        return { url: qs ? `/auth/users/${id}?${qs}` : `/auth/users/${id}`, method: "DELETE" };
      },
      invalidatesTags: ["Employees"],
    }),
    listDepartments: builder.query<Department[], void>({
      query: () => "/departments",
      providesTags: ["Employees"],
    }),
    createDepartment: builder.mutation<Department, DepartmentRequest>({
      query: (body) => ({ url: "/departments", method: "POST", body }),
      invalidatesTags: ["Employees"],
    }),
    updateDepartment: builder.mutation<Department, { id: string; body: DepartmentRequest }>({
      query: ({ id, body }) => ({ url: `/departments/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Employees"],
    }),
    deleteDepartment: builder.mutation<void, string>({
      query: (id) => ({ url: `/departments/${id}`, method: "DELETE" }),
      invalidatesTags: ["Employees"],
    }),
    listEmployeeTypes: builder.query<EmployeeType[], void>({
      query: () => "/employee-types",
      providesTags: ["Employees"],
    }),
    createEmployeeType: builder.mutation<EmployeeType, EmployeeTypeRequest>({
      query: (body) => ({ url: "/employee-types", method: "POST", body }),
      invalidatesTags: ["Employees"],
    }),
    updateEmployeeType: builder.mutation<EmployeeType, { id: string; body: Pick<EmployeeTypeRequest, "label"> }>({
      query: ({ id, body }) => ({ url: `/employee-types/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Employees"],
    }),
    deleteEmployeeType: builder.mutation<void, string>({
      query: (id) => ({ url: `/employee-types/${id}`, method: "DELETE" }),
      invalidatesTags: ["Employees"],
    }),

    // ── Brands ──────────────────────────────────────────────────────────────
    listBrands: builder.query<Brand[], { q?: string } | void>({
      query: (params) => {
        const search = params?.q?.trim();
        if (!search) return "/brands";
        return `/brands?q=${encodeURIComponent(search)}`;
      },
      providesTags: ["Brands"],
    }),
    getBrand: builder.query<Brand, string>({
      query: (id) => `/brands/${id}`,
      providesTags: (_result, _err, id) => [{ type: "Brands", id }],
    }),
    createBrand: builder.mutation<Brand, CreateBrandRequest>({
      query: (body) => ({ url: "/brands", method: "POST", body }),
      invalidatesTags: ["Brands", "Contacts", "Logs"],
    }),
    updateBrand: builder.mutation<Brand, { id: string } & UpdateBrandRequest>({
      query: ({ id, ...body }) => ({ url: `/brands/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _err, { id }) => [{ type: "Brands", id }, "Brands", "Contacts", "Logs"],
    }),
    deleteBrand: builder.mutation<void, string>({
      query: (id) => ({ url: `/brands/${id}`, method: "DELETE" }),
      invalidatesTags: ["Brands", "Contacts", "Logs"],
    }),

    // ── Contacts ────────────────────────────────────────────────────────────
    listContacts: builder.query<Contact[], {
      brandId?: string;
      q?: string;
      page?: number;
      limit?: number;
    } | void>({
      query: (params) => {
        const query = new URLSearchParams();
        const brandId = params?.brandId?.trim();
        const q = params?.q?.trim();
        if (brandId) query.set("brandId", brandId);
        if (q) query.set("q", q);
        if (params?.page && params.page > 0) query.set("page", String(params.page));
        if (params?.limit && params.limit > 0) query.set("limit", String(params.limit));
        const qs = query.toString();
        return qs ? `/contacts?${qs}` : "/contacts";
      },
      providesTags: ["Contacts"],
    }),
    getContact: builder.query<Contact, string>({
      query: (id) => `/contacts/${id}`,
      providesTags: (_result, _err, id) => [{ type: "Contacts", id }],
    }),
    createContact: builder.mutation<Contact, CreateContactRequest>({
      query: (body) => ({ url: "/contacts", method: "POST", body }),
      invalidatesTags: ["Contacts", "Brands", "Logs"],
    }),
    updateContact: builder.mutation<Contact, { id: string } & UpdateContactRequest>({
      query: ({ id, ...body }) => ({ url: `/contacts/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _err, { id }) => [{ type: "Contacts", id }, "Contacts", "Brands", "Logs"],
    }),
    deleteContact: builder.mutation<void, string>({
      query: (id) => ({ url: `/contacts/${id}`, method: "DELETE" }),
      invalidatesTags: ["Contacts", "Brands", "Logs"],
    }),

    // ── Logs ────────────────────────────────────────────────────────────────
    listLogs: builder.query<LogItem[], {
      brandId?: string;
      q?: string;
      fromDate?: string;
      toDate?: string;
      dateField?: "createdAt" | "lastContactDate" | "followUpDate" | "meetingDate" | "all";
      sort?: "latest" | "oldest";
      page?: number;
      limit?: number;
    } | void>({
      query: (params) => {
        const query = new URLSearchParams();
        const brandId = params?.brandId?.trim();
        const q = params?.q?.trim();
        const fromDate = params?.fromDate?.trim();
        const toDate = params?.toDate?.trim();
        const dateField = params?.dateField?.trim();
        if (brandId) query.set("brandId", brandId);
        if (q) query.set("q", q);
        if (fromDate) query.set("fromDate", fromDate);
        if (toDate) query.set("toDate", toDate);
        if (dateField) query.set("dateField", dateField);
        if (params?.sort) query.set("sort", params.sort);
        if (params?.page && params.page > 0) query.set("page", String(params.page));
        if (params?.limit && params.limit > 0) query.set("limit", String(params.limit));
        const qs = query.toString();
        return qs ? `/logs?${qs}` : "/logs";
      },
      providesTags: ["Logs"],
    }),
    getLog: builder.query<LogItem, string>({
      query: (id) => `/logs/${id}`,
      providesTags: (_result, _err, id) => [{ type: "Logs", id }],
    }),
    getLogRevisions: builder.query<LogRevision[], string>({
      query: (id) => `/logs/${id}/revisions`,
      providesTags: (_result, _err, id) => [{ type: "Logs", id }],
    }),
    createLog: builder.mutation<LogItem, CreateLogRequest>({
      query: (body) => ({ url: "/logs", method: "POST", body }),
      invalidatesTags: ["Logs"],
    }),
    updateLog: builder.mutation<LogItem, { id: string } & UpdateLogRequest>({
      query: ({ id, ...body }) => ({ url: `/logs/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _err, { id }) => [{ type: "Logs", id }, "Logs"],
    }),
    deleteLog: builder.mutation<void, string>({
      query: (id) => ({ url: `/logs/${id}`, method: "DELETE" }),
      invalidatesTags: ["Logs"],
    }),

    // ── Analytics ────────────────────────────────────────────────────────────
    revenueTrend: builder.query<RevenueTrendItem[], "day" | "month" | void>({
      query: (period) => `/analytics/logs/revenue-trend${period ? `?period=${period}` : ""}`,
    }),
    conversionRate: builder.query<ConversionRateResponse, void>({
      query: () => "/analytics/logs/conversion-rate",
    }),
    leaderboard: builder.query<LeaderboardItem[], void>({
      query: () => "/analytics/logs/leaderboard",
    }),
    globalSearch: builder.query<GlobalSearchResponse, { q: string; limit?: number }>({
      query: ({ q, limit }) => {
        const query = new URLSearchParams();
        query.set("q", q.trim());
        if (limit && limit > 0) query.set("limit", String(limit));
        return `/search?${query.toString()}`;
      },
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useVerifyTwoFAMutation,
  useMeQuery,
  useUpdateMeMutation,
  useSetup2FAMutation,
  useVerifySetup2FAMutation,
  useDisable2FAMutation,
  useListUsersQuery,
  useCreateInternMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useListDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useListEmployeeTypesQuery,
  useCreateEmployeeTypeMutation,
  useUpdateEmployeeTypeMutation,
  useDeleteEmployeeTypeMutation,
  useListBrandsQuery,
  useGetBrandQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeleteBrandMutation,
  useListContactsQuery,
  useGetContactQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
  useListLogsQuery,
  useGetLogQuery,
  useGetLogRevisionsQuery,
  useCreateLogMutation,
  useUpdateLogMutation,
  useDeleteLogMutation,
  useRevenueTrendQuery,
  useConversionRateQuery,
  useGlobalSearchQuery,
  useLeaderboardQuery,
} = api;

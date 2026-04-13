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
  Disable2FARequest,
  LeaderboardItem,
  LoginResponse,
  LogItem,
  RegisterRequest,
  RegisterResponse,
  RevenueTrendItem,
  Setup2FAResponse,
  UpdateBrandRequest,
  UpdateContactRequest,
  UpdateLogRequest,
  User,
  Verify2FASetupRequest,
  VerifyTwoFARequest,
  VerifyTwoFAResponse,
} from "@/types/api";

const clientSecret = process.env.NEXT_PUBLIC_CLIENT_ENCRYPTION_SECRET ?? "frontend-dev-secret";
const TOKEN_KEY = "venta-token";

function shouldAutoLogout(url: string | undefined): boolean {
  if (!url) return true;
  return !(
    url.includes("/auth/login") ||
    url.includes("/auth/register") ||
    url.includes("/auth/2fa/verify-login")
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

export const api = createApi({
  reducerPath: "api",
  baseQuery: async (args, apiStore, extraOptions) => {
    const request = typeof args === "string" ? { url: args } : { ...args };
    const currentToken = (apiStore.getState() as { auth: { token: string | null } }).auth.token;
    if (request.body !== undefined) {
      request.body = await encryptPayload(request.body, clientSecret);
    }
    const result = await rawBaseQuery(request, apiStore, extraOptions);
    if (result.error) {
      const status = result.error.status;
      if ((status === 401 || status === 403) && currentToken && shouldAutoLogout(request.url)) {
        logoutAndRedirect(apiStore);
      }
      return result;
    }
    const encrypted = result.data as { payload?: string };
    if (encrypted?.payload) {
      result.data = await decryptPayload(encrypted.payload, clientSecret);
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
    listUsers: builder.query<User[], { createdByMe?: boolean } | void>({
      query: (params) => `/auth/users${params?.createdByMe ? "?createdByMe=true" : ""}`,
      providesTags: ["Employees"],
    }),
    createIntern: builder.mutation<User, CreateInternRequest>({
      query: (body) => ({ url: "/auth/interns", method: "POST", body }),
      invalidatesTags: ["Employees"],
    }),

    // ── Brands ──────────────────────────────────────────────────────────────
    listBrands: builder.query<Brand[], void>({
      query: () => "/brands",
      providesTags: ["Brands"],
    }),
    getBrand: builder.query<Brand, string>({
      query: (id) => `/brands/${id}`,
      providesTags: (_result, _err, id) => [{ type: "Brands", id }],
    }),
    createBrand: builder.mutation<Brand, CreateBrandRequest>({
      query: (body) => ({ url: "/brands", method: "POST", body }),
      invalidatesTags: ["Brands"],
    }),
    updateBrand: builder.mutation<Brand, { id: string } & UpdateBrandRequest>({
      query: ({ id, ...body }) => ({ url: `/brands/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _err, { id }) => [{ type: "Brands", id }, "Brands"],
    }),
    deleteBrand: builder.mutation<void, string>({
      query: (id) => ({ url: `/brands/${id}`, method: "DELETE" }),
      invalidatesTags: ["Brands"],
    }),

    // ── Contacts ────────────────────────────────────────────────────────────
    listContacts: builder.query<Contact[], void>({
      query: () => "/contacts",
      providesTags: ["Contacts"],
    }),
    getContact: builder.query<Contact, string>({
      query: (id) => `/contacts/${id}`,
      providesTags: (_result, _err, id) => [{ type: "Contacts", id }],
    }),
    createContact: builder.mutation<Contact, CreateContactRequest>({
      query: (body) => ({ url: "/contacts", method: "POST", body }),
      invalidatesTags: ["Contacts"],
    }),
    updateContact: builder.mutation<Contact, { id: string } & UpdateContactRequest>({
      query: ({ id, ...body }) => ({ url: `/contacts/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _err, { id }) => [{ type: "Contacts", id }, "Contacts"],
    }),
    deleteContact: builder.mutation<void, string>({
      query: (id) => ({ url: `/contacts/${id}`, method: "DELETE" }),
      invalidatesTags: ["Contacts"],
    }),

    // ── Logs ────────────────────────────────────────────────────────────────
    listLogs: builder.query<LogItem[], void>({
      query: () => "/logs",
      providesTags: ["Logs"],
    }),
    getLog: builder.query<LogItem, string>({
      query: (id) => `/logs/${id}`,
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
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useVerifyTwoFAMutation,
  useMeQuery,
  useSetup2FAMutation,
  useVerifySetup2FAMutation,
  useDisable2FAMutation,
  useListUsersQuery,
  useCreateInternMutation,
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
  useCreateLogMutation,
  useUpdateLogMutation,
  useDeleteLogMutation,
  useRevenueTrendQuery,
  useConversionRateQuery,
  useLeaderboardQuery,
} = api;

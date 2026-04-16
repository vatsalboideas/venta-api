"use client";

import { ReactNode, useEffect } from "react";
import { Provider } from "react-redux";

import { setToken } from "./slices/auth-slice";
import { store } from "./index";
import { api } from "./services/api";

const TOKEN_KEY = "venta-token";

export function StoreProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    store.dispatch(setToken(token));
  }, []);

  return <Provider store={store}>{children}</Provider>;
}

export function persistToken(token: string | null) {
  const currentToken = store.getState().auth.token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);

  // Clear cached user/data queries when account/session changes.
  if (currentToken !== token) {
    store.dispatch(api.util.resetApiState());
  }

  store.dispatch(setToken(token));

  // Always send users back to the auth screen after explicit logout.
  if (token === null && typeof window !== "undefined" && window.location.pathname !== "/") {
    window.location.replace("/");
  }
}

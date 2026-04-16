"use client";

import { useEffect, useState } from "react";
import { ToastContainer, type Theme } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const THEME_STORAGE_KEY = "venta-dashboard-theme";
const THEME_CHANGE_EVENT = "venta-theme-change";

type ThemeMode = "light" | "dark" | "system";

function resolveTheme(mode: ThemeMode, prefersDark: boolean): Theme {
  if (mode === "system") {
    return prefersDark ? "dark" : "light";
  }
  return mode;
}

export function ToastProvider() {
  const [resolvedTheme, setResolvedTheme] = useState<Theme>("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const readSavedMode = (): ThemeMode => {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    };

    const updateTheme = (nextMode?: ThemeMode) => {
      const mode = nextMode ?? readSavedMode();
      setResolvedTheme(resolveTheme(mode, media.matches));
    };

    const onSystemThemeChange = () => updateTheme();
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) updateTheme();
    };
    const onThemeModeChange = (event: Event) => {
      const mode = (event as CustomEvent<ThemeMode>).detail;
      updateTheme(mode);
    };

    updateTheme();
    media.addEventListener("change", onSystemThemeChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_CHANGE_EVENT, onThemeModeChange);

    return () => {
      media.removeEventListener("change", onSystemThemeChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeModeChange);
    };
  }, []);

  return (
    <ToastContainer
      position="top-right"
      autoClose={4000}
      hideProgressBar={false}
      closeOnClick
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={resolvedTheme}
    />
  );
}

import { createContext, useEffect, useMemo, useState } from "react";
import { translations } from "../i18n/translations";

export const UiPreferencesContext = createContext(null);

const resolveKey = (source, key) =>
  key.split(".").reduce((current, part) => current?.[part], source);

const interpolate = (message, values = {}) =>
  String(message).replace(/\{\{(\w+)\}\}/g, (_match, key) => values[key] ?? "");

const getInitialTheme = () => {
  const savedTheme = window.localStorage.getItem("pulse_theme");

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return "dark";
};

export function UiPreferencesProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [locale, setLocale] = useState(
    () => window.localStorage.getItem("pulse_locale") || "en"
  );

  useEffect(() => {
    window.localStorage.setItem("pulse_theme", theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("pulse_locale", locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const value = useMemo(() => {
    const localeTag = locale === "ar" ? "ar-EG" : "en-US";

    const t = (key, params) => {
      const message =
        resolveKey(translations[locale], key) ?? resolveKey(translations.en, key) ?? key;

      return interpolate(message, params);
    };

    return {
      theme,
      setTheme,
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark")),
      locale,
      setLocale,
      isRtl: locale === "ar",
      localeTag,
      t,
      formatNumber: (valueToFormat, options = {}) => {
        if (valueToFormat === null || valueToFormat === undefined || valueToFormat === "") {
          return t("common.notAvailable");
        }

        return new Intl.NumberFormat(localeTag, options).format(valueToFormat);
      },
      formatDateTime: (valueToFormat, options = {}) => {
        if (!valueToFormat) {
          return t("common.never");
        }

        return new Intl.DateTimeFormat(localeTag, {
          dateStyle: "medium",
          timeStyle: "short",
          ...options,
        }).format(new Date(valueToFormat));
      },
    };
  }, [locale, theme]);

  return (
    <UiPreferencesContext.Provider value={value}>
      {children}
    </UiPreferencesContext.Provider>
  );
}

import { useUiPreferences } from "../../hooks/useUiPreferences";

export default function PreferenceControls({ floating = false }) {
  const { locale, setLocale, theme, toggleTheme, t } = useUiPreferences();

  return (
    <div className={floating ? "preference-controls floating" : "preference-controls"}>
      <div className="preference-group" aria-label={t("controls.language")}>
        <button
          type="button"
          className={locale === "en" ? "preference-button active" : "preference-button"}
          onClick={() => setLocale("en")}
        >
          EN
        </button>
        <button
          type="button"
          className={locale === "ar" ? "preference-button active" : "preference-button"}
          onClick={() => setLocale("ar")}
        >
          AR
        </button>
      </div>

      <button className="preference-button theme-toggle" type="button" onClick={toggleTheme}>
        <span>{t("controls.theme")}</span>
        <strong>{theme === "dark" ? t("common.themeDark") : t("common.themeLight")}</strong>
      </button>
    </div>
  );
}

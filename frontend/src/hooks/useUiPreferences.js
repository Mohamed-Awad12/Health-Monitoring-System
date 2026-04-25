import { useContext } from "react";
import { UiPreferencesContext } from "../context/UiPreferencesContext";

export function useUiPreferences() {
  return useContext(UiPreferencesContext);
}

import { useContext } from "react";
import { ToastContext } from "../context/ToastContext";

export function useToast() {
  const { addToast, removeToast } = useContext(ToastContext);
  return { addToast, removeToast };
}

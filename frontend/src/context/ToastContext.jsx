import { createContext, useCallback, useRef, useState } from "react";

let toastId = 0;

export const ToastContext = createContext({
  addToast: () => {},
  removeToast: () => {},
});

const TOAST_LIMIT = 5;
const DEFAULT_DURATION_MS = 4500;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type = "info", message, duration = DEFAULT_DURATION_MS }) => {
      const id = ++toastId;

      setToasts((current) => {
        const next = [...current, { id, type, message }];
        return next.length > TOAST_LIMIT ? next.slice(-TOAST_LIMIT) : next;
      });

      if (duration > 0) {
        timersRef.current[id] = setTimeout(() => removeToast(id), duration);
      }

      return id;
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-container" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const iconMap = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  return (
    <div className={`toast-item toast-${toast.type}`} role="alert">
      <span className="toast-icon" aria-hidden="true">
        {iconMap[toast.type] || iconMap.info}
      </span>
      <span className="toast-message">{toast.message}</span>
      <button
        className="toast-dismiss"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        type="button"
      >
        ✕
      </button>
    </div>
  );
}

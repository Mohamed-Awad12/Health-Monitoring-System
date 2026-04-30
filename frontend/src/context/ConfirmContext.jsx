import { createContext, useCallback, useRef, useState } from "react";

export const ConfirmContext = createContext({
  confirm: () => Promise.resolve(false),
});

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(
    ({ title = "Are you sure?", message = "", confirmLabel = "Confirm", cancelLabel = "Cancel", variant = "danger" } = {}) => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setState({ title, message, confirmLabel, cancelLabel, variant });
      });
    },
    []
  );

  const handleResolve = useCallback((result) => {
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
    setState(null);
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state ? (
        <ConfirmDialog
          title={state.title}
          message={state.message}
          confirmLabel={state.confirmLabel}
          cancelLabel={state.cancelLabel}
          variant={state.variant}
          onConfirm={() => handleResolve(true)}
          onCancel={() => handleResolve(false)}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, variant, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  const confirmBtnRef = useRef(null);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      onCancel();
      return;
    }

    if (event.key === "Tab") {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = dialog.querySelectorAll("button:not([disabled])");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const confirmButtonClass =
    variant === "danger" ? "confirm-dialog-btn confirm-dialog-btn-danger" : "confirm-dialog-btn confirm-dialog-btn-primary";

  return (
    <div
      className="confirm-overlay"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={message ? "confirm-dialog-message" : undefined}
    >
      <div
        className="confirm-dialog"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </h3>
        {message ? (
          <p id="confirm-dialog-message" className="confirm-dialog-message">
            {message}
          </p>
        ) : null}
        <div className="confirm-dialog-actions">
          <button
            className="confirm-dialog-btn confirm-dialog-btn-cancel"
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={confirmButtonClass}
            onClick={onConfirm}
            ref={confirmBtnRef}
            type="button"
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import { SocketProvider } from "./context/SocketContext";
import { ToastProvider } from "./context/ToastContext";
import { UiPreferencesProvider } from "./context/UiPreferencesContext";
import "./styles/index.css";
import "./styles/toast.css";
import "./styles/confirm.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <UiPreferencesProvider>
        <AuthProvider>
          <SocketProvider>
            <NotificationsProvider>
              <ToastProvider>
                <ConfirmProvider>
                  <App />
                </ConfirmProvider>
              </ToastProvider>
            </NotificationsProvider>
          </SocketProvider>
        </AuthProvider>
      </UiPreferencesProvider>
    </BrowserRouter>
  </React.StrictMode>
);
